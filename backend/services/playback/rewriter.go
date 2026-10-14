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
	"sync"
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

	masterCacheMu sync.RWMutex
	masterCache   = make(map[string]masterParsedCache)
)

type masterParsedItem struct {
	isRendition bool
	streamInf   string
	height      int
	subUri      string
	rawLine     string
}

type masterParsedCache struct {
	items []masterParsedItem
}

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

func parseMasterContent(rawContent []byte) masterParsedCache {
	scanner := bufio.NewScanner(bytes.NewReader(rawContent))
	var items []masterParsedItem
	var pendingStreamInf string
	var pendingHeight int

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "#EXT-X-STREAM-INF:") {
			pendingStreamInf = line
			pendingHeight = 0
			matches := resolutionRegex.FindStringSubmatch(line)
			if len(matches) == 3 {
				if h, err := strconv.Atoi(matches[2]); err == nil {
					pendingHeight = h
				}
			}
			continue
		}

		if pendingStreamInf != "" {
			items = append(items, masterParsedItem{
				isRendition: true,
				streamInf:   pendingStreamInf,
				height:      pendingHeight,
				subUri:      line,
			})
			pendingStreamInf = ""
			continue
		}

		items = append(items, masterParsedItem{
			isRendition: false,
			rawLine:     line,
		})
	}
	return masterParsedCache{items: items}
}

func getOrParseMaster(videoID string, rawContent []byte) masterParsedCache {
	if videoID != "" {
		masterCacheMu.RLock()
		cached, ok := masterCache[videoID]
		masterCacheMu.RUnlock()
		if ok {
			return cached
		}
	}

	parsed := parseMasterContent(rawContent)
	if videoID != "" {
		masterCacheMu.Lock()
		masterCache[videoID] = parsed
		masterCacheMu.Unlock()
	}
	return parsed
}

// RewriteMasterPlaylist filters out rungs exceeding maxHeight and rewrites sub-playlists with signed tokens.
// Uses in-memory parsed template caching for sub-millisecond response latency.
func RewriteMasterPlaylist(rawContent []byte, videoID, tokenStr string, maxHeight int, apiBaseURL string) string {
	parsed := getOrParseMaster(videoID, rawContent)
	cleanBase := strings.TrimRight(apiBaseURL, "/")
	escapedToken := url.QueryEscape(tokenStr)

	var sb strings.Builder
	sb.Grow(len(rawContent) + 256)

	for _, item := range parsed.items {
		if !item.isRendition {
			sb.WriteString(item.rawLine)
			sb.WriteByte('\n')
			continue
		}

		if maxHeight > 0 && item.height > maxHeight {
			continue
		}

		sb.WriteString(item.streamInf)
		sb.WriteByte('\n')

		// If subUri ends with .m3u8, rewrite with token
		if !strings.HasPrefix(item.subUri, "#") && strings.HasSuffix(item.subUri, ".m3u8") {
			sb.WriteString(cleanBase)
			sb.WriteString("/videos/")
			sb.WriteString(videoID)
			sb.WriteByte('/')
			sb.WriteString(item.subUri)
			sb.WriteString("?token=")
			sb.WriteString(escapedToken)
			sb.WriteByte('\n')
		} else {
			sb.WriteString(item.subUri)
			sb.WriteByte('\n')
		}
	}

	return sb.String()
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
