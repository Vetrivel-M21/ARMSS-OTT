package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

func main() {
	apiBase := flag.String("api-url", "http://localhost:8081", "Backend API Base URL")
	email := flag.String("email", "admin@armss.com", "Admin Email")
	password := flag.String("password", "Admin@123", "Admin Password")
	flag.Parse()

	log.Println("================================================================")
	log.Println("   ARMSS-OTT End-to-End Ingest & Playback Verification Suite   ")
	log.Println("================================================================")
	log.Printf("Target API URL: %s", *apiBase)

	client := &http.Client{Timeout: 30 * time.Second}

	// 1. Authenticate Admin User
	log.Printf("[1/7] Authenticating as %s...", *email)
	token := authenticate(client, *apiBase, *email, *password)
	log.Printf("✓ Authenticated successfully! Token acquired.")

	// 2. Register Video for Ingest
	log.Printf("[2/7] Calling POST /api/admin/videos to initialize video record...")
	videoID, uploadURL := createVideoRecord(client, *apiBase, token)
	log.Printf("✓ Video initialized. ID: %s", videoID)
	log.Printf("  Presigned Upload URL: %s", truncate(uploadURL, 80))

	// 3. Upload Sample Master Video Bytes to S3/MinIO
	log.Printf("[3/7] Uploading master video payload via presigned PUT target...")
	uploadMasterPayload(client, uploadURL)
	log.Printf("✓ Master video uploaded successfully to storage!")

	// 4. Complete Ingest & Trigger Transcoder
	log.Printf("[4/7] Calling POST /api/admin/videos/%s/complete to enqueue transcode job...", videoID)
	completeVideoIngest(client, *apiBase, token, videoID)
	log.Printf("✓ Transcoding job enqueued in Asynq/Redis!")

	// 5. Poll for Ready Status
	log.Printf("[5/7] Polling video processing status until 'ready'...")
	waitForVideoReady(client, *apiBase, token, videoID)
	log.Printf("✓ Video status is 'ready'!")

	// 6. Request Playback Ticket
	log.Printf("[6/7] Requesting playback ticket via GET /api/videos/%s/playback...", videoID)
	manifestURL, maxHeight := getPlaybackTicket(client, *apiBase, token, videoID)
	log.Printf("✓ Playback ticket granted! MaxHeight: %dp", maxHeight)
	log.Printf("  Manifest URL: %s", manifestURL)

	// 7. Verify Playlists and Segments
	log.Printf("[7/7] Fetching master playlist and verifying rendition segments...")
	verifyPlaylistsAndSegments(client, *apiBase, manifestURL, videoID)

	log.Println("================================================================")
	log.Println("★ ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY! ★")
	log.Println("================================================================")
}

func authenticate(client *http.Client, apiBase, email, password string) string {
	payload, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	resp, err := client.Post(apiBase+"/api/auth/login", "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Fatalf("Failed to connect to API server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Login failed with status %d: %s", resp.StatusCode, string(body))
	}

	var res map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&res)
	token, ok := res["token"].(string)
	if !ok || token == "" {
		log.Fatalf("Token not found in login response: %v", res)
	}
	return token
}

func createVideoRecord(client *http.Client, apiBase, token string) (string, string) {
	payload, _ := json.Marshal(map[string]string{
		"title": fmt.Sprintf("E2E Verification Run %d", time.Now().Unix()),
	})
	req, _ := http.NewRequest("POST", apiBase+"/api/admin/videos", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Create video failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Create video failed with status %d: %s", resp.StatusCode, string(body))
	}

	var res map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&res)
	id := res["id"].(string)
	uploadURL := res["upload_url"].(string)
	return id, uploadURL
}

func uploadMasterPayload(client *http.Client, uploadURL string) {
	// 1KB mock MP4 sample buffer
	mockData := bytes.Repeat([]byte("ARMSS_OTT_E2E_VIDEO_PAYLOAD_CHUNK"), 40)
	req, _ := http.NewRequest("PUT", uploadURL, bytes.NewReader(mockData))
	req.Header.Set("Content-Type", "video/mp4")

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Direct upload failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Direct upload failed with status %d: %s", resp.StatusCode, string(body))
	}
}

func completeVideoIngest(client *http.Client, apiBase, token, videoID string) {
	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/admin/videos/%s/complete", apiBase, videoID), nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Complete video failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Complete video failed with status %d: %s", resp.StatusCode, string(body))
	}
}

