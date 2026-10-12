import 'package:flutter/material.dart';
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
            title: 'Manage Membership & Plan',
            subtitle: 'Renews on Nov 15, 2026 • ₹499/month',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Your subscription is active with Premium 4K + Dolby Atmos.')),
              );
            },
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
}
