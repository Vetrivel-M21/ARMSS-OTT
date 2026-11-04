import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => context.pop(),
        ),
        title: Text('Privacy Policy & Compliance', style: AppTypography.heroTitle(fontSize: 18)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Banner card
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
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                  ),
                  child: const Icon(Icons.shield_outlined, color: AppColors.primary, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ARMSS OTT Privacy Guarantee', style: AppTypography.cardTitle.copyWith(fontSize: 15)),
                      const SizedBox(height: 2),
                      Text('Aura Pictures · Compliant with DPDP & RBI', style: AppTypography.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Public web URLs info chip
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, color: AppColors.gold, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Public Compliance URL',
                        style: AppTypography.bodySmall.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      SelectableText(
                        'https://aurapictures.online/privacy',
                        style: AppTypography.bodySmall.copyWith(color: AppColors.gold),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, color: AppColors.textSecondary, size: 18),
                  tooltip: 'Copy URL',
                  onPressed: () {
                    Clipboard.setData(const ClipboardData(text: 'https://aurapictures.online/privacy'));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Privacy Policy URL copied to clipboard!')),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 1. Overview
          _buildPolicyCard(
            icon: Icons.info_outline_rounded,
            title: '1. Overview & Information We Collect',
            content:
                'ARMSS OTT collects minimal personal data required to provide seamless video streaming: your name, email, chosen profiles (including Kids profile protection), and device diagnostic data to optimize adaptive bitrate streaming (720p, 1080p, and 4K UHD).',
          ),

          // 2. Payments & Cashfree Security
          _buildPolicyCard(
            icon: Icons.payment_rounded,
            title: '2. Payment Security (Cashfree & Razorpay)',
            content:
                'All subscription transactions are processed directly through Reserve Bank of India (RBI) authorized payment gateways (Cashfree Payments and Razorpay). ARMSS OTT never stores or receives your complete credit/debit card numbers, CVV, or banking credentials. All checkouts adhere strictly to PCI-DSS Level 1 compliance standards.',
          ),

          // 3. Google Play Account Deletion
          _buildPolicyCard(
            icon: Icons.delete_forever_rounded,
            title: '3. Account & Data Deletion Rights',
            content:
                'In full compliance with Google Play Store policies, you may permanently delete your account and all associated watch history, profiles, and personal data at any time directly in the app (Settings > Delete Account) or online via our dedicated public portal at https://aurapictures.online/delete-account.',
          ),

          // 4. Data Security & Storage
          _buildPolicyCard(
            icon: Icons.lock_outline_rounded,
            title: '4. Encryption & Cloud Security',
            content:
                'All network communication utilizes 256-bit TLS encryption. Video assets and playback playlists are securely delivered via S3-compatible cloud storage with time-limited signed manifest tokens.',
          ),

          // 5. Contact & Grievance
          _buildPolicyCard(
            icon: Icons.email_outlined,
            title: '5. Grievance Officer Contact',
            content:
                'If you have questions regarding this Privacy Policy or wish to request personal data clarification, contact our Data Protection Officer at support@aurapictures.online. Inquiries are addressed within statutory timelines.',
          ),

          const SizedBox(height: 30),
          Center(
            child: Text(
              'ARMSS OTT · Aura Pictures © ${DateTime.now().year}\nAll rights reserved.',
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPolicyCard({
    required IconData icon,
    required String title,
    required String content,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(title, style: AppTypography.cardTitle.copyWith(fontSize: 14)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.45),
          ),
        ],
      ),
    );
  }
}

