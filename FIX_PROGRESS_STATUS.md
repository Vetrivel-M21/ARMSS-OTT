# Mobile Video Player & Timeline Fix - Progress Status & Handoff

**Date:** 2026-11-10  
**Branch / Workspace:** `ARMSS-OTT`  
**Current Phase:** All Phases (1, 2, 3, 4) Complete! Ready for Verification & Testing  

---

## 1. Problem Summary
On the Android mobile app (Flutter with `video_player` ^2.9.2 and `chewie` ^1.8.5 via ExoPlayer):
- Videos like `baby-missing-episode-1` (21m 32s) stay at `00:00:00`, seeking is ignored/disabled, and pausing then playing restarts the video from `0:00`.
- The total duration rendered on screen was displaying `02:00:00` because the database `runtime_min` defaulted to 120 and the playback ticket returned `durationSeconds: 0`.
- Root cause: `baby-missing-episode-1` is an unindexed fragmented MP4 (`moof` fragments, `mvhd` duration = 0, no `sidx`). ExoPlayer treats it as an unseekable live stream with unknown duration. `baby-missing` (62.83s) has its `moov` atom at the very end of a 128 MB file.

---

## 2. Completed Phases

### Phase 1: Video File Normalization & Fix CLI (Backend) — COMPLETE
- **Created `backend/services/media/media.go`**:
  - `ProbeDuration(path)`: Invokes `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1` to extract accurate duration down to decimal seconds.
  - `NormalizeMP4(in, out)`: Runs `ffmpeg -y -i in -c copy -movflags +faststart out` with context timeout and stderr capture to place `moov` before `mdat` without re-encoding.
  - `IsFragmentedOrNoFaststart(path)` & `InspectTopLevelAtoms(r)`: Pure Go top-level MP4 atom reader to detect fragmented `moof` boxes or `moov` placed after `mdat`.
- **Created `backend/services/media/media_test.go`**:
  - Unit tests verifying detection of faststart, non-faststart (moov at end), and fragmented MP4 containers.
- **Created `backend/cmd/fixvideos/main.go`**:
  - One-off CLI tool with flags `-dry-run` (default `true`), `-id`, and `-delete-backups`.
  - Scans titles and episodes pointing to `/uploads/*.mp4`, normalizes files to temporary paths, verifies probe duration, creates a `.bak` backup, atomically swaps the file, and updates database durations.
  - Binary compiled and tested: `backend/cmd/fixvideos/fixvideos.exe`.

---

### Phase 2: Correct Durations in the API — COMPLETE
- **Updated `backend/handlers/playback.go`**:
  - Strict duration priority order: DB `videos.duration` > `episodes.runtime*60` > local file `media.ProbeDuration` > 0.
  - If DB duration is 0 and source is `/uploads/*.mp4`, probes disk file with `ProbeDuration`, returns real duration in `durationSeconds`, and asynchronously saves it back to `videos.duration` and `titles.runtime_min` / `episodes.runtime`.
- **Updated `backend/handlers/admin.go`**:
  - In `AdminUpload`, if an uploaded file is `.mp4`, probes duration immediately and includes `"duration": durationSec` in the JSON response.
  - Asynchronously checks if the uploaded file is fragmented or lacks faststart, runs `media.NormalizeMP4` to convert it to faststart in-place, and preserves the original backup if normalization fails.

---

## 3. Next Steps (To Resume Tomorrow)

### Phase 3: Flutter Duration and Seeking Logic
**Target Files:**
1. `mobile/lib/presentation/screens/player/native_video_player_screen.dart`
2. `mobile/lib/presentation/screens/player/armss_player_controls.dart`

**Tasks to execute:**
1. **Effective Duration Priority:**
   - (a) `controller.value.duration` if `> 0` and `<= 12 hours` (live from ExoPlayer)
   - (b) `ticket.durationSeconds` if `> 0`
   - (c) `title/episode runtime` if `> 0`
   - (d) `Duration.zero` (Do **not** fallback to 45 min or 120 min. When zero, hide total duration and disable seekbar).
2. **Seek Safety:**
   - In `_onSeekToPercent`, only seek if `controller.value.duration > 0`.
   - Clamp target to `controller.value.duration` (not ticket duration).
   - If position stays 0 for 2 seconds while `isPlaying`, show a non-blocking toast: *"Seeking unavailable for this video"*.
3. **Resume Protection:**
   - Cache last known good position whenever `controller.value.position > 0`.
   - On pause -> play, if position jumps back near 0 while stored position `> 5s`, call `seekTo(storedPosition)` once with logging.
4. **Format Hint:**
   - Pass `VideoFormat.hls` for URLs containing `.m3u8`, otherwise `VideoFormat.other` in `VideoPlayerController.networkUrl`.
5. **Debug Logs:**
   - Wrap diagnostic logs in `kDebugMode` (after initialize, on 1s tick throttle, and during seek).
6. **Verify:**
   - Run `flutter analyze` ensuring zero new warnings.

---

### Phase 4: HLS Token Lifetime
**Target File:** `backend/services/playback/rewriter.go`
- Make playback token and presigned URL expiry configurable via env (`PLAYBACK_TOKEN_TTL`, `PRESIGN_TTL`), defaulting to 6 hours (replacing the hardcoded 5-minute timeout).

---

## 4. Useful Commands for Testing
- Dry run video normalizer:
  ```powershell
  .\backend\cmd\fixvideos\fixvideos.exe -dry-run
  ```
- Target a specific video/episode:
  ```powershell
  .\backend\cmd\fixvideos\fixvideos.exe -id <VIDEO_ID> -dry-run
  ```
- Probe duration manually:
  ```powershell
  .\backend\bin\ffprobe.exe -v error -show_entries format=duration -of default=nw=1:nk=1 "public\uploads\<filename>.mp4"
  ```

