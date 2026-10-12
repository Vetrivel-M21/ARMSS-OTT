package playback

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"armss-ott-backend/middleware"
	"armss-ott-backend/models"
	"armss-ott-backend/services/storage"

	"github.com/golang-jwt/jwt/v5"
)

var (
	resolutionRegex = regexp.MustCompile(`RESOLUTION=(\d+)x(\d+)`)
	mapUriRegex     = regexp.MustCompile(`URI="([^"]+)"`)
	keyUriRegex     = regexp.MustCompile(`URI="([^"]+)"`)
)

// GeneratePlaybackToken generates a signed JWT token valid for 5 minutes.
func GeneratePlaybackToken(userID, videoID, deviceID, clientType string, maxHeight int, lifetime time.Duration) (string, error) {
	if lifetime == 0 {
		lifetime = 5 * time.Minute
	}

	claims := models.PlaybackTokenClaims{
		UserID:     userID,
		VideoID:    videoID,
		DeviceID:   deviceID,
		ClientType: clientType,
		MaxHeight:  maxHeight,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(lifetime)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "armss-ott-playback",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(middleware.JWTSecret)
}

// ValidatePlaybackToken parses and verifies the signature and expiration of a playback token.
func ValidatePlaybackToken(tokenStr string) (*models.PlaybackTokenClaims, error) {
	if tokenStr == "" {
		return nil, fmt.Errorf("missing playback token")
	}

	claims := &models.PlaybackTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return middleware.JWTSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid or expired playback token: %w", err)
	}

	if exp, err := claims.GetExpirationTime(); err == nil && exp != nil {
		if time.Now().After(exp.Time) {
			return nil, fmt.Errorf("playback token expired at %v", exp.Time)
		}
	}

	return claims, nil
}

// RewriteMasterPlaylist filters out rungs exceeding maxHeight and rewrites sub-playlists with signed tokens.
func RewriteMasterPlaylist(rawContent []byte, videoID, tokenStr string, maxHeight int, apiBaseURL string) string {
	scanner := bufio.NewScanner(bytes.NewReader(rawContent))
	var outLines []string

	var skipNextURI bool

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "#EXT-X-STREAM-INF:") {
			skipNextURI = false

			// Check RESOLUTION=WxH
			matches := resolutionRegex.FindStringSubmatch(line)
			if len(matches) == 3 {
				height, err := strconv.Atoi(matches[2])
				if err == nil && maxHeight > 0 && height > maxHeight {
					// Exceeds allowed max height: skip this rendition
					skipNextURI = true
					continue
				}
			}
			outLines = append(outLines, line)
			continue
		}

		if skipNextURI {
			// Skip the URI line that belonged to the filtered-out rendition
			skipNextURI = false
			continue
		}

		// Check if line is a sub-playlist URI (ends with .m3u8 and not a tag)
		if !strings.HasPrefix(line, "#") && strings.HasSuffix(line, ".m3u8") {
			// Rewrite sub-playlist path
			cleanBase := strings.TrimRight(apiBaseURL, "/")
			rewrittenURI := fmt.Sprintf("%s/videos/%s/%s?token=%s", cleanBase, videoID, line, url.QueryEscape(tokenStr))
			outLines = append(outLines, rewrittenURI)
			continue
		}

		outLines = append(outLines, line)
	}

	return strings.Join(outLines, "\n") + "\n"
}

// RewriteRenditionPlaylist rewrites segment URIs and init.mp4 into 5-minute presigned S3 URLs.
func RewriteRenditionPlaylist(
	ctx context.Context,
	rawContent []byte,
	videoID string,
	storageSvc *storage.Service,
	tokenStr string,
	enableEncryption bool,
	apiBaseURL string,
) (string, error) {
	scanner := bufio.NewScanner(bytes.NewReader(rawContent))
	var outLines []string
	bucket := storageSvc.HLSBucket()

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// 1. Rewrite #EXT-X-MAP:URI="init_X.mp4"
		if strings.HasPrefix(line, "#EXT-X-MAP:") {
			matches := mapUriRegex.FindStringSubmatch(line)
			if len(matches) == 2 {
				origUri := matches[1]
				s3Key := fmt.Sprintf("videos/%s/%s", videoID, origUri)
				presignedURL, err := storageSvc.GeneratePresignedGetURL(ctx, bucket, s3Key, 5*time.Minute)
				if err != nil {
					return "", fmt.Errorf("presigning init map %s: %w", s3Key, err)
				}
				line = mapUriRegex.ReplaceAllString(line, fmt.Sprintf(`URI="%s"`, presignedURL))
			}
			outLines = append(outLines, line)
			continue
		}

		// 2. Rewrite #EXT-X-KEY:METHOD=AES-128
		if strings.HasPrefix(line, "#EXT-X-KEY:") {
			if enableEncryption {
				keyURL := fmt.Sprintf("%s/videos/%s/key?token=%s", strings.TrimRight(apiBaseURL, "/"), videoID, url.QueryEscape(tokenStr))
				line = keyUriRegex.ReplaceAllString(line, fmt.Sprintf(`URI="%s"`, keyURL))
			}
			outLines = append(outLines, line)
			continue
		}

		// 3. Rewrite media segment URI (ends with .m4s or .ts, not a comment/tag)
		if !strings.HasPrefix(line, "#") && (strings.HasSuffix(line, ".m4s") || strings.HasSuffix(line, ".ts") || strings.HasSuffix(line, ".mp4")) {
			s3Key := fmt.Sprintf("videos/%s/%s", videoID, line)
			presignedURL, err := storageSvc.GeneratePresignedGetURL(ctx, bucket, s3Key, 5*time.Minute)
			if err != nil {
				return "", fmt.Errorf("presigning segment %s: %w", s3Key, err)
			}
			outLines = append(outLines, presignedURL)
			continue
		}

		outLines = append(outLines, line)
	}

	return strings.Join(outLines, "\n") + "\n", nil
}
