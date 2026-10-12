import 'dart:async';
import 'dart:math';
import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/constants/api_constants.dart';
import '../../../core/storage/storage_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/playback_model.dart';
import '../../../data/models/title_model.dart';
import '../../../data/models/episode_model.dart';
import '../../../data/repositories/playback_repository.dart';
import '../../../providers/catalog_provider.dart';

class NativeVideoPlayerScreen extends ConsumerStatefulWidget {
  final String titleId;
  final String? episodeId;
  final String? episodeTitle;
  final String? directUrl;

  const NativeVideoPlayerScreen({
    super.key,
    required this.titleId,
    this.episodeId,
    this.episodeTitle,
    this.directUrl,
  });

  @override
  ConsumerState<NativeVideoPlayerScreen> createState() => _NativeVideoPlayerScreenState();
}

class _NativeVideoPlayerScreenState extends ConsumerState<NativeVideoPlayerScreen> with WidgetsBindingObserver {
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;

  PlaybackTicket? _playbackTicket;
  String _selectedQuality = 'Auto';
  Duration _lastPosition = Duration.zero;

  String? _currentEpisodeId;
  String? _currentEpTitle;

  bool _isLoading = true;
  String _statusMessage = 'Connecting to media server...';
  String? _errorMessage;

  Timer? _heartbeatTimer;
  late final String _sessionId;
  String _deviceId = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _sessionId = 'sess-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${Random().nextInt(0xffffff).toRadixString(36)}';
    _currentEpisodeId = widget.episodeId;
    _currentEpTitle = widget.episodeTitle;
    _initDeviceAndPlay();
  }

  Future<void> _initDeviceAndPlay() async {
    _deviceId = await storageService.getOrCreateDeviceId();
    await _loadPlaybackTicket();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Pause playback and release wakelock when backgrounded
      _videoPlayerController?.pause();
      WakelockPlus.disable();
    }
  }

  void _playEpisode(EpisodeModel ep) {
    if (_currentEpisodeId == ep.id) return;
    setState(() {
      _currentEpisodeId = ep.id;
      _currentEpTitle = ep.title;
      _lastPosition = Duration.zero;
      _selectedQuality = 'Auto';
    });
    _loadPlaybackTicket();
  }

  Future<void> _loadPlaybackTicket({bool isRenewal = false}) async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _statusMessage = isRenewal ? 'Renewing playback session...' : 'Requesting stream ticket...';
      _errorMessage = null;
    });

    final targetId = _currentEpisodeId ?? widget.titleId;

    // Fast path: if direct stream URL was passed, stream immediately
    if (widget.directUrl != null && widget.directUrl!.trim().isNotEmpty && _currentEpisodeId == widget.episodeId) {
      final resolved = ApiConstants.resolveMediaUrl(widget.directUrl);
      await _initializeStream(targetUrl: resolved, startAt: _lastPosition);
      return;
    }

    try {
      final ticket = await playbackRepository.getPlaybackTicket(targetId);
      _playbackTicket = ticket;

      // Start position from server if fresh start, otherwise preserve current position
      final initialPosition = isRenewal
          ? _lastPosition
          : Duration(seconds: ticket.resumePositionSec.round());
      _lastPosition = initialPosition;

      await _initializeStream(targetUrl: ticket.autoUrl, startAt: initialPosition);
    } catch (err) {
      // Fallback: Check if episode or title has videoUrl / trailer
      final fallbackUrl = await _resolveFallbackStream();
      if (fallbackUrl != null && fallbackUrl.isNotEmpty) {
        await _initializeStream(targetUrl: fallbackUrl, startAt: _lastPosition);
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Playback unavailable: $err';
          });
        }
      }
    }
  }

  Future<String?> _resolveFallbackStream() async {
    try {
      final title = await ref.read(titleDetailProvider(widget.titleId).future);
      if (title != null) {
        if (_currentEpisodeId != null && title.episodes.isNotEmpty) {
          try {
            final ep = title.episodes.firstWhere((e) => e.id == _currentEpisodeId);
            if (ep.videoUrl != null && ep.videoUrl!.isNotEmpty) {
              return ApiConstants.resolveMediaUrl(ep.videoUrl);
            }
          } catch (_) {}
        }
        final raw = title.videoUrl ?? title.trailer;
        final resolved = ApiConstants.resolveMediaUrl(raw);
        if (resolved.isNotEmpty) return resolved;
      }
      return '${ApiConstants.mediaBaseUrl}/trailers/${widget.titleId}.mp4';
    } catch (_) {
      return null;
    }
  }

  Future<void> _initializeStream({required String targetUrl, required Duration startAt}) async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _statusMessage = 'Buffering stream...';
      _errorMessage = null;
    });

    try {
      // Clean up previous controllers safely
      final oldChewie = _chewieController;
      final oldVideo = _videoPlayerController;
      _chewieController = null;
      _videoPlayerController = null;
      oldChewie?.dispose();
      await oldVideo?.dispose();

      final authToken = await storageService.getToken();
      final headers = <String, String>{
        'X-Client-Type': 'mobile',
        'X-Device-ID': _deviceId,
      };
      if (authToken != null && authToken.isNotEmpty) {
        headers['Authorization'] = 'Bearer $authToken';
      }

      final videoController = VideoPlayerController.networkUrl(
        Uri.parse(targetUrl),
        httpHeaders: headers,
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      _videoPlayerController = videoController;
      await videoController.initialize();

      if (!mounted) {
        videoController.dispose();
        return;
      }

      if (startAt > Duration.zero && startAt < videoController.value.duration) {
        await videoController.seekTo(startAt);
      }

      // Track playback position & wakelock state
      videoController.addListener(_onControllerUpdate);

      // Create ChewieController for native controls & orientation management
      final chewieController = ChewieController(
        videoPlayerController: videoController,
        autoPlay: true,
        looping: false,
        allowFullScreen: true,
        allowMuting: true,
        showControls: true,
        deviceOrientationsOnEnterFullScreen: const [
          DeviceOrientation.landscapeLeft,
          DeviceOrientation.landscapeRight,
        ],
        deviceOrientationsAfterFullScreen: const [
          DeviceOrientation.portraitUp,
        ],
        materialProgressColors: ChewieProgressColors(
          playedColor: AppColors.primary,
          handleColor: AppColors.primary,
          backgroundColor: Colors.white24,
          bufferedColor: Colors.white38,
        ),
        cupertinoProgressColors: ChewieProgressColors(
          playedColor: AppColors.primary,
          handleColor: AppColors.primary,
          backgroundColor: Colors.white24,
          bufferedColor: Colors.white38,
        ),
        playbackSpeeds: const [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
        additionalOptions: (context) {
          final title = ref.read(titleDetailProvider(widget.titleId)).value;
          final isSeries = title != null && title.kind == 'series' && title.episodes.isNotEmpty;
          return [
            OptionItem(
              onTap: (ctx) {
                Navigator.pop(ctx);
                _showQualitySheet();
              },
              iconData: Icons.hd_outlined,
              title: 'Streaming Quality ($_selectedQuality)',
            ),
            if (isSeries)
              OptionItem(
                onTap: (ctx) {
                  Navigator.pop(ctx);
                  _showEpisodesSheet(title);
                },
                iconData: Icons.video_library_rounded,
                title: 'Episodes & Seasons (${title.episodes.length})',
              ),
          ];
        },
        errorBuilder: (context, errorMessage) {
          return _buildErrorWidget(errorMessage);
        },
      );

      _chewieController = chewieController;

      setState(() {
        _isLoading = false;
        _errorMessage = null;
      });

      WakelockPlus.enable();
      _startHeartbeatTimer();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load video stream: $e';
      });
    }
  }

  void _onControllerUpdate() {
    final vc = _videoPlayerController;
    if (vc == null || !vc.value.isInitialized) return;

    _lastPosition = vc.value.position;

    // Wakelock management
    if (vc.value.isPlaying) {
      WakelockPlus.enable();
    } else {
      WakelockPlus.disable();
    }

    // Detect stream error & attempt automatic token renewal
    if (vc.value.hasError) {
      _handlePlaybackError();
    }
  }

  void _handlePlaybackError() {
    _heartbeatTimer?.cancel();
    _loadPlaybackTicket(isRenewal: true);
  }

  void _startHeartbeatTimer() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final vc = _videoPlayerController;
      if (vc != null && vc.value.isInitialized) {
        final posSec = vc.value.position.inSeconds.toDouble();
        final durSec = vc.value.duration.inSeconds.toDouble();
        final progressPct = durSec > 0 ? ((posSec / durSec) * 100).round() : 0;

        playbackRepository.sendWatchProgress(
          videoId: widget.titleId,
          timeSeconds: posSec,
          progressPercent: progressPct,
        );

        playbackRepository.sendHeartbeat(
          videoId: widget.titleId,
          deviceId: _deviceId,
          sessionId: _sessionId,
        );
      }
    });
  }

  Future<void> _selectQuality(String quality) async {
    if (_selectedQuality == quality) return;
    final ticket = _playbackTicket;
    if (ticket == null) return;

    final targetUrl = (quality == 'Auto') ? ticket.autoUrl : ticket.getRenditionUrl(quality);

    setState(() {
      _selectedQuality = quality;
    });

    await _initializeStream(targetUrl: targetUrl, startAt: _lastPosition);
  }

  void _showQualitySheet() {
    final ticket = _playbackTicket;
    final rungs = ['Auto', if (ticket != null) ...ticket.availableRenditions else ...['1080p', '720p', '480p', '360p']];

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final screenHeight = MediaQuery.of(ctx).size.height;
        final isLandscape = MediaQuery.of(ctx).orientation == Orientation.landscape;

        return Container(
          constraints: BoxConstraints(
            maxHeight: isLandscape ? screenHeight * 0.90 : screenHeight * 0.70,
          ),
          decoration: const BoxDecoration(
            color: AppColors.surfaceElevated,
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 4),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.hd_outlined, color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      Text('Streaming Quality', style: AppTypography.cardTitle.copyWith(fontSize: 16)),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Colors.white12, height: 1),
                Flexible(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: rungs.map((rung) {
                        final isSelected = _selectedQuality == rung;
                        String subtitle = '';
                        if (rung == 'Auto') {
                          subtitle = 'Adaptive Bitrate (Recommended)';
                        } else if (rung == '1080p') {
                          subtitle = 'Full HD - High Bandwidth';
                        } else if (rung == '720p') {
                          subtitle = 'HD - Balanced';
                        } else if (rung == '480p') {
                          subtitle = 'Standard Definition - Data Saver';
                        } else if (rung == '360p') {
                          subtitle = 'Low Bandwidth';
                        }

                        return ListTile(
                          dense: isLandscape,
                          leading: Icon(
                            isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                            color: isSelected ? AppColors.primary : Colors.white38,
                            size: 20,
                          ),
                          title: Text(
                            rung,
                            style: TextStyle(
                              color: isSelected ? Colors.white : Colors.white70,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              fontSize: isLandscape ? 13 : 14,
                            ),
                          ),
                          subtitle: subtitle.isNotEmpty
                              ? Text(
                                  subtitle,
                                  style: TextStyle(
                                    color: Colors.white54,
                                    fontSize: isLandscape ? 11 : 12,
                                  ),
                                )
                              : null,
                          onTap: () {
                            Navigator.pop(ctx);
                            _selectQuality(rung);
                          },
                        );
                      }).toList(),
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

  void _showEpisodesSheet(TitleModel title) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final screenHeight = MediaQuery.of(ctx).size.height;
        final isLandscape = MediaQuery.of(ctx).orientation == Orientation.landscape;

        return Container(
          constraints: BoxConstraints(
            maxHeight: isLandscape ? screenHeight * 0.90 : screenHeight * 0.75,
          ),
          decoration: const BoxDecoration(
            color: AppColors.surfaceElevated,
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 4),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.video_library_rounded, color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${title.title} — Episodes (${title.episodes.length})',
                          style: AppTypography.cardTitle.copyWith(fontSize: 16),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Colors.white12, height: 1),
                Flexible(
                  child: ListView.separated(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    itemCount: title.episodes.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final ep = title.episodes[idx];
                      final isCurrent = ep.id == _currentEpisodeId;
                      final thumbUrl = ep.thumbnailUrl != null && ep.thumbnailUrl!.trim().isNotEmpty
                          ? ApiConstants.resolveMediaUrl(ep.thumbnailUrl)
                          : '';

                      return InkWell(
                        onTap: () {
                          Navigator.pop(ctx);
                          _playEpisode(ep);
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isCurrent ? AppColors.primary.withOpacity(0.15) : AppColors.surfaceCard,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isCurrent ? AppColors.primary : AppColors.border,
                              width: isCurrent ? 1.5 : 0.8,
                            ),
                          ),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: Container(
                                  width: isLandscape ? 85 : 100,
                                  height: isLandscape ? 50 : 58,
                                  color: Colors.black26,
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      if (thumbUrl.isNotEmpty)
                                        CachedNetworkImage(
                                          imageUrl: thumbUrl,
                                          fit: BoxFit.cover,
                                          width: double.infinity,
                                          height: double.infinity,
                                          errorWidget: (context, url, error) => Image.asset(
                                            title.backdropAssetPath,
                                            fit: BoxFit.cover,
                                          ),
                                        )
                                      else
                                        Image.asset(
                                          title.backdropAssetPath,
                                          fit: BoxFit.cover,
                                        ),
                                      if (isCurrent)
                                        Container(
                                          color: Colors.black45,
                                          child: const Icon(Icons.play_circle_fill_rounded, color: AppColors.primary, size: 28),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'E${ep.number}. ${ep.title}',
                                      style: TextStyle(
                                        color: isCurrent ? AppColors.primary : Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: isLandscape ? 12 : 13,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${ep.runtime}m',
                                      style: TextStyle(color: Colors.white54, fontSize: isLandscape ? 11 : 12),
                                    ),
                                    if (ep.synopsis.isNotEmpty && !isLandscape) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        ep.synopsis,
                                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              if (isCurrent)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'Playing',
                                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildErrorWidget(String? customMessage) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(24),
        margin: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.primary, size: 48),
            const SizedBox(height: 12),
            Text(
              'Playback Error',
              style: AppTypography.cardTitle.copyWith(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              customMessage ?? _errorMessage ?? 'Unable to connect to the video server.',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: () => _loadPlaybackTicket(isRenewal: true),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: () => context.pop(),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                  ),
                  child: const Text('Back'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _heartbeatTimer?.cancel();
    _chewieController?.dispose();
    _videoPlayerController?.dispose();
    WakelockPlus.disable();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final titleAsync = ref.watch(titleDetailProvider(widget.titleId));
    final title = titleAsync.value;
    final isSeries = title != null && title.kind == 'series' && title.episodes.isNotEmpty;

    // Detect current and next episode
    EpisodeModel? currentEp;
    EpisodeModel? nextEp;
    if (isSeries) {
      final currentIdx = title.episodes.indexWhere((e) => e.id == _currentEpisodeId);
      if (currentIdx != -1) {
        currentEp = title.episodes[currentIdx];
        if (currentIdx + 1 < title.episodes.length) {
          nextEp = title.episodes[currentIdx + 1];
        }
      } else {
        currentEp = title.episodes.first;
        if (title.episodes.length > 1) {
          nextEp = title.episodes[1];
        }
      }
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Stack(
          children: [
            // Chewie Video Player Surface
            if (_chewieController != null &&
                _videoPlayerController != null &&
                _videoPlayerController!.value.isInitialized)
              Center(
                child: Chewie(controller: _chewieController!),
              ),

            // Top Bar Overlay (Back Button & Title & Next Episode)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.only(top: 40, left: 16, right: 16, bottom: 12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.black.withOpacity(0.85), Colors.transparent],
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                      onPressed: () => context.pop(),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            title?.title ?? 'ARMSS OTT Player',
                            style: AppTypography.cardTitle.copyWith(fontSize: 15),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (currentEp != null || (_currentEpTitle != null && _currentEpTitle!.isNotEmpty))
                            Text(
                              currentEp != null
                                  ? 'S${currentEp.season} E${currentEp.number}: ${currentEp.title}'
                                  : _currentEpTitle!,
                              style: const TextStyle(color: Colors.white70, fontSize: 11),
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // If series: Episodes Button
                    if (isSeries) ...[
                      GestureDetector(
                        onTap: () => _showEpisodesSheet(title),
                        child: Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white12,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.white24),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.video_library_rounded, color: Colors.white70, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'Episodes',
                                style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // If next episode exists: Next Episode button!
                      if (nextEp != null)
                        GestureDetector(
                          onTap: () => _playEpisode(nextEp!),
                          child: Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Next Ep',
                                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                SizedBox(width: 2),
                                Icon(Icons.skip_next_rounded, color: Colors.white, size: 15),
                              ],
                            ),
                          ),
                        ),
                    ],
                    // Quick Quality Badge
                    GestureDetector(
                      onTap: _showQualitySheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white10,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white24),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.settings_outlined, color: Colors.white70, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              _selectedQuality,
                              style: AppTypography.badge.copyWith(fontSize: 11, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Floating Next Episode prompt near end of episode
            if (nextEp != null &&
                _videoPlayerController != null &&
                _videoPlayerController!.value.isInitialized &&
                _videoPlayerController!.value.duration.inSeconds > 30 &&
                _videoPlayerController!.value.position.inSeconds >=
                    _videoPlayerController!.value.duration.inSeconds - 30)
              Positioned(
                bottom: 80,
                right: 24,
                child: GestureDetector(
                  onTap: () => _playEpisode(nextEp!),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.primary, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.3),
                          blurRadius: 10,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.skip_next_rounded, color: AppColors.primary, size: 20),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Next Episode',
                              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'E${nextEp.number}. ${nextEp.title}',
                              style: const TextStyle(color: Colors.white70, fontSize: 10),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                        const SizedBox(width: 10),
                        const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 12),
                      ],
                    ),
                  ),
                ),
              ),

            // Loading / Buffering Overlay
            if (_isLoading)
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
                      const SizedBox(height: 16),
                      Text(
                        _statusMessage,
                        style: AppTypography.bodySmall.copyWith(color: Colors.white),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),

            // Explicit Error Overlay
            if (_errorMessage != null && !_isLoading)
              _buildErrorWidget(_errorMessage),
          ],
        ),
      ),
    );
  }
}
