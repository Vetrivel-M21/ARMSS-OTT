import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/storage/storage_service.dart';
import '../../../data/repositories/profile_repository.dart';
import '../../../providers/auth_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _wifiOnly = true;
  bool _smartDownloads = true;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.value;
    final activeProfile = profileRepository.activeProfile;
    final displayName = (activeProfile != null && activeProfile.name.isNotEmpty)
        ? activeProfile.name
        : ((user != null && user.name.isNotEmpty)
            ? user.name
            : (storageService.getUserName() ?? 'ARMSS Member'));
    final email = (user != null && user.email.isNotEmpty) ? user.email : 'Streaming Account';
    final tier = (user != null && user.subscriptionTier.isNotEmpty)
        ? '${user.subscriptionTier.toUpperCase()} PLAN'
        : 'VIP STREAMING';
    final avatarLetter = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'A';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Account & Settings', style: AppTypography.heroTitle(fontSize: 20)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Profile Banner Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.surfaceElevated, AppColors.surfaceCard],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Text(avatarLetter, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName, style: AppTypography.cardTitle.copyWith(fontSize: 16)),
                      const SizedBox(height: 2),
                      Text(email, style: AppTypography.bodySmall),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.gold.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.gold.withOpacity(0.5)),
                        ),
                        child: Text(
                          tier,
                          style: AppTypography.badge.copyWith(color: AppColors.gold, fontSize: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz_rounded, color: Colors.white),
                  onPressed: () => context.go('/profiles'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Subscription & Plan
          Text('Subscription', style: AppTypography.sectionTitle(fontSize: 14)),
          const SizedBox(height: 8),
          _buildSettingsTile(
            icon: Icons.workspace_premium_rounded,
            title: 'Membership & Subscription',
            subtitle: '$tier • Tap to view details & web upgrade',
            onTap: () => _showSubscriptionDetailsModal(context, user),
          ),
          const SizedBox(height: 20),

          // Playback & Video Quality
          Text('Playback & Downloads', style: AppTypography.sectionTitle(fontSize: 14)),
          const SizedBox(height: 8),
          _buildSettingsTile(
            icon: Icons.hd_outlined,
            title: 'Streaming Video Quality',
            subtitle: 'Auto (High Definition)',
            onTap: () {},
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: const Icon(Icons.wifi_rounded, color: AppColors.textSecondary),
            title: Text('Download on Wi-Fi Only', style: AppTypography.cardTitle.copyWith(fontSize: 14)),
            subtitle: Text('Save mobile data during offline downloads', style: AppTypography.bodySmall),
            value: _wifiOnly,
            activeColor: AppColors.primary,
            onChanged: (val) => setState(() => _wifiOnly = val),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: const Icon(Icons.download_done_rounded, color: AppColors.textSecondary),
            title: Text('Smart Downloads', style: AppTypography.cardTitle.copyWith(fontSize: 14)),
            subtitle: Text('Automatically download next episode and delete watched', style: AppTypography.bodySmall),
            value: _smartDownloads,
            activeColor: AppColors.primary,
            onChanged: (val) => setState(() => _smartDownloads = val),
          ),
          const SizedBox(height: 20),

          // Security & App
          Text('Application', style: AppTypography.sectionTitle(fontSize: 14)),
          const SizedBox(height: 8),
          _buildSettingsTile(
            icon: Icons.delete_sweep_outlined,
            title: 'Clear Cache',
            subtitle: 'Free up 124 MB of cached data',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cache successfully cleared!')),
              );
            },
          ),
          _buildSettingsTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy & Terms of Service',
            onTap: () {},
          ),
          _buildSettingsTile(
            icon: Icons.info_outline_rounded,
            title: 'About ARMSS OTT',
            subtitle: 'v1.0.0 (Native Mobile Edition)',
            onTap: () {},
          ),
          const SizedBox(height: 24),

          // Sign Out Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (mounted) context.go('/login');
              },
              icon: const Icon(Icons.logout_rounded, color: AppColors.liveRed, size: 20),
              label: const Text('Sign Out', style: TextStyle(color: AppColors.liveRed, fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.liveRed),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
          const SizedBox(height: 60),
        ],
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: AppColors.textSecondary, size: 22),
        title: Text(title, style: AppTypography.cardTitle.copyWith(fontSize: 14)),
        subtitle: subtitle != null ? Text(subtitle, style: AppTypography.bodySmall) : null,
        trailing: const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textMuted, size: 14),
      ),
    );
  }

  void _showSubscriptionDetailsModal(BuildContext context, dynamic user) {
    final rawTier = (user != null && user.subscriptionTier.isNotEmpty)
        ? user.subscriptionTier.toLowerCase()
        : 'free';

    final isPremium = rawTier == 'premium';
    final isStandard = rawTier == 'standard';

    String planName;
    String resolution;
    String screens;
    List<String> features;

    if (isPremium) {
      planName = 'Premium VIP 4K';
      resolution = 'Up to 4K Ultra HD + HDR10';
      screens = '4 Screens simultaneously';
      features = [
        'Stream in pristine 4K UHD & HDR on supported screens',
        'Watch on 4 devices at the same time',
        'Zero ad breaks across all movies & series',
        'Exclusive early premiere access & originals',
        'Offline downloads enabled',
      ];
    } else if (isStandard) {
      planName = 'Standard Full HD';
      resolution = '1080p Full HD';
      screens = '2 Screens simultaneously';
      features = [
        'Stream in crisp 1080p Full HD',
        'Watch on 2 devices simultaneously',
        'Ad-free entertainment catalog',
        'Access to full Tamil movie and series library',
      ];
    } else {
      planName = 'Free Member Plan';
      resolution = '720p HD';
      screens = '1 Screen';
      features = [
        'Access to curated free Tamil catalog',
        'Standard 720p HD streaming',
        '1 screen at a time',
        'Ad-supported playback',
      ];
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Drag Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  // Header with Badge
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.gold.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.workspace_premium_rounded, color: AppColors.gold, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(planName, style: AppTypography.heroTitle(fontSize: 18)),
                            const SizedBox(height: 2),
                            Text('$resolution • $screens', style: AppTypography.bodySmall),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Current Tier Benefits
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Plan Features', style: AppTypography.cardTitle.copyWith(fontSize: 13, color: AppColors.textSecondary)),
                        const SizedBox(height: 10),
                        ...features.map((f) => Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: AppColors.matchGreen, size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text(f, style: AppTypography.bodySmall.copyWith(color: Colors.white70))),
                                ],
                              ),
                            )),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Web-Only Upgrade Notice Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withOpacity(0.12),
                          AppColors.surfaceElevated,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.primary.withOpacity(0.35)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 18),
                            const SizedBox(width: 8),
                            Text('How to Upgrade or Manage Plan',
                                style: AppTypography.cardTitle.copyWith(fontSize: 14, color: AppColors.primary)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'To ensure seamless multi-device streaming across Web, Mobile, and TV without app store markups, subscriptions are managed exclusively on our web portal.',
                          style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.4),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '1. Open your web browser and visit armss-ott.com\n'
                          '2. Sign in with ${user?.email ?? "your streaming account"}\n'
                          '3. Go to Plans and choose Standard or VIP 4K\n'
                          '4. Reopen this mobile app to instantly enjoy VIP access',
                          style: AppTypography.bodySmall.copyWith(color: Colors.white70, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Copy Link Button
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Clipboard.setData(const ClipboardData(text: 'https://armss-ott.com/plans'));
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Website link copied: https://armss-ott.com/plans'),
                            backgroundColor: AppColors.surfaceElevated,
                            duration: Duration(seconds: 3),
                          ),
                        );
                      },
                      icon: const Icon(Icons.copy_rounded, size: 18),
                      label: const Text('Copy Website Link (armss-ott.com)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Close', style: TextStyle(color: AppColors.textMuted)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
