import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

class BadgeChip extends StatelessWidget {
  final String label;
  final bool isLive;
  final bool isGold;

  const BadgeChip({
    super.key,
    required this.label,
    this.isLive = false,
    this.isGold = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg = AppColors.surfaceElevated;
    Color border = AppColors.border;
    Color textColor = AppColors.textSecondary;

    if (isLive || label.toUpperCase() == 'LIVE') {
      bg = AppColors.liveRed.withOpacity(0.18);
      border = AppColors.liveRed.withOpacity(0.5);
      textColor = AppColors.liveRed;
    } else if (isGold || label.toUpperCase() == 'ORIGINAL') {
      bg = AppColors.gold.withOpacity(0.15);
      border = AppColors.gold.withOpacity(0.4);
      textColor = AppColors.gold;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: border, width: 0.8),
      ),
      child: Text(
        label,
        style: AppTypography.badge.copyWith(
          color: textColor,
          fontSize: 10,
        ),
      ),
    );
  }
}
