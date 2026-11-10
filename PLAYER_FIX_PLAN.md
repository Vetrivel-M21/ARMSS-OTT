# Mobile Video Player Architecture & Fix Plan

**Date:** 2026-11-06  
**Project:** ARMSS-OTT  
**Issue:** Long-form movies show `00:00 / 00:00`, progress bar is 100% full red, and pausing/resuming restarts from `0:00`. (Web player works fine; mobile ExoPlayer fails).

---

## 1. Problem Summary & Root Cause Analysis

### The Symptoms
1. **Time display shows `00:00 / 00:00`** during playback of long films (e.g. 2 hours), whereas 2-minute clips work correctly.
2. **Progress bar is 100% full (red)** with the scrubber handle stuck on the far right edge.
3. **Pausing and pressing Play restarts the movie from `0:00`** instead of continuing from where the user paused.
4. **Web player (`hls.js`) works properly** with correct time and seeking on the exact same video stream.

### Why Web Works vs. Why Mobile Fails
* **Web (`hls.js`):** Parses the `.m3u8` playlist in browser JavaScript, calculates total duration (`details.totalduration`), and sets `mediaSource.duration = totalDuration` on the HTML5 `<video>` tag. Standard W3C `durationchange` and `timeupdate` events maintain the timeline accurately.
* **Mobile (Android ExoPlayer via Flutter `video_player`):**
  * A 2-hour movie has **1,800 to 2,500 fMP4 chunks**, generating an `.m3u8` manifest of 800 KB+.
  * ExoPlayer starts playing the first segment before the entire manifest finishes downloading and parsing.
  * During this initialization period, ExoPlayer marks the stream as **`isDynamic = true` (Live Stream)** and duration as `C.TIME_UNSET` (`-9223372036854775807L`).
  * Flutter's `video_player` plugin converts `TIME_UNSET` to `Duration.zero`.
  * **Because ExoPlayer treats it as an unseekable live broadcast:**
    * The UI receives `Duration.zero` and renders `00:00 / 00:00`.
    * Dividing by zero or sentinel duration causes the seekbar ratio to clamp to `1.0` (100% red bar).
    * When paused, ExoPlayer cannot seek on an unended live stream; pressing play restarts from `0:00` or seeks to the live edge.

---

## 2. Industry Standard OTT Architecture (Netflix / Disney+ / Prime Video)

Real OTT platforms **never rely on the video decoder or HLS stream to discover duration**.

1. **Server-Authoritative Duration:**
   * The backend `/playback` ticket endpoint returns `"durationSeconds": 8100` from the database.
   * The client UI initializes the seekbar and time labels (`00:00 / 02:15:00`) **immediately on Frame 0**, before ExoPlayer has even connected to the CDN.
2. **Decoupled Playback State:**
   * The UI seekbar is driven by the server's duration, not `videoPlayerController.value.duration`.
   * Pause/resume position is tracked in client state: when resuming, the client enforces `seekTo(savedPausePosition)`.
3. **Defensive Progress Bar Clamping:**
   * If total duration is unknown or `<= 0`, progress is strictly pinned to `0.0` (left edge) — **never** 1.0 (100%).

---

## 3. Step-by-Step Implementation Plan for Tomorrow

### Step 1: Prevent Pause/Resume Restart (Hold Position)
* **Target File:** `mobile/lib/presentation/screens/player/armss_player_controls.dart`
* **Changes:**
  * Add `Duration _savedPausePosition = Duration.zero;`.
  * In `_playPause()`:
    * When pausing: `_savedPausePosition = vc.value.position;`.
    * When resuming (`vc.play()`): if `vc.value.position == Duration.zero` and `_savedPausePosition > Duration.zero`, immediately execute `vc.seekTo(_savedPausePosition)`.
  * **Result:** Video will resume from the exact paused timestamp instead of jumping to 0:00.

### Step 2: Fix Progress Bar & Time Display
* **Target File:** `mobile/lib/presentation/screens/player/armss_player_controls.dart`
* **Changes:**
  * In `_buildProgressBar()`:
    ```dart
    final double rawProgress = (totalDur.inMilliseconds > 0)
        ? (currentPos.inMilliseconds / totalDur.inMilliseconds).clamp(0.0, 1.0)
        : 0.0; // Strictly 0.0 when duration is unknown/zero — never 1.0
    ```
  * In `_effectiveDuration`:
    * Prioritize server ticket duration: `_playbackTicket?.durationSeconds`.
    * Fall back to `title.runtimeMin` from catalog metadata.
    * Only accept stream duration if `> 60s && <= 10h`.
  * **Result:** Time displays e.g. `00:15 / 02:15:00` instantly; progress bar is never stuck at 100%.

### Step 3: Remove Direct URL Bypass in Title Details
* **Target File:** `mobile/lib/presentation/screens/details/title_details_screen.dart`
* **Changes:**
  * When tapping "Play Movie", navigate cleanly to `/player/${title.id}` (do not append `?url=...`).
  * **Result:** `NativeVideoPlayerScreen` will always call the backend `/playback` endpoint, guaranteeing `_playbackTicket` carries the server's authoritative `durationSeconds`.

### Step 4: Fix Docker Build Timeout
* **Target File:** `backend/Dockerfile`
* **Changes:**
  * Add `ENV GOPROXY="https://goproxy.io,https://proxy.golang.org,direct"` before `RUN go mod download`.
  * **Result:** Fixes the `TLS handshake timeout` on `proxy.golang.org` during `docker compose build` for backend and worker.

---

## 4. Verification Checklist (To Run Tomorrow)

- [ ] Run `docker compose build backend worker` and verify build finishes with exit code 0.
- [ ] Launch mobile app, open a long movie (e.g. Aura Pictures title).
- [ ] Confirm time shows `00:00 / HH:MM:SS` (not `00:00 / 00:00`).
- [ ] Confirm progress bar starts at 0% (far left, not 100% red).
- [ ] Let video play for 30 seconds, tap Pause, then tap Play: confirm playback resumes from 0:30 (does not reset to 0:00).
- [ ] Seek to 15:00, confirm video seeks and plays smoothly.

