import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/repositories/downloads_repository.dart';
import '../../../providers/watchlist_provider.dart';
import '../../../providers/downloads_provider.dart';
import '../../common/poster_card.dart';

class WatchlistScreen extends ConsumerStatefulWidget {
  const WatchlistScreen({super.key});

  @override
  ConsumerState<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends ConsumerState<WatchlistScreen> with SingleTickerProviderStateMixin {
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
    final watchlist = ref.watch(watchlistProvider);
    final downloads = ref.watch(downloadedItemsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('My Space', style: AppTypography.heroTitle(fontSize: 20)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textMuted,
          tabs: [
            Tab(text: 'Watchlist (${watchlist.length})'),
            Tab(text: 'Downloads (${downloads.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Watchlist
          watchlist.isEmpty
              ? _buildEmptyWatchlist()
              : GridView.builder(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 2 / 3.4,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: watchlist.length,
                  itemBuilder: (context, index) {
                    final item = watchlist[index];
                    return PosterCard(
                      title: item,
                      width: double.infinity,
                      onTap: () => context.push('/title/${item.id}'),
                    );
                  },
                ),

          // Tab 2: Downloads
          _buildDownloadsTab(downloads),
        ],
      ),
    );
  }

  Widget _buildEmptyWatchlist() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.bookmark_border_rounded, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text('Your Watchlist is Empty', style: AppTypography.cardTitle),
          const SizedBox(height: 6),
          Text('Explore movies & series and tap + My List to save them', style: AppTypography.bodySmall),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => context.go('/home'),
            child: const Text('Explore Titles'),
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadsTab(List<DownloadItem> downloads) {
    if (downloads.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_download_outlined, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text('No Offline Downloads', style: AppTypography.cardTitle),
            const SizedBox(height: 6),
            Text('Download your favourite titles to watch without internet', style: AppTypography.bodySmall),
          ],
        ),
      );
    }

    final totalMb = downloads.fold<double>(0, (sum, item) => sum + item.sizeMb);
    final totalGbStr = (totalMb / 1024).toStringAsFixed(1);

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        // Storage Header
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              const Icon(Icons.storage_rounded, color: AppColors.gold, size: 28),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Device Storage Used', style: AppTypography.cardTitle.copyWith(fontSize: 13)),
                  const SizedBox(height: 2),
                  Text('$totalGbStr GB used by ARMSS OTT', style: AppTypography.bodySmall),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        ...downloads.map((item) {
          final isDone = item.status == DownloadStatus.downloaded;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: SizedBox(
                    width: 70,
                    height: 48,
                    child: Image.asset(
                      item.poster,
                      fit: BoxFit.cover,
                      errorBuilder: (c, e, s) => Container(color: AppColors.surface),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.titleName, style: AppTypography.cardTitle.copyWith(fontSize: 13)),
                      const SizedBox(height: 4),
                      Text(
                        isDone ? '${(item.sizeMb / 1024).toStringAsFixed(1)} GB • Offline Ready' : 'Downloading... ${(item.progress * 100).toInt()}%',
                        style: AppTypography.bodySmall.copyWith(
                          color: isDone ? AppColors.matchGreen : AppColors.gold,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isDone)
                  IconButton(
                    icon: const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 28),
                    onPressed: () => context.push('/player/${item.titleId}'),
                  ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: AppColors.textMuted, size: 22),
                  onPressed: () {
                    downloadsRepository.removeDownload(item.titleId);
                  },
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