func waitForVideoReady(client *http.Client, apiBase, token, videoID string) {
	deadline := time.Now().Add(3 * time.Minute)
	for time.Now().Before(deadline) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/admin/videos/%s", apiBase, videoID), nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			var res map[string]interface{}
			_ = json.NewDecoder(resp.Body).Decode(&res)
			resp.Body.Close()

			status, _ := res["status"].(string)
			log.Printf("  Current status: %s", status)
			if status == "ready" {
				return
			}
			if status == "failed" {
				errMsg, _ := res["error_message"].(string)
				log.Fatalf("Transcoding failed: %s", errMsg)
			}
		} else if resp != nil {
			resp.Body.Close()
		}

		time.Sleep(3 * time.Second)
	}
	log.Fatalf("Timed out waiting for video to become ready.")
}

func getPlaybackTicket(client *http.Client, apiBase, token, videoID string) (string, int) {
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/videos/%s/playback", apiBase, videoID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Client-Type", "web")
	req.Header.Set("X-Device-ID", "e2e-cli-test")

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Playback request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Fatalf("Playback request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var res map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&res)
	manifestURL := res["manifestUrl"].(string)
	maxHeight := int(res["maxHeight"].(float64))
	return manifestURL, maxHeight
}

func verifyPlaylistsAndSegments(client *http.Client, apiBase, manifestURL, videoID string) {
	fullManifestURL := manifestURL
	if !strings.HasPrefix(fullManifestURL, "http") {
		fullManifestURL = apiBase + manifestURL
	}

	resp, err := client.Get(fullManifestURL)
	if err != nil {
		log.Fatalf("Failed to fetch master playlist: %v", err)
	}
	defer resp.Body.Close()

	masterBytes, _ := io.ReadAll(resp.Body)
	masterContent := string(masterBytes)

	if !strings.Contains(masterContent, "#EXTM3U") {
		log.Fatalf("Response is not a valid HLS playlist: %s", masterContent)
	}
	log.Printf("✓ Master playlist verified (size: %d bytes)", len(masterBytes))

	lines := strings.Split(masterContent, "\n")
	var subPlaylists []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if strings.HasSuffix(l, ".m3u8") || strings.Contains(l, ".m3u8?") {
			subPlaylists = append(subPlaylists, l)
		}
	}

	if len(subPlaylists) == 0 {
		log.Fatalf("No rendition playlists found in master playlist:\n%s", masterContent)
	}
	log.Printf("  Found %d rendition playlists in ladder.", len(subPlaylists))

	for idx, sub := range subPlaylists {
		subURL := sub
		if !strings.HasPrefix(subURL, "http") {
			subURL = apiBase + "/api/videos/" + videoID + "/" + sub
		}

		sResp, err := client.Get(subURL)
		if err != nil {
			log.Fatalf("Failed to fetch rendition playlist %s: %v", sub, err)
		}
		sBytes, _ := io.ReadAll(sResp.Body)
		sResp.Body.Close()
		sContent := string(sBytes)

		if !strings.Contains(sContent, "#EXT-X-TARGETDURATION") {
			log.Fatalf("Invalid rendition playlist %s:\n%s", sub, sContent)
		}

		// Find first segment
		var firstSegment string
		for _, sl := range strings.Split(sContent, "\n") {
			sl = strings.TrimSpace(sl)
			if (strings.Contains(sl, ".mp4") || strings.Contains(sl, ".m4s")) && !strings.HasPrefix(sl, "#") {
				firstSegment = sl
				break
			}
			if strings.HasPrefix(sl, "#EXT-X-MAP:URI=\"") {
				start := len("#EXT-X-MAP:URI=\"")
				end := strings.Index(sl[start:], "\"")
				if end != -1 {
					firstSegment = sl[start : start+end]
					break
				}
			}
		}

		if firstSegment == "" {
			log.Fatalf("Rendition %s does not contain any segment URIs!", sub)
		}

		// Fetch segment
		segResp, err := client.Get(firstSegment)
		if err != nil {
			log.Fatalf("Failed to fetch segment %s: %v", firstSegment, err)
		}
		segBytes, _ := io.ReadAll(segResp.Body)
		segResp.Body.Close()

		if segResp.StatusCode != http.StatusOK {
			log.Fatalf("Segment request returned HTTP %d: %s", segResp.StatusCode, firstSegment)
		}
		if len(segBytes) == 0 {
			log.Fatalf("Segment returned empty payload: %s", firstSegment)
		}

		log.Printf("  [%d/%d] Rendition: %s | First Segment: %d bytes (HTTP 200 OK)", idx+1, len(subPlaylists), truncate(sub, 30), len(segBytes))
	}
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max] + "..."
	}
	return s
}
