# Technical Analysis & Architecture Flow Report: Mobile Video Player Timeline & Seeking Issue

**Date:** 2026-11-07  
**Project:** ARMSS-OTT / AURA Mobile  
**Stack:** Flutter (`video_player: ^2.9.2`, `chewie: ^1.8.5`), Android ExoPlayer, Go Backend, HLS CMAF fMP4  
**Status:** In-Depth Architecture Diagnosis & External Investigation Brief  

---


## 1. Problem Statement & Visual Evidence

* **Screenshot Observation:** The player renders `00:00:00 / 02:00:00` with the scrubber handle locked at 0% (far left edge).
* **Observed Symptoms:**
  1. The total duration (`02:00:00`) displays accurately because the frontend received the authoritative duration from the backend `/playback` ticket or catalog metadata.
  2. The elapsed time remains permanently stuck at `00:00:00` and never counts up as the film plays.
  3. The scrubber circle cannot be dragged or tapped to seek through the film.
  4. Tapping Pause and then Play restarts the video from `0:00` instead of resuming from the current scene.
  5. The Web player (`hls.js`) plays the exact same video stream with normal seeking and time progression.

---

## 2. Root Cause Analysis

### The Underlying Issue in Android ExoPlayer
In Flutter's `video_player` plugin on Android, playback is powered by Google's native **ExoPlayer** (`HlsMediaSource`).

1. **Manifest File Size (800 KB+):**
   * A 2-hour movie with 4-second CMAF segments contains **~1,800 to 2,200 `.m4s` chunks**.
   * In `backend/services/playback/rewriter.go`, each segment is rewritten with an S3 presigned URL (300–450 characters each).
   * This balloons the media playlist (`stream_X.m3u8`) to **800 KB – 1 MB** of plain text.

2. **Unseekable Live Window (`isDynamic = true` / `isSeekable = false`):**
   * Desktop browsers (`hls.js`) parse the entire playlist in JavaScript memory before feeding buffers to the HTML5 `<video>` element.
   * On mobile, ExoPlayer starts buffering and decoding the first segment before the entire 800 KB manifest has finished parsing and indexing.
   * During this early phase, ExoPlayer flags the stream timeline as:
     * `isSeekable = false`
     * `isDynamic = true` (treated as an unseekable live broadcast stream)
     * `duration = C.TIME_UNSET` (`-9223372036854775807L`)

3. **Platform Channel Position Deadlock:**
   * Flutter's `video_player` plugin queries `player.getCurrentPosition()` over a platform channel.
   * Because ExoPlayer treats the stream as an unseekable dynamic window with misaligned presentation timestamps (PTS), ExoPlayer continuously reports `position = 0` back to Flutter.
   * In Flutter's Dart layer:
     $$\text{progressRatio} = \frac{\text{position (0 ms)}}{\text{totalDuration (7,200,000 ms)}} = 0.0$$
     The time display stays locked at `00:00:00`, and the progress bar never moves.

4. **Seek & Pause Failures:**
   * When dragging the scrubber, Flutter calls `videoPlayerController.seekTo(...)`. Because ExoPlayer marked `isSeekable = false`, the seek call is rejected or dropped.
   * When pausing and pressing Play, ExoPlayer re-syncs to the start of the unseekable window, resetting the film back to `0:00`.

---

## 3. End-to-End Architecture & Data Flow

