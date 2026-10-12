import 'package:flutter/material.dart';

class AppColors {
  // Backgrounds - Obsidian & Cinema Dark
  static const Color background = Color(0xFF0E0F14);
  static const Color surface = Color(0xFF161822);
  static const Color surfaceElevated = Color(0xFF1E2130);
  static const Color surfaceCard = Color(0xFF141620);
  static const Color border = Color(0xFF272A3D);
  static const Color borderSubtle = Color(0xFF1B1E2B);

  // Brand Accents
  static const Color primary = Color(0xFFE50914); // Cinema Crimson
  static const Color primaryLight = Color(0xFFFF2E3D);
  static const Color primaryDark = Color(0xFFB20710);
  static const Color gold = Color(0xFFF59E0B); // Premium Tier Gold
  static const Color goldLight = Color(0xFFFBBF24);

  // Status & Badges
  static const Color liveRed = Color(0xFFEF4444);
  static const Color matchGreen = Color(0xFF22C55E);
  static const Color infoBlue = Color(0xFF38BDF8);
  static const Color warning = Color(0xFFF97316);

  // Text Colors
  static const Color textPrimary = Color(0xFFF8F8FC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDark = Color(0xFF334155);

  // Gradients
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.transparent,
      Color(0x660E0F14),
      Color(0xCC0E0F14),
      Color(0xFF0E0F14),
    ],
    stops: [0.0, 0.45, 0.8, 1.0],
  );

  static const LinearGradient posterShadow = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.transparent,
      Color(0x40000000),
      Color(0xDD0E0F14),
    ],
    stops: [0.3, 0.7, 1.0],
  );

  static const LinearGradient brandButtonGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [
      Color(0xFFE50914),
      Color(0xFFFF3344),
    ],
  );
}
