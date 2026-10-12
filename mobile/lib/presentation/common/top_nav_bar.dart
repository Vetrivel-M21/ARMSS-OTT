import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';

class TopNavBar extends StatelessWidget {
  final String activeCategory;
  final Function(String) onCategorySelected;
  final VoidCallback onProfileTap;
  final VoidCallback onSearchTap;

  const TopNavBar({
    super.key,
    required this.activeCategory,
    required this.onCategorySelected,
    required this.onProfileTap,
    required this.onSearchTap,
  });

  @override
  Widget build(BuildContext context) {
    final categories = ['All', 'Movies', 'Series', 'Live TV'];

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.55),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withOpacity(0.92),
                Colors.black.withOpacity(0.75),
                Colors.black.withOpacity(0.40),
              ],
            ),
          ),
          child: SafeArea(
            bottom: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Row: Brand & Actions
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  // Brand Logo / Monogram
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      'ARMSS',
                      style: AppTypography.badge.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'OTT',
                    style: AppTypography.heroTitle(fontSize: 16, fontWeight: FontWeight.w900).copyWith(
                      color: AppColors.gold,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const Spacer(),

                  // Cast icon
                  IconButton(
                    icon: const Icon(Icons.cast_rounded, size: 21, color: AppColors.textPrimary),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Searching for Google Cast / AirPlay devices...'),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    },
                  ),

                  // Search icon
                  IconButton(
                    icon: const Icon(Icons.search_rounded, size: 24, color: AppColors.textPrimary),
                    onPressed: onSearchTap,
                  ),

                  const SizedBox(width: 4),

                  // User Avatar
                  GestureDetector(
                    onTap: onProfileTap,
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.white.withOpacity(0.2), width: 1.2),
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        'V',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Category Filter Pills
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
              child: Row(
                children: categories.map((cat) {
                  final isSelected = activeCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => onCategorySelected(cat),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? Colors.white : AppColors.surfaceElevated.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected ? Colors.white : AppColors.border,
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          cat,
                          style: TextStyle(
                            color: isSelected ? Colors.black : AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    )
      )
    );
  }
}
