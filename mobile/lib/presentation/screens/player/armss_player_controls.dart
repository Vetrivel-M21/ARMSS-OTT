import 'dart:async';
import 'package:flutter/material.dart';
import 'package:chewie/chewie.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

/// Custom, resilient video player controls for ARMSS-OTT.
///
/// Fixes two critical bugs in long-form HLS video playback:
///
/// **Bug 1 – 0:00/0:00 display on long movies:**
/// HLS streams served from the backend report `Duration.zero` during and
/// shortly after `initialize()` because ExoPlayer / AVPlayer must fully parse
/// the master manifest and at least one media playlist before the duration is
/// known. Short (~2 min) clips resolve fast enough that the UI never notices;
/// films (1–3 h) take longer, so the initial `duration` is still zero when
/// controls first render. The fix: a periodic `_durationPollTimer` re-checks
/// `videoController.value.duration` every 500 ms for up to 15 s, stopping as
/// soon as a valid (> 0 and < sanity cap) duration is reported.
///
/// **Bug 2 – Progress bar immediately 100% full/red:**
/// ExoPlayer (and sometimes AVPlayer via video_player) temporarily emits
/// `duration = 2^31−1 ms` (≈ 24.8 days) for live or not-yet-known HLS
/// streams. This makes `position / duration ≈ 0`, which is fine, BUT the
/// raw value passes our `> 0` guard and is forwarded to `_effectiveDuration`,
/// giving a false 24-day total. The fix: cap the accepted stream duration at
/// a sane ceiling (10 hours) so such sentinel values are ignored and the
/// fallback chain is engaged instead.
///
/// Features (unchanged from original):
/// - Resilient duration fallback from metadata (title `runtimeMin` / episode `runtime`).
/// - Clamped seekbar: drag or tap seeking across the entire movie duration.
/// - 10s Rewind / 10s Forward / Play / Pause with auto-hide timer.
/// - Integrated Mute, Fullscreen, and Options menu triggers.
class ArmssPlayerControls extends StatefulWidget {
  final Duration fallbackDuration;
  final Duration Function()? durationResolver;
  final VoidCallback? onOpenOptions;

  const ArmssPlayerControls({
    super.key,
    this.fallbackDuration = Duration.zero,
    this.durationResolver,
    this.onOpenOptions,
  });

  @override
  State<ArmssPlayerControls> createState() => _ArmssPlayerControlsState();
}

class _ArmssPlayerControlsState extends State<ArmssPlayerControls> {
  ChewieController? _chewieController;
  VideoPlayerController? _videoController;

  bool _controlsVisible = true;
  Timer? _hideTimer;
  bool _isDragging = false;
  double _dragProgress = 0.0; // 0.0 to 1.0

  /// Polling timer that keeps checking for a valid HLS duration.
  /// Needed because ExoPlayer / AVPlayer may not know the duration at
  /// initialize() time for multi-rendition HLS master playlists.
  Timer? _durationPollTimer;

  /// Maximum sane video duration. ExoPlayer emits 2^31-1 ms as a sentinel for
  /// "live / unknown" streams. We cap at 10 h to detect and discard that.
  static const Duration _maxSaneDuration = Duration(hours: 10);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final oldChewie = _chewieController;
    _chewieController = ChewieController.of(context);
    final newVideo = _chewieController?.videoPlayerController;

