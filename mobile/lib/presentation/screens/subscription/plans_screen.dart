import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/storage/storage_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/plan_model.dart';
import '../../../data/models/user_model.dart';
import '../../../data/repositories/subscription_repository.dart';
import '../../../providers/auth_provider.dart';

final plansProvider = FutureProvider<List<PlanModel>>((ref) async {
  return await subscriptionRepository.getPlans();
});

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  bool _isAnnual = false;
  String? _upgradingTier;

  Future<void> _handleUpgrade(String tier) async {
    setState(() => _upgradingTier = tier);
    try {
      final updatedUser = await subscriptionRepository.upgradeSubscription(tier);
      ref.read(authProvider.notifier).updateUser(updatedUser);

      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.surfaceElevated,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: [
                const Icon(Icons.workspace_premium_rounded, color: AppColors.gold, size: 28),
                const SizedBox(width: 8),
                Text('Plan Activated!', style: AppTypography.cardTitle.copyWith(color: AppColors.gold)),
              ],
            ),
            content: Text(
              'Your account has been upgraded to ${tier.toUpperCase()}. You now have full access to high-definition streaming and multi-device playback!',
              style: AppTypography.bodySmall.copyWith(color: Colors.white70, height: 1.4),
            ),
            actions: [
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  context.pop();
                },
                child: const Text('Start Watching', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upgrade failed: $e'),
            backgroundColor: AppColors.liveRed,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _upgradingTier = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final currentTier = user?.subscriptionTier.toLowerCase() ?? 'free';
    final plansAsync = ref.watch(plansProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: Text('Subscription Plans', style: AppTypography.heroTitle(fontSize: 20)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: plansAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => Center(child: Text('Failed to load plans: $err', style: AppTypography.body)),
        data: (plans) {
          return ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            children: [
              // Header Tagline
              Center(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        'UNLIMITED CINEMA & ORIGINALS',
                        style: AppTypography.badge.copyWith(color: AppColors.gold, letterSpacing: 1.2),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Choose the plan that fits you best',
                      style: AppTypography.heroTitle(fontSize: 22),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Switch or cancel your subscription anytime.',
                      style: AppTypography.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Billing Interval Switch (Monthly vs Annual)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 24),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _isAnnual = false),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: !_isAnnual ? AppColors.primary : Colors.transparent,
                            borderRadius: BorderRadius.circular(25),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            'Monthly',
                            style: TextStyle(
                              color: !_isAnnual ? Colors.white : AppColors.textSecondary,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _isAnnual = true),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _isAnnual ? AppColors.primary : Colors.transparent,
                            borderRadius: BorderRadius.circular(25),
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Annual',
                                style: TextStyle(
                                  color: _isAnnual ? Colors.white : AppColors.textSecondary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.gold,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  '-20%',
                                  style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Plan Cards
              ...plans.map((p) => _buildPlanCard(p, currentTier, user)),

              const SizedBox(height: 20),

              // Cashfree Web Checkout Information Box
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shield_outlined, color: AppColors.primary, size: 20),
                        const SizedBox(width: 8),
                        Text('Cashfree Payment Gateway Support',
                            style: AppTypography.cardTitle.copyWith(fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Multi-device subscriptions (UPI, Cards, NetBanking) can also be completed securely on the web portal with zero platform surcharges.',
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.4),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primary),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        final token = await storageService.getToken();
                        final email = user?.email ?? '';
                        final query = <String>[];
                        if (token != null && token.isNotEmpty) query.add('token=${Uri.encodeComponent(token)}');
                        if (email.isNotEmpty) query.add('email=${Uri.encodeComponent(email)}');
                        final qStr = query.isNotEmpty ? '?${query.join("&")}' : '';
                        final url = 'https://${ApiConstants.defaultHost}/plans$qStr';
                        await Clipboard.setData(ClipboardData(text: url));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Auto-login web checkout link copied to clipboard! Open in any browser.'),
                              backgroundColor: AppColors.surfaceElevated,
                              duration: Duration(seconds: 4),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.open_in_browser_rounded, size: 16, color: AppColors.primary),
                      label: const Text('Copy Auto-Login Web Checkout Link',
                          style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPlanCard(PlanModel plan, String currentTier, UserModel? user) {
    final isCurrent = plan.tier == currentTier;
    final isPremium = plan.tier == 'premium';
    final isStandard = plan.tier == 'standard';
    final isUpgrading = _upgradingTier == plan.tier;

    final price = _isAnnual ? plan.priceAnnual : plan.priceMonthly;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isPremium
            ? AppColors.surfaceElevated
            : AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCurrent
              ? AppColors.matchGreen
              : (isPremium ? AppColors.gold.withValues(alpha: 0.6) : AppColors.border),
          width: (isCurrent || isPremium) ? 1.5 : 1.0,
        ),
        boxShadow: isPremium
            ? [
                BoxShadow(
                  color: AppColors.gold.withValues(alpha: 0.1),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isPremium
                  ? AppColors.gold.withValues(alpha: 0.12)
                  : Colors.white.withValues(alpha: 0.03),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(plan.name, style: AppTypography.heroTitle(fontSize: 17)),
                          if (isPremium) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.workspace_premium_rounded, color: AppColors.gold, size: 18),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(plan.resolution, style: AppTypography.bodySmall.copyWith(color: isPremium ? AppColors.gold : AppColors.textSecondary)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(price, style: AppTypography.heroTitle(fontSize: 18)),
                    if (isCurrent)
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.matchGreen.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.matchGreen.withValues(alpha: 0.6)),
                        ),
                        child: Text('CURRENT', style: AppTypography.badge.copyWith(color: AppColors.matchGreen, fontSize: 9)),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Features List
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildFeatureRow('${plan.devices} device${plan.devices > 1 ? "s" : ""} at the same time', true),
                _buildFeatureRow('Max Resolution: ${plan.resolution}', true),
                _buildFeatureRow('Ad-Free Cinema & Series', plan.adFree),
                _buildFeatureRow('Offline Video Downloads', plan.downloads),
                _buildFeatureRow('Live TV & Sports Streaming', plan.liveSports),
                _buildFeatureRow('Exclusive ARMSS Originals', plan.originals),
                const SizedBox(height: 16),

                // Action Button
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: isCurrent
                      ? OutlinedButton(
                          onPressed: null,
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Your Current Plan', style: TextStyle(color: Colors.white54)),
                        )
                      : ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isPremium
                                ? AppColors.gold
                                : (isStandard ? AppColors.primary : Colors.white24),
                            foregroundColor: isPremium ? Colors.black : Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: isUpgrading
                              ? null
                              : () => _handleUpgrade(plan.tier),
                          child: isUpgrading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : Text(
                                  plan.tier == 'free' ? 'Switch to Free' : 'Activate ${plan.name}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isPremium ? Colors.black : Colors.white,
                                  ),
                                ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureRow(String text, bool enabled) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle_rounded : Icons.cancel_outlined,
            color: enabled ? AppColors.matchGreen : Colors.white24,
            size: 16,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: AppTypography.bodySmall.copyWith(
                color: enabled ? Colors.white70 : Colors.white30,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

