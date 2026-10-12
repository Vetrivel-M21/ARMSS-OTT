import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/title_model.dart';
import '../../../data/models/episode_model.dart';
import '../../../data/repositories/downloads_repository.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/watchlist_provider.dart';
import '../../../providers/downloads_provider.dart';
import '../../common/badge_chip.dart';
import '../../common/poster_card.dart';

class TitleDetailsScreen extends ConsumerStatefulWidget {
  final String titleId;

  const TitleDetailsScreen({super.key, required this.titleId});

  @override
  ConsumerState<TitleDetailsScreen> createState() => _TitleDetailsScreenState();
}

class _TitleDetailsScreenState extends ConsumerState<TitleDetailsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final titleAsync = ref.watch(titleDetailProvider(widget.titleId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: titleAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, stack) => Center(child: Text('Error: $err', style: AppTypography.body)),
        data: (title) {
          if (title == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Title not found', style: AppTypography.cardTitle),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: () => context.pop(), child: const Text('Go Back')),
                ],
              ),
            );
          }

          final isSeries = title.kind == 'series';
          final downloadStatus = ref.watch(titleDownloadStatusProvider(title.id));
          final isWatchlisted = ref.watch(watchlistProvider).any((t) => t.id == title.id);

          return CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // Sliver App Bar with Backdrop Image
              SliverAppBar(
                expandedHeight: 250,
                pinned: true,
                backgroundColor: AppColors.surface,
                leading: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white),
                  ),
                  onPressed: () => context.pop(),
                ),
                actions: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.cast_rounded, size: 18, color: Colors.white),
                    ),
                    onPressed: () {},
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      Builder(builder: (context) {
                        final rawUrl = title.backdrop ?? title.poster;
                        final networkUrl = ApiConstants.resolveMediaUrl(rawUrl);

                        Widget buildAssetFallback() {
                          return Image.asset(
                            title.backdropAssetPath,
                            fit: BoxFit.cover,
                            errorBuilder: (ctx, e, st) => Image.asset(
                              title.posterAssetPath,
                              fit: BoxFit.cover,
                              errorBuilder: (c, err, s) => Container(color: AppColors.surfaceElevated),
                            ),
                          );
                        }

                        if (networkUrl.isNotEmpty) {
                          return CachedNetworkImage(
                            imageUrl: networkUrl,
                            fit: BoxFit.cover,
                            placeholder: (ctx, url) => Container(color: AppColors.surfaceElevated),
                            errorWidget: (ctx, url, err) => buildAssetFallback(),
                          );
                        }
                        return buildAssetFallback();
                      }),
                      // Gradient overlay
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black.withOpacity(0.3),
                                Colors.transparent,
                                AppColors.background.withOpacity(0.8),
                                AppColors.background,
                              ],
                              stops: const [0.0, 0.4, 0.8, 1.0],
                            ),
                          ),
                        ),
                      ),
                      // Center Play Floating Button
                      Center(
                        child: GestureDetector(
                          onTap: () => context.push('/player/${title.id}'),
                          child: Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.6),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white.withOpacity(0.8), width: 2),
                            ),
                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 36),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Title Meta & Actions
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title Text
                      Text(title.title, style: AppTypography.heroTitle(fontSize: 24)),
                      const SizedBox(height: 8),

                      // Meta Chips Row (Match %, Year, Maturity, Duration, 4K)
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            '${title.match}% Match',
                            style: AppTypography.badge.copyWith(color: AppColors.matchGreen),
                          ),
                          Text('${title.year}', style: AppTypography.bodySmall),
                          BadgeChip(label: title.maturity),
                          Text(title.durationString, style: AppTypography.bodySmall),
                          if (title.badges.isNotEmpty)
                            BadgeChip(label: title.badges.first),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Big Play Button
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            if (isSeries && title.episodes.isNotEmpty) {
                              final firstEp = title.episodes.first;
                              final epUrl = firstEp.videoUrl != null && firstEp.videoUrl!.isNotEmpty ? Uri.encodeComponent(firstEp.videoUrl!) : '';
                              context.push('/player/${title.id}?episode_id=${firstEp.id}&ep_title=${Uri.encodeComponent(firstEp.title)}${epUrl.isNotEmpty ? '&url=$epUrl' : ''}');
                            } else {
                              final movieUrl = title.videoUrl != null && title.videoUrl!.isNotEmpty ? Uri.encodeComponent(title.videoUrl!) : '';
                              context.push('/player/${title.id}${movieUrl.isNotEmpty ? '?url=$movieUrl' : ''}');
                            }
                          },
                          icon: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 28),
                          label: Text(
                            isSeries ? (title.episodes.isNotEmpty ? 'Play S1:E1' : 'Play Series') : 'Play Movie',
                            style: AppTypography.button.copyWith(color: Colors.black),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Download Button
                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            if (downloadStatus == DownloadStatus.notDownloaded) {
                              downloadsRepository.startDownload(title);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Downloading title for offline playback...')),
                              );
                            }
                          },
                          icon: Icon(
                            downloadStatus == DownloadStatus.downloaded
                                ? Icons.check_circle_rounded
                                : (downloadStatus == DownloadStatus.downloading
                                    ? Icons.downloading_rounded
                                    : Icons.download_rounded),
                            color: downloadStatus == DownloadStatus.downloaded ? AppColors.matchGreen : Colors.white,
                            size: 20,
                          ),
                          label: Text(
                            downloadStatus == DownloadStatus.downloaded
                                ? 'Downloaded (1.2 GB)'
                                : (downloadStatus == DownloadStatus.downloading ? 'Downloading...' : 'Download'),
                            style: AppTypography.button.copyWith(
                              color: downloadStatus == DownloadStatus.downloaded ? AppColors.matchGreen : Colors.white,
                              fontSize: 14,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: AppColors.surfaceElevated,
                            side: const BorderSide(color: AppColors.border),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Synopsis
                      Text(title.synopsis, style: AppTypography.body),
                      const SizedBox(height: 12),

                      // Cast & Director
                      if (title.cast.isNotEmpty)
                        RichText(
                          text: TextSpan(
                            style: AppTypography.bodySmall,
                            children: [
                              const TextSpan(text: 'Starring: ', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
                              TextSpan(text: title.cast.map((c) => c.name).join(', ')),
                            ],
                          ),
                        ),
                      if (title.director != null) ...[
                        const SizedBox(height: 4),
                        RichText(
                          text: TextSpan(
                            style: AppTypography.bodySmall,
                            children: [
                              const TextSpan(text: 'Director: ', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
                              TextSpan(text: title.director!),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),

                      // Action Toolbar: [My List] [Rate] [Share]
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildActionTool(
                            icon: isWatchlisted ? Icons.check_rounded : Icons.add_rounded,
                            label: 'My List',
                            isActive: isWatchlisted,
                            onTap: () {
                              ref.read(watchlistProvider.notifier).toggle(title);
                            },
                          ),
                          _buildActionTool(
                            icon: Icons.thumb_up_alt_outlined,
                            label: 'Rate',
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Thanks for rating!')),
                              );
                            },
                          ),
                          _buildActionTool(
                            icon: Icons.share_rounded,
                            label: 'Share',
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Link copied to clipboard')),
                              );
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const Divider(),
                    ],
                  ),
                ),
              ),

              // Tab Section: Episodes (if series) / More Like This
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isSeries) ...[
                        Text('Episodes', style: AppTypography.sectionTitle()),
                        const SizedBox(height: 12),
                        if (title.episodes.isNotEmpty)
                          ...title.episodes.map((ep) => _buildEpisodeItem(title, ep))
                        else
                          Container(
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Center(
                              child: Text(
                                'No episodes released yet for this series.',
                                style: AppTypography.bodySmall,
                              ),
                            ),
                          ),
                        const SizedBox(height: 24),
                      ],

                      Text('More Like This', style: AppTypography.sectionTitle()),
                      const SizedBox(height: 12),
                      _buildSimilarGrid(title.similar),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildActionTool({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: isActive ? AppColors.primary : Colors.white, size: 24),
          const SizedBox(height: 6),
          Text(
            label,
            style: AppTypography.bodySmall.copyWith(
              color: isActive ? AppColors.primary : AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEpisodeItem(TitleModel title, EpisodeModel ep) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Episode Thumbnail with Play Icon
              Stack(
                alignment: Alignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      width: 110,
                      height: 65,
                      color: AppColors.surfaceElevated,
                      child: Builder(
                        builder: (context) {
                          final thumbUrl = ep.thumbnailUrl != null && ep.thumbnailUrl!.trim().isNotEmpty
                              ? ApiConstants.resolveMediaUrl(ep.thumbnailUrl)
                              : '';
                          Widget buildFallback() {
                            return Image.asset(
                              title.backdropAssetPath,
                              fit: BoxFit.cover,
                              errorBuilder: (ctx, e, st) => Image.asset(
                                title.posterAssetPath,
                                fit: BoxFit.cover,
                                errorBuilder: (c, err, s) => const Icon(Icons.movie_rounded, color: AppColors.textMuted),
                              ),
                            );
                          }

                          if (thumbUrl.isNotEmpty) {
                            return CachedNetworkImage(
                              imageUrl: thumbUrl,
                              fit: BoxFit.cover,
                              placeholder: (ctx, url) => Container(color: AppColors.surfaceElevated),
                              errorWidget: (ctx, url, err) => buildFallback(),
                            );
                          }
                          return buildFallback();
                        },
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      final epUrl = ep.videoUrl != null && ep.videoUrl!.isNotEmpty ? Uri.encodeComponent(ep.videoUrl!) : '';
                      context.push('/player/${title.id}?episode_id=${ep.id}&ep_title=${Uri.encodeComponent(ep.title)}${epUrl.isNotEmpty ? '&url=$epUrl' : ''}');
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),

              // Episode Title & Runtime
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${ep.number}. ${ep.title}',
                      style: AppTypography.cardTitle.copyWith(fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text('${ep.runtime}m', style: AppTypography.bodySmall),
                  ],
                ),
              ),

              // Download Icon
              IconButton(
                icon: const Icon(Icons.download_rounded, color: AppColors.textSecondary, size: 22),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Downloading Episode ${ep.number}...')),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(ep.synopsis, style: AppTypography.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _buildSimilarGrid(List<String> similarIds) {
    final allTitlesAsync = ref.watch(titlesProvider);
    return allTitlesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (e, st) => const SizedBox.shrink(),
      data: (allTitles) {
        final similarTitles = allTitles.where((t) => similarIds.contains(t.id)).toList();
        if (similarTitles.isEmpty) {
          // Fallback to first 4 titles
          return const SizedBox.shrink();
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 2 / 3.4,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: similarTitles.length,
          itemBuilder: (context, index) {
            final item = similarTitles[index];
            return PosterCard(
              title: item,
              width: double.infinity,
              onTap: () => context.push('/title/${item.id}'),
            );
          },
        );
      },
    );
  }
}