    if (oldChewie?.videoPlayerController != newVideo) {
      _videoController?.removeListener(_onControllerTick);
      _durationPollTimer?.cancel();

      _videoController = newVideo;
      _videoController?.addListener(_onControllerTick);
      _resetHideTimer();

      // Start duration polling so the UI updates as soon as HLS duration
      // becomes available (may take a few seconds for long movies).
      _startDurationPolling();
    }
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _durationPollTimer?.cancel();
    _videoController?.removeListener(_onControllerTick);
    super.dispose();
  }

  void _onControllerTick() {
    if (!mounted) return;
    setState(() {});
  }

  /// Polls `videoController.value.duration` every 500 ms until we get a valid,
  /// sane value OR 15 seconds have elapsed (30 polls × 500 ms).
  void _startDurationPolling() {
    _durationPollTimer?.cancel();
    int pollsLeft = 30; // 15 seconds total

    _durationPollTimer = Timer.periodic(const Duration(milliseconds: 500), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      pollsLeft--;
      final raw = _videoController?.value.duration ?? Duration.zero;
      final isValid = raw > Duration.zero && raw <= _maxSaneDuration;
      if (isValid || pollsLeft <= 0) {
        t.cancel();
        // Trigger a rebuild so the controls now show the real duration.
        if (mounted) setState(() {});
      }
    });
  }

  /// Returns the best-effort total duration for the current stream.
  ///
  /// Priority:
  ///   1. Stream-reported duration (from `video_player`) — only if sane.
  ///   2. Caller-supplied `durationResolver` (from metadata / backend ticket).
  ///   3. Static `fallbackDuration` passed at construction.
  ///   4. Hardcoded 45-minute default (safest non-zero value).
  Duration get _effectiveDuration {
    final streamDur = _videoController?.value.duration ?? Duration.zero;
    // Accept stream duration only if positive AND within a sane ceiling.
    // ExoPlayer may emit 2^31-1 ms for unresolved HLS durations.
    if (streamDur > Duration.zero && streamDur <= _maxSaneDuration) {
      return streamDur;
    }

    if (widget.durationResolver != null) {
      final resolved = widget.durationResolver!();
      if (resolved > Duration.zero) return resolved;
    }
    if (widget.fallbackDuration > Duration.zero) return widget.fallbackDuration;
    return const Duration(minutes: 45);
  }

  void _resetHideTimer() {
    _hideTimer?.cancel();
    if (!_controlsVisible || _isDragging) return;

    final isPlaying = _videoController?.value.isPlaying ?? false;
    if (isPlaying) {
      _hideTimer = Timer(const Duration(seconds: 4), () {
        if (!mounted) return;
        setState(() {
          _controlsVisible = false;
        });
      });
    }
  }

  void _toggleControls() {
    setState(() {
      _controlsVisible = !_controlsVisible;
    });
    if (_controlsVisible) {
      _resetHideTimer();
    } else {
      _hideTimer?.cancel();
    }
  }

  void _playPause() {
    final vc = _videoController;
    if (vc == null) return;
    if (vc.value.isPlaying) {
      vc.pause();
      setState(() {
        _controlsVisible = true;
      });
      _hideTimer?.cancel();
    } else {
      vc.play();
      _resetHideTimer();
    }
  }

  void _seekRelative(int seconds) {
    final vc = _videoController;
    if (vc == null) return;
    final curPos = vc.value.position;
    final dur = _effectiveDuration;
    var target = curPos + Duration(seconds: seconds);
    if (target < Duration.zero) target = Duration.zero;
    if (dur > Duration.zero && target > dur) target = dur;

    vc.seekTo(target);
    _resetHideTimer();
  }

  void _onSeekToPercent(double percent) {
    final vc = _videoController;
    final dur = _effectiveDuration;
    if (vc == null || dur <= Duration.zero) return;

    final targetMs = (percent.clamp(0.0, 1.0) * dur.inMilliseconds).round();
    vc.seekTo(Duration(milliseconds: targetMs));
  }

  String _formatTime(Duration duration, bool hasHours) {
    if (duration <= Duration.zero) {
      return hasHours ? '00:00:00' : '00:00';
    }
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    final mStr = minutes.toString().padLeft(2, '0');
    final sStr = seconds.toString().padLeft(2, '0');
    if (hasHours || hours > 0) {
      final hStr = hours.toString().padLeft(2, '0');
      return '$hStr:$mStr:$sStr';
    }
    return '$mStr:$sStr';
  }

  @override
  Widget build(BuildContext context) {
    final vc = _videoController;
    if (vc == null || !vc.value.isInitialized) {
      return const SizedBox.shrink();
    }

    final totalDur = _effectiveDuration;
    final currentPos = vc.value.position;
    final hasHours = totalDur.inHours > 0;
    final isBuffering = vc.value.isBuffering;

    // Calculate progress ratio (0.0 to 1.0).
    // Guard: totalDur must be > 0 (guaranteed by _effectiveDuration fallback).
    final double rawProgress = (totalDur.inMilliseconds > 0)
        ? (currentPos.inMilliseconds / totalDur.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;
    final double currentProgress = _isDragging ? _dragProgress : rawProgress;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _toggleControls,
      child: Stack(
        children: [
          // Semi-transparent dark vignette when controls are visible
          AnimatedOpacity(
            opacity: _controlsVisible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 250),
            child: IgnorePointer(
              ignoring: !_controlsVisible,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black54,
                      Colors.transparent,
                      Colors.transparent,
                      Colors.black87,
                    ],
                    stops: [0.0, 0.25, 0.70, 1.0],
                  ),
                ),
              ),
            ),
          ),

          // Center Hit Area: 10s Rewind, Center Play/Pause, 10s Forward
          Center(
            child: AnimatedOpacity(
              opacity: _controlsVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 250),
              child: IgnorePointer(
                ignoring: !_controlsVisible,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Rewind 10s
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _seekRelative(-10),
                        customBorder: const CircleBorder(),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            color: Colors.black45,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.replay_10_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 32),

                    // Play / Pause / Buffering Indicator
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _playPause,
                        customBorder: const CircleBorder(),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: const BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          child: isBuffering
                              ? const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: CircularProgressIndicator(
                                    color: AppColors.primary,
                                    strokeWidth: 3.5,
                                  ),
                                )
                              : Icon(
                                  vc.value.isPlaying
                                      ? Icons.pause_rounded
                                      : Icons.play_arrow_rounded,
                                  color: Colors.white,
                                  size: 44,
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 32),

                    // Forward 10s
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _seekRelative(10),
                        customBorder: const CircleBorder(),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            color: Colors.black45,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.forward_10_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Top-Right Action Menu (3 dots)
          Positioned(
            top: 40,
            right: 16,
            child: AnimatedOpacity(
              opacity: _controlsVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 250),
              child: IgnorePointer(
                ignoring: !_controlsVisible,
                child: IconButton(
                  icon: const Icon(Icons.more_vert_rounded, color: Colors.white, size: 26),
                  onPressed: () {
                    _resetHideTimer();
                    widget.onOpenOptions?.call();
                  },
                ),
              ),
            ),
          ),

          // Bottom Bar Overlay: Time Display, Mute, Fullscreen, and Scrubber Bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedOpacity(
              opacity: _controlsVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 250),
              child: IgnorePointer(
                ignoring: !_controlsVisible,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Sub-row: Time & Action Buttons
                      Row(
                        children: [
                          // Time Position / Total Duration
                          Text(
                            _formatTime(currentPos, hasHours),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                          Text(
                            ' / ${_formatTime(totalDur, hasHours)}',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.7),
                              fontSize: 13,
                              fontFeatures: const [FontFeature.tabularFigures()],
                            ),
                          ),

                          // Volume / Mute Button
                          const SizedBox(width: 8),
                          IconButton(
                            icon: Icon(
                              vc.value.volume > 0
                                  ? Icons.volume_up_rounded
                                  : Icons.volume_off_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                            padding: const EdgeInsets.all(4),
                            constraints: const BoxConstraints(),
                            onPressed: () {
                              _resetHideTimer();
                              vc.setVolume(vc.value.volume > 0 ? 0.0 : 1.0);
                            },
                          ),

                          const Spacer(),

                          // Fullscreen toggle
                          IconButton(
                            icon: Icon(
                              _chewieController?.isFullScreen ?? false
                                  ? Icons.fullscreen_exit_rounded
                                  : Icons.fullscreen_rounded,
                              color: Colors.white,
                              size: 26,
                            ),
                            padding: const EdgeInsets.all(4),
                            constraints: const BoxConstraints(),
                            onPressed: () {
                              _chewieController?.toggleFullScreen();
                              _resetHideTimer();
                            },
                          ),
                        ],
                      ),

                      const SizedBox(height: 6),

                      // Interactive Progress Seek Bar
                      _buildProgressBar(currentProgress, totalDur),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar(double progress, Duration totalDur) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth;

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragStart: (details) {
            _hideTimer?.cancel();
            setState(() {
              _isDragging = true;
              _dragProgress = (details.localPosition.dx / totalWidth).clamp(0.0, 1.0);
            });
          },
          onHorizontalDragUpdate: (details) {
            setState(() {
              _dragProgress = (details.localPosition.dx / totalWidth).clamp(0.0, 1.0);
            });
          },
          onHorizontalDragEnd: (details) {
            setState(() {
              _isDragging = false;
            });
            _onSeekToPercent(_dragProgress);
            _resetHideTimer();
          },
          onTapDown: (details) {
            final tapPercent = (details.localPosition.dx / totalWidth).clamp(0.0, 1.0);
            _onSeekToPercent(tapPercent);
            _resetHideTimer();
          },
          child: Container(
            height: 24, // Touch target height
            alignment: Alignment.center,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Background Track
                Container(
                  height: 4,
                  width: totalWidth,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Buffered Ranges
                if (_videoController != null)
                  ..._videoController!.value.buffered.map((range) {
                    if (totalDur.inMilliseconds <= 0) return const SizedBox.shrink();
                    final startPct = (range.start.inMilliseconds / totalDur.inMilliseconds).clamp(0.0, 1.0);
                    final endPct = (range.end.inMilliseconds / totalDur.inMilliseconds).clamp(0.0, 1.0);
                    final rangeWidth = (endPct - startPct) * totalWidth;
                    if (rangeWidth <= 0) return const SizedBox.shrink();

                    return Positioned(
                      left: startPct * totalWidth,
                      child: Container(
                        height: 4,
                        width: rangeWidth,
                        decoration: BoxDecoration(
                          color: Colors.white38,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    );
                  }),

                // Played Progress Bar (Clamped, no infinity stretch!)
                Container(
                  height: 4,
                  width: (progress * totalWidth).clamp(0.0, totalWidth),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Handle Scrubber Circle
                Positioned(
                  left: (progress * totalWidth - 6).clamp(0.0, totalWidth - 12),
                  top: -4,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
