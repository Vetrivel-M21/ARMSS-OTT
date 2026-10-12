import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/title_model.dart';
import '../../../providers/catalog_provider.dart';
import '../../common/badge_chip.dart';

class LiveTvScreen extends ConsumerStatefulWidget {
  const LiveTvScreen({super.key});

  @override
  ConsumerState<LiveTvScreen> createState() => _LiveTvScreenState();
}

class _LiveTvScreenState extends ConsumerState<LiveTvScreen> {
  TitleModel? _selectedChannel;

  @override
  Widget build(BuildContext context) {
    final liveChannelsAsync = ref.watch(liveChannelsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.liveRed,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text('Live TV Channels', style: AppTypography.heroTitle(fontSize: 18)),
          ],
        ),
      ),
      body: liveChannelsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, st) => Center(child: Text('Error loading channels: $err', style: AppTypography.body)),
        data: (channels) {
          if (channels.isEmpty) {
            return Center(child: Text('No live channels active', style: AppTypography.cardTitle));
          }

          final active = _selectedChannel ?? channels.first;

          return SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Live Channel Banner with Play Tap
                GestureDetector(
                  onTap: () => context.push('/player/${active.id}'),
                  child: Container(
                    height: 220,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(
                          active.backdropAssetPath,
                          fit: BoxFit.cover,
                          errorBuilder: (ctx, e, st) => Container(color: AppColors.surfaceElevated),
                        ),
                        // Gradient
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.transparent, Colors.black.withOpacity(0.85)],
                              ),
                            ),
                          ),
                        ),
                        // Live badge top left
                        const Positioned(
                          top: 12,
                          left: 12,
                          child: BadgeChip(label: 'LIVE 24x7', isLive: true),
                        ),
                        // Center Play Button
                        Center(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.9),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 36),
                          ),
                        ),
                        // Channel details bottom
                        Positioned(
                          bottom: 12,
                          left: 14,
                          right: 14,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(active.title, style: AppTypography.cardTitle.copyWith(fontSize: 16)),
                              const SizedBox(height: 2),
                              Text('Kayal • Prime Time Mega Serial', style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // EPG Schedule Strip
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Today\'s Schedule (EPG)', style: AppTypography.sectionTitle(fontSize: 15)),
                      const SizedBox(height: 10),
                      _buildEpgSlots(),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Channel Selector List
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text('All Channels', style: AppTypography.sectionTitle(fontSize: 15)),
                ),
                const SizedBox(height: 10),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: channels.length,
                  itemBuilder: (context, index) {
                    final ch = channels[index];
                    final isSelected = ch.id == active.id;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.surfaceElevated : AppColors.surfaceCard,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.border,
                          width: isSelected ? 1.5 : 0.8,
                        ),
                      ),
                      child: ListTile(
                        onTap: () {
                          setState(() => _selectedChannel = ch);
                        },
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: SizedBox(
                            width: 60,
                            height: 40,
                            child: Image.asset(
                              ch.posterAssetPath,
                              fit: BoxFit.cover,
                              errorBuilder: (c, e, s) => Container(color: AppColors.surfaceElevated),
                            ),
                          ),
                        ),
                        title: Text(ch.title, style: AppTypography.cardTitle.copyWith(fontSize: 14)),
                        subtitle: Text('Tamil • Entertainment', style: AppTypography.bodySmall),
                        trailing: ElevatedButton(
                          onPressed: () => context.push('/player/${ch.id}'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            minimumSize: Size.zero,
                          ),
                          child: const Text('Watch', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 80),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEpgSlots() {
    final slots = [
      {'label': 'NOW PLAYING', 'time': '12:30 PM', 'title': 'Kayal Serial (Ep 842)', 'active': true},
      {'label': 'NEXT', 'time': '01:00 PM', 'title': 'Singapennae (Ep 420)', 'active': false},
      {'label': '01:30 PM', 'time': '01:30 PM', 'title': 'Sun News Live Bulletin', 'active': false},
    ];

    return Row(
      children: slots.map((s) {
        final isActive = s['active'] == true;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isActive ? AppColors.primary.withOpacity(0.12) : AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isActive ? AppColors.primary.withOpacity(0.5) : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      s['label'] as String,
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: isActive ? AppColors.primary : AppColors.textMuted,
                      ),
                    ),
                    Text(s['time'] as String, style: const TextStyle(fontSize: 9, color: AppColors.textMuted)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  s['title'] as String,
                  style: AppTypography.cardTitle.copyWith(fontSize: 11),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (isActive) ...[
                  const SizedBox(height: 6),
                  LinearProgressIndicator(
                    value: 0.65,
                    backgroundColor: AppColors.surfaceElevated,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 2,
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
