import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/title_model.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/watchlist_provider.dart';
import '../../common/content_rail.dart';
import '../../common/badge_chip.dart';
import '../../common/top_nav_bar.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String _selectedCategory = 'All';
  final PageController _heroController = PageController();
  int _currentHeroIndex = 0;

  VideoPlayerController? _heroVideoController;
  bool _isHeroVideoPlaying = false;
  bool _isMuted = true;
  String? _activeHeroTitleId;

  @override
  void dispose() {
    _heroController.dispose();
    _heroVideoController?.pause();
    _heroVideoController?.dispose();
    _heroVideoController = null;
    super.dispose();
  }

  void _initHeroTrailer(TitleModel title) {
    if (_activeHeroTitleId == title.id && _heroVideoController != null) return;
    _activeHeroTitleId = title.id;

    final raw = title.trailer ?? title.videoUrl;
    final url = ApiConstants.resolveMediaUrl(raw);

    _heroVideoController?.pause();
    _heroVideoController?.dispose();
    _heroVideoController = null;
    _isHeroVideoPlaying = false;

    if (url.isEmpty) {
      if (mounted) setState(() {});
      return;
    }

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _heroVideoController = controller;

    controller.initialize().then((_) {
      if (!mounted || _heroVideoController != controller) return;
      controller.setVolume(_isMuted ? 0.0 : 1.0);
      controller.setLooping(true);
      controller.play();
      setState(() {
        _isHeroVideoPlaying = true;
      });
    }).catchError((_) {
      if (!mounted || _heroVideoController != controller) return;
      setState(() {
        _isHeroVideoPlaying = false;
      });
    });
  }

  void _onTitleTap(TitleModel title) {
    context.push('/title/${title.id}');
  }

  void _onPlayTap(TitleModel title) {
    context.push('/player/${title.id}');
  }

  @override
  Widget build(BuildContext context) {
    final titlesAsync = ref.watch(titlesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: titlesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, stack) => Center(
          child: Text('Failed to load catalog: $err', style: AppTypography.body),
        ),
        data: (allTitles) {
          // Filter by category if selected
          List<TitleModel> displayed = allTitles;
          if (_selectedCategory == 'Movies') {
            displayed = allTitles.where((t) => t.kind == 'film').toList();
          } else if (_selectedCategory == 'Series') {
            displayed = allTitles.where((t) => t.kind == 'series').toList();
          } else if (_selectedCategory == 'Live TV') {
            displayed = allTitles.where((t) => t.kind == 'live').toList();
          }

          final featuredList = displayed.where((t) => t.featured).take(5).toList();
          final heroList = (featuredList.isNotEmpty ? featuredList : displayed).take(3).toList();
          final trendingList = displayed.where((t) => t.trending).toList();
          final top10List = displayed.where((t) => t.rank != null).toList()
            ..sort((a, b) => (a.rank ?? 99).compareTo(b.rank ?? 99));
          final originalsList = displayed.where((t) => t.original).toList();
          final liveList = allTitles.where((t) => t.kind == 'live').toList();

          // Mock continue watching items
          final continueWatching = displayed.take(2).toList();
          final continueProgress = {
            if (continueWatching.isNotEmpty) continueWatching[0].id: 0.65,
            if (continueWatching.length > 1) continueWatching[1].id: 0.30,
          };

          final topNavClearance = MediaQuery.of(context).padding.top + 115.0;

          return Stack(
            children: [
              // Scrollable content
              SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Hero Banner Carousel (shown when hero items exist)
                    if (heroList.isNotEmpty)
                      _buildHeroCarousel(heroList)
                    else
                      SizedBox(height: topNavClearance),

                    // Empty category feedback
                    if (displayed.isEmpty)
                      Padding(
                        padding: EdgeInsets.only(top: topNavClearance + 20, left: 24, right: 24, bottom: 40),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.movie_filter_outlined, size: 54, color: AppColors.textMuted),
                              const SizedBox(height: 16),
                              Text('No $_selectedCategory Available', style: AppTypography.sectionTitle(fontSize: 18)),
                              const SizedBox(height: 8),
                              Text(
                                'Check back soon for new releases or explore all titles.',
                                textAlign: TextAlign.center,
                                style: AppTypography.body,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: () => setState(() => _selectedCategory = 'All'),
                                child: const Text('View All Titles'),
                              ),
                            ],
                          ),
                        ),
                      ),

                    // ── Category Specific Rails ──
                    if (_selectedCategory == 'Series') ...[
                      // Trending Series
                      if (trendingList.isNotEmpty)
                        ContentRail(
                          title: 'Trending Web Series',
                          items: trendingList,
                          onTitleTap: _onTitleTap,
                        ),
                      // Top Rated Series
                      if (top10List.isNotEmpty)
                        ContentRail(
                          title: 'Top Rated Series',
                          items: top10List,
                          isTop10: true,
                          onTitleTap: _onTitleTap,
                        ),
                      // ARMSS Original Series
                      if (originalsList.isNotEmpty)
                        ContentRail(
                          title: 'ARMSS Originals',
                          items: originalsList,
                          onTitleTap: _onTitleTap,
                        ),
                      // All Series rail (always shows all series items)
                      if (displayed.isNotEmpty)
                        ContentRail(
                          title: 'All Series & Seasons',
                          items: displayed,
                          onTitleTap: _onTitleTap,
                        ),
                    ] else if (_selectedCategory == 'Movies') ...[
                      // Top 10 Today
                      if (top10List.isNotEmpty)
                        ContentRail(
                          title: 'Top 10 Movies Today',
                          items: top10List,
                          isTop10: true,
                          onTitleTap: _onTitleTap,
                        ),
                      // Trending Movies
                      if (trendingList.isNotEmpty)
                        ContentRail(
                          title: 'Trending Blockbusters',
                          items: trendingList,
                          onTitleTap: _onTitleTap,
                        ),
                      // ARMSS Originals
                      if (originalsList.isNotEmpty)
                        ContentRail(
                          title: 'ARMSS Exclusives & Originals',
                          items: originalsList,
                          onTitleTap: _onTitleTap,
                        ),
                      // All Movies
                      if (displayed.isNotEmpty)
                        ContentRail(
                          title: 'All Tamil Movies',
                          items: displayed,
                          onTitleTap: _onTitleTap,
                        ),
                    ] else if (_selectedCategory == 'Live TV') ...[
                      // Live Channels
                      if (displayed.isNotEmpty)
                        ContentRail(
                          title: '24/7 Live Broadcasts',
                          subtitle: 'Real-time channels and news',
                          items: displayed,
                          isBackdrop: true,
                          onTitleTap: _onTitleTap,
                        ),
                    ] else ...[
                      // ── 'All' Category Default View ──
                      // Continue Watching
                      if (continueWatching.isNotEmpty)
                        ContentRail(
                          title: 'Continue Watching for Vetrivel',
                          subtitle: 'Pick up where you left off',
                          items: continueWatching,
                          isBackdrop: true,
                          progressMap: continueProgress,
                          onTitleTap: _onTitleTap,
                        ),

                      // Top 10 Today
                      if (top10List.isNotEmpty)
                        ContentRail(
                          title: 'Top 10 in Tamil Nadu Today',
                          items: top10List,
                          isTop10: true,
                          onTitleTap: _onTitleTap,
                        ),

                      // Trending Blockbusters
                      if (trendingList.isNotEmpty)
                        ContentRail(
                          title: 'Trending Blockbusters',
                          items: trendingList,
                          onTitleTap: _onTitleTap,
                        ),

                      // Binge-Worthy TV Series
                      if (allTitles.any((t) => t.kind == 'series'))
                        ContentRail(
                          title: 'Binge-Worthy TV Series',
                          subtitle: 'Award-winning Tamil originals',
                          items: allTitles.where((t) => t.kind == 'series').toList(),
                          onTitleTap: _onTitleTap,
                        ),

                      // ARMSS Originals
                      if (originalsList.isNotEmpty)
                        ContentRail(
                          title: 'ARMSS Exclusives & Originals',
                          items: originalsList,
                          onTitleTap: _onTitleTap,
                        ),

                      // Live Channels
                      if (liveList.isNotEmpty)
                        ContentRail(
                          title: '24/7 Live Broadcasts',
                          subtitle: 'Real-time channels and news',
                          items: liveList,
                          isBackdrop: true,
                          onTitleTap: _onTitleTap,
                        ),
                    ],

                    // Bottom padding for bottom navigation bar
                    const SizedBox(height: 80),
                  ],
                ),
              ),

              // Floating Top Nav Bar
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: TopNavBar(
                  activeCategory: _selectedCategory,
                  onCategorySelected: (cat) {
                    setState(() => _selectedCategory = cat);
                  },
                  onProfileTap: () => context.go('/profiles'),
                  onSearchTap: () => context.go('/search'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHeroCarousel(List<TitleModel> featured) {
    if (featured.isNotEmpty) {
      final safeIndex = _currentHeroIndex.clamp(0, featured.length - 1);
      final currentTitle = featured[safeIndex];
      if (_activeHeroTitleId != currentTitle.id) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _initHeroTrailer(currentTitle);
        });
      }
    }

    final heroHeight = (MediaQuery.of(context).size.height * 0.58).clamp(490.0, 560.0);

    return SizedBox(
      height: heroHeight,
      child: Stack(
        children: [
          // Carousel PageView
          PageView.builder(
            controller: _heroController,
            itemCount: featured.length,
            onPageChanged: (index) {
              setState(() => _currentHeroIndex = index);
              _initHeroTrailer(featured[index]);
            },
            itemBuilder: (context, index) {
              final item = featured[index];
              return Stack(
                fit: StackFit.expand,
                children: [
                  // Poster / Backdrop Image (prioritizes portrait poster for mobile screens)
                  Builder(builder: (context) {
                    final rawUrl = item.poster ?? item.backdrop;
                    final networkUrl = ApiConstants.resolveMediaUrl(rawUrl);

                    Widget buildAssetFallback() {
                      return Image.asset(
                        item.posterAssetPath,
                        fit: BoxFit.cover,
                        alignment: Alignment.topCenter,
                        errorBuilder: (ctx, err, st) {
                          return Image.asset(
                            item.backdropAssetPath,
                            fit: BoxFit.cover,
                            alignment: Alignment.topCenter,
                            errorBuilder: (c, e, s) => Container(color: AppColors.surfaceElevated),
                          );
                        },
                      );
                    }

                    if (networkUrl.isNotEmpty) {
                      return CachedNetworkImage(
                        imageUrl: networkUrl,
                        fit: BoxFit.cover,
                        alignment: Alignment.topCenter,
                        placeholder: (ctx, url) => Container(color: AppColors.surfaceElevated),
                        errorWidget: (ctx, url, err) => buildAssetFallback(),
                      );
                    }
                    return buildAssetFallback();
                  }),

                  // Trailer Video Background (active item only, muted loop)
                  if (_currentHeroIndex == index &&
                      _heroVideoController != null &&
                      _heroVideoController!.value.isInitialized)
                    Positioned.fill(
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 600),
                        opacity: _isHeroVideoPlaying ? 1.0 : 0.0,
                        child: FittedBox(
                          fit: BoxFit.cover,
                          clipBehavior: Clip.hardEdge,
                          child: SizedBox(
                            width: _heroVideoController!.value.size.width,
                            height: _heroVideoController!.value.size.height,
                            child: VideoPlayer(_heroVideoController!),
                          ),
                        ),
                      ),
                    ),

                  // Top Gradient Scrim (ensures status bar & TopNavBar readability)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 150,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withOpacity(0.85),
                            Colors.black.withOpacity(0.40),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Bottom Gradient Blend
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: const BoxDecoration(
                        gradient: AppColors.heroGradient,
                      ),
                    ),
                  ),

                  // Mute / Unmute Button (when video trailer is initialized)
                  if (_currentHeroIndex == index &&
                      _heroVideoController != null &&
                      _heroVideoController!.value.isInitialized)
                    Positioned(
                      bottom: 86,
                      right: 18,
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _isMuted = !_isMuted;
                            _heroVideoController?.setVolume(_isMuted ? 0.0 : 1.0);
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.65),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(0.3)),
                          ),
                          child: Icon(
                            _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                    ),

                  // Overlay Content
                  Positioned(
                    bottom: 24,
                    left: 20,
                    right: 20,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Badges Row
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (item.original) ...[
                              const BadgeChip(label: 'ARMSS ORIGINAL', isGold: true),
                              const SizedBox(width: 8),
                            ],
                            BadgeChip(label: '${item.match}% Match'),
                            const SizedBox(width: 8),
                            BadgeChip(label: item.maturity),
                            const SizedBox(width: 8),
                            BadgeChip(label: item.badges.isNotEmpty ? item.badges.first : '4K HDR'),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // Title
                        Text(
                          item.title,
                          textAlign: TextAlign.center,
                          style: AppTypography.heroTitle(fontSize: 32),
                        ),
                        const SizedBox(height: 6),

                        // Genres
                        Text(
                          item.genres.join(' • '),
                          textAlign: TextAlign.center,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Action Buttons: [Play] [My List]
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Play Button
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _onPlayTap(item),
                                icon: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 24),
                                label: const Text('Play', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(vertical: 11),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),

                            // My List Button
                            Consumer(
                              builder: (context, ref, child) {
                                final isSaved = ref.watch(watchlistProvider).any((t) => t.id == item.id);
                                return Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () {
                                      ref.read(watchlistProvider.notifier).toggle(item);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(isSaved ? 'Removed from My List' : 'Added to My List'),
                                          duration: const Duration(seconds: 1),
                                        ),
                                      );
                                    },
                                    icon: Icon(
                                      isSaved ? Icons.check_rounded : Icons.add_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                    label: Text(
                                      isSaved ? 'In List' : 'My List',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: AppColors.surfaceElevated.withOpacity(0.8),
                                      side: const BorderSide(color: AppColors.border),
                                      padding: const EdgeInsets.symmetric(vertical: 11),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),

          // Dots Indicator
          Positioned(
            bottom: 4,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                featured.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _currentHeroIndex == i ? 16 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _currentHeroIndex == i ? AppColors.primary : AppColors.textMuted.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