```
[ Title Details Screen / Home Feed ]
              │
              │  User taps "Play Movie"
              ▼
[ NativeVideoPlayerScreen (Flutter) ]
              │
              ├── 1. Requests playback ticket:
              │      GET /api/videos/{id}/playback?device_id=...
              │      Receives PlaybackTicket:
              │      - manifestUrl: "/api/videos/{id}/master.m3u8?token=..."
              │      - durationSeconds: 7200.0 (Authoritative DB duration)
              │
              ├── 2. Resolves _effectiveDuration:
              │      Prioritizes ticket.durationSeconds (7200s) -> UI Total: "02:00:00"
              │
              ├── 3. Creates VideoPlayerController.networkUrl(masterUrl)
              │      Calls controller.initialize() -> Launches Android ExoPlayer
              │
              ▼
[ Android ExoPlayer (Native CMAF HLS Pipeline) ]
              │
              ├── Downloads master.m3u8 and stream_X.m3u8 (800 KB+, 1800+ segments)
              │
              ├── ⚠️ Timeline State:
              │      Stream begins playing before full manifest index is verified.
              │      Flags: isSeekable = false, isDynamic = true.
              │
              ├── ⚠️ Position Reporting:
              │      player.getCurrentPosition() returns 0 ms to Flutter platform channel.
              │
              ▼
[ ArmssPlayerControls (Flutter UI Scrubber Layer) ]
              │
              ├── Receives controller.value.position = Duration.zero.
              ├── Formats UI: "00:00:00 / 02:00:00", Scrubber = 0%.
              │
              ├── ⚠️ User drags seekbar to 00:45:00:
              │      Calls controller.seekTo(Duration(minutes: 45)).
              │      ExoPlayer rejects seek because isSeekable == false.
              │
              └── ⚠️ User pauses and taps Play:
                     controller.pause() -> controller.play().
                     ExoPlayer re-anchors to window start (0:00).
```

---

## 4. Web vs. Mobile Technical Comparison

| Dimension | Web (`hls.js`) | Mobile Android (`ExoPlayer`) |
| :--- | :--- | :--- |
| **Manifest Parsing** | Pure JavaScript synchronously parses all 1,800 `#EXTINF` tags before playback. | Asynchronous native pipeline begins playback before manifest completion. |
| **Duration Detection** | `details.totalduration` is calculated and bound to the HTML5 video element. | Defaults to `C.TIME_UNSET` if parsing is incomplete at `STATE_READY`. |
| **Seek Support** | MSE (Media Source Extensions) allows random access seeking across any buffered byte range. | Strictly rejects `seekTo()` calls while `timeline.isSeekable == false`. |
| **Pause / Resume** | Calling `.pause()` and `.play()` retains HTML5 `currentTime`. | Dynamic window resets to window origin (`0:00`). |

---

## 5. Potential Solutions & Investigation Paths

### Solution 1: Compact Playlist Proxying (Backend Solution — Recommended for OTT)
* **The Problem:** 1,800 presigned S3 URLs make the `.m3u8` playlist 800 KB–1 MB.
* **The Fix:** Instead of putting full S3 URLs in the manifest, the backend serves lightweight segment paths:
  `stream_0_data00001.m4s?token=...`
  A lightweight backend proxy or CDN edge worker redirects/streams the segment.
* **Result:** Manifest size drops from **800 KB to ~40 KB**. ExoPlayer parses the entire manifest in under 50ms, resolving `isSeekable = true` and the real timeline before Frame 0.

### Solution 2: Player Engine Replacement (`media_kit` via `libmpv`)
* **The Problem:** The official Flutter `video_player` plugin has known limitations with long-form HLS manifests on Android.
* **The Fix:** Replace `video_player` with **[`media_kit`](https://pub.dev/packages/media_kit)** (used by modern Flutter streaming apps like Jellyfin).
* **Result:** `media_kit` uses native FFmpeg/`libmpv` directly, bypassing ExoPlayer's HLS manifest parsing restrictions and providing accurate PTS timestamping and seeking out of the box.

### Solution 3: Client-Side Playback Position Synthesizer (Frontend Workaround)
* **The Problem:** ExoPlayer plays video frames correctly but fails to report updated timestamps over the platform channel.
* **The Fix:** Maintain a client-side playback clock in Flutter state:
  * When `videoPlayerController.value.isPlaying == true`, increment a local stopwatch timer every second.
  * Use the synthetic position to drive the timeline display and seekbar.
  * When seeking, store the target position and invoke `seekTo`.

---

*Generated for ARMSS-OTT / AURA Mobile Video Player Architecture Review.*

