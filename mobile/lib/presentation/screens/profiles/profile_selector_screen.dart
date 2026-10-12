import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/profile_model.dart';
import '../../../data/repositories/profile_repository.dart';

class ProfileSelectorScreen extends StatefulWidget {
  const ProfileSelectorScreen({super.key});

  @override
  State<ProfileSelectorScreen> createState() => _ProfileSelectorScreenState();
}

class _ProfileSelectorScreenState extends State<ProfileSelectorScreen> {
  List<ProfileModel> _profiles = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfiles();
  }

  Future<void> _loadProfiles() async {
    final list = await profileRepository.getProfiles();
    if (mounted) {
      setState(() {
        _profiles = list;
        _isLoading = false;
      });
    }
  }

  void _select(ProfileModel profile) async {
    await profileRepository.selectProfile(profile);
    if (mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'ARMSS OTT',
          style: AppTypography.heroTitle(fontSize: 18, fontWeight: FontWeight.w900).copyWith(
            color: AppColors.primary,
            letterSpacing: 2.0,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, color: AppColors.textSecondary, size: 20),
            onPressed: () {
              // Manage profiles
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      "Who's Watching?",
                      style: AppTypography.heroTitle(fontSize: 26, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Select a profile to continue streaming',
                      style: AppTypography.bodySmall,
                    ),
                    const SizedBox(height: 36),

                    // Profiles Grid
                    Wrap(
                      spacing: 24,
                      runSpacing: 24,
                      alignment: WrapAlignment.center,
                      children: [
                        ..._profiles.map((profile) {
                          Color avatarBg = AppColors.primary;
                          if (profile.avatarColor == '#38BDF8') avatarBg = AppColors.infoBlue;
                          if (profile.avatarColor == '#10B981') avatarBg = AppColors.matchGreen;

                          return GestureDetector(
                            onTap: () => _select(profile),
                            child: SizedBox(
                              width: 100,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Avatar box
                                  Container(
                                    width: 88,
                                    height: 88,
                                    decoration: BoxDecoration(
                                      color: avatarBg,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: Colors.white.withOpacity(0.2),
                                        width: 1.5,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: avatarBg.withOpacity(0.35),
                                          blurRadius: 16,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    alignment: Alignment.center,
                                    child: profile.isKids
                                        ? const Icon(Icons.child_care_rounded, size: 44, color: Colors.white)
                                        : Text(
                                            profile.name.isNotEmpty ? profile.name[0].toUpperCase() : 'U',
                                            style: const TextStyle(
                                              fontSize: 38,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.white,
                                            ),
                                          ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    profile.name,
                                    textAlign: TextAlign.center,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.cardTitle.copyWith(fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),

                        // Add Profile Button
                        GestureDetector(
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Add profile functionality available in Settings')),
                            );
                          },
                          child: SizedBox(
                            width: 100,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 88,
                                  height: 88,
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceElevated,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: AppColors.border,
                                      width: 1.5,
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Icon(Icons.add_rounded, size: 36, color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  'Add Profile',
                                  textAlign: TextAlign.center,
                                  style: AppTypography.cardTitle.copyWith(
                                    fontSize: 13,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
