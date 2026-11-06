import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../models/app_version_model.dart';

class VersionRepository {
  static const int currentAppBuildNumber = 1;
  static const String currentAppVersion = '1.0.0';

  Future<AppVersionModel?> checkAppVersion() async {
    try {
      final response = await apiClient.get(
        '${ApiConstants.appVersion}?build=$currentAppBuildNumber',
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : Map<String, dynamic>.from(response.data as Map);
        return AppVersionModel.fromJson(data);
      }
    } catch (_) {
      // In case of network error or server unreachable, fail gracefully without blocking
    }
    return null;
  }

  /// Opens the Google Play Store update link with deep-link fallback
  Future<void> openStore(BuildContext context, AppVersionModel version) async {
    final playUrl = version.playStoreUrl.isNotEmpty
        ? version.playStoreUrl
        : 'https://play.google.com/store/apps/details?id=${version.packageName}';

    // 1. Copy link to clipboard for convenience
    await Clipboard.setData(ClipboardData(text: playUrl));

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Redirecting to Google Play Store (${version.packageName})...'),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

final versionRepository = VersionRepository();

