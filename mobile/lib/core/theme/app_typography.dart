import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTypography {
  // Display Font (for Cinematic Hero titles & dramatic headers)
  static TextStyle heroTitle({double fontSize = 32, FontWeight fontWeight = FontWeight.w800}) {
    return GoogleFonts.outfit(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: AppColors.textPrimary,
      letterSpacing: -0.5,
      height: 1.15,
    );
  }

  // Section Headers (e.g. "Trending in Tamil", "Continue Watching")
  static TextStyle sectionTitle({double fontSize = 18}) {
    return GoogleFonts.outfit(
      fontSize: fontSize,
      fontWeight: FontWeight.w700,
      color: AppColors.textPrimary,
      letterSpacing: -0.2,
    );
  }

  // Card Titles
  static TextStyle cardTitle = GoogleFonts.outfit(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.25,
  );

  // Body text
  static TextStyle body = GoogleFonts.outfit(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
    height: 1.45,
  );

  static TextStyle bodySmall = GoogleFonts.outfit(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
  );

  // Metadata / Badges (Runtime, Year, Maturity, 4K)
  static TextStyle badge = GoogleFonts.outfit(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
  );

  // Buttons
  static TextStyle button = GoogleFonts.outfit(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.2,
  );

  // Material Design compatibility aliases
  static TextStyle get titleLarge => sectionTitle(fontSize: 20);
  static TextStyle get bodyMedium => body;
}
