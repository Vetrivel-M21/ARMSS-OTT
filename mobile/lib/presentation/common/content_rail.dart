import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../data/models/title_model.dart';
import 'poster_card.dart';

class ContentRail extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<TitleModel> items;
  final Function(TitleModel) onTitleTap;
  final bool isBackdrop;
  final bool isTop10;
  final Map<String, double>? progressMap; // for continue watching

  const ContentRail({
    super.key,
    required this.title,
    this.subtitle,
    required this.items,
    required this.onTitleTap,
    this.isBackdrop = false,
    this.isTop10 = false,
    this.progressMap,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final cardWidth = isBackdrop ? 200.0 : (isTop10 ? 140.0 : 124.0);
    // Calculated height based on aspect ratio + text
    final railHeight = isBackdrop ? 175.0 : 250.0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTypography.sectionTitle()),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!, style: AppTypography.bodySmall),
                    ],
                  ],
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: AppColors.textMuted.withOpacity(0.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Horizontal List
          SizedBox(
            height: railHeight,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              physics: const BouncingScrollPhysics(),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return PosterCard(
                  title: item,
                  width: cardWidth,
                  isBackdrop: isBackdrop,
                  rankNumber: isTop10 ? index + 1 : null,
                  watchProgress: progressMap?[item.id],
                  onTap: () => onTitleTap(item),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
