import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/constants/api_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../data/models/title_model.dart';
import 'badge_chip.dart';

class PosterCard extends StatelessWidget {
  final TitleModel title;
  final VoidCallback onTap;
  final double width;
  final bool isBackdrop;
  final int? rankNumber;
  final double? watchProgress; // 0.0 to 1.0

  const PosterCard({
    super.key,
    required this.title,
    required this.onTap,
    this.width = 130,
    this.isBackdrop = false,
    this.rankNumber,
    this.watchProgress,
  });

  @override
  Widget build(BuildContext context) {
    final double aspectRatio = isBackdrop ? (16 / 9) : (2 / 3);
    final assetPath = isBackdrop ? title.backdropAssetPath : title.posterAssetPath;

    final rawUrl = isBackdrop ? (title.backdrop ?? title.poster) : (title.poster ?? title.backdrop);
    final networkUrl = ApiConstants.resolveMediaUrl(rawUrl);

    Widget buildPlaceholder() {
      return Container(
        color: AppColors.surfaceElevated,
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              title.title.isNotEmpty ? title.title[0] : '?',
              style: AppTypography.heroTitle(fontSize: 32).copyWith(color: AppColors.textMuted),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                title.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.bodySmall,
              ),
            ),
          ],
        ),
      );
    }

    Widget buildAssetImage() {
      return Image.asset(
        assetPath,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => buildPlaceholder(),
      );
    }

    Widget imageWidget = networkUrl.isNotEmpty
        ? CachedNetworkImage(
            imageUrl: networkUrl,
            fit: BoxFit.cover,
            placeholder: (context, url) => Container(color: AppColors.surfaceElevated),
            errorWidget: (context, url, error) => buildAssetImage(),
          )
        : buildAssetImage();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                // Image container
                AspectRatio(
                  aspectRatio: aspectRatio,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border, width: 0.8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        imageWidget,

                        // Gradient shadow at bottom of card
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.transparent,
                                  Colors.black.withOpacity(0.6),
                                ],
                                stops: const [0.7, 1.0],
                              ),
                            ),
                          ),
                        ),

                        // Badges top right
                        if (title.kind == 'live')
                          const Positioned(
                            top: 6,
                            right: 6,
                            child: BadgeChip(label: 'LIVE', isLive: true),
                          )
                        else if (title.original)
                          const Positioned(
                            top: 6,
                            left: 6,
                            child: BadgeChip(label: 'ARMSS', isGold: true),
                          ),

                        // Progress bar if continue watching
                        if (watchProgress != null)
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: LinearProgressIndicator(
                              value: watchProgress,
                              backgroundColor: AppColors.surfaceElevated,
                              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                              minHeight: 3.5,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // Top 10 Rank Number (styled like Netflix bold outline rank)
                if (rankNumber != null)
                  Positioned(
                    bottom: -10,
                    left: -14,
                    child: Text(
                      '$rankNumber',
                      style: TextStyle(
                        fontSize: 72,
                        fontWeight: FontWeight.w900,
                        color: AppColors.background,
                        shadows: [
                          Shadow(
                            color: AppColors.textPrimary.withOpacity(0.85),
                            offset: const Offset(1, 1),
                            blurRadius: 2,
                          ),
                          Shadow(
                            color: Colors.black.withOpacity(0.9),
                            offset: const Offset(3, 3),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            // Title text
            Text(
              title.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.cardTitle,
            ),
            const SizedBox(height: 2),
            // Subtitle metadata
            Row(
              children: [
                Text(
                  '${title.year}',
                  style: AppTypography.bodySmall,
                ),
                const SizedBox(width: 6),
                Text(
                  '•',
                  style: AppTypography.bodySmall,
                ),
                const SizedBox(width: 6),
                Text(
                  title.maturity,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
