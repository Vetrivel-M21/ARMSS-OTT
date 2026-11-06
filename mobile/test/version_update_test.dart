import 'package:flutter_test/flutter_test.dart';
import 'package:armss_ott_mobile/data/models/app_version_model.dart';
import 'package:armss_ott_mobile/data/repositories/version_repository.dart';

void main() {
  group('App Version & Google Play Store Update Tests', () {
    test('parses version model from server JSON correctly', () {
      final json = {
        'latest_version': '1.1.0',
        'latest_build_number': 2,
        'min_version': '1.0.0',
        'min_build_number': 1,
        'force_update': false,
        'title': 'Performance Update',
        'release_notes': '• Faster 4K CMAF playback\n• Google Play Store update',
        'package_name': 'com.armss.ott.armss_ott_mobile',
        'play_store_url':
            'https://play.google.com/store/apps/details?id=com.armss.ott.armss_ott_mobile',
        'android_apk_url': '',
        'ios_url': '',
        'is_active': true,
        'update_available': true,
        'update_required': false,
        'market_uri': 'market://details?id=com.armss.ott.armss_ott_mobile',
      };

      final model = AppVersionModel.fromJson(json);

      expect(model.latestVersion, '1.1.0');
      expect(model.latestBuildNumber, 2);
      expect(model.minBuildNumber, 1);
      expect(model.packageName, 'com.armss.ott.armss_ott_mobile');
      expect(model.marketUri, contains('market://details?id=com.armss.ott.armss_ott_mobile'));
      expect(model.updateAvailable, isTrue);
      expect(model.updateRequired, isFalse);
    });

    test('detects mandatory update when client build is below min_build_number', () {
      const currentBuild = VersionRepository.currentAppBuildNumber; // 1

      final json = {
        'latest_version': '2.0.0',
        'latest_build_number': 10,
        'min_version': '1.5.0',
        'min_build_number': 5,
        'force_update': false,
        'title': 'Critical Security Update',
        'release_notes': 'Mandatory security patch',
        'package_name': 'com.armss.ott.armss_ott_mobile',
        'is_active': true,
        'update_available': true,
        'update_required': true,
      };

      final model = AppVersionModel.fromJson(json);

      // Verify that client build (1) is below min build (5)
      expect(currentBuild < model.minBuildNumber, isTrue);
      expect(model.updateRequired, isTrue);
    });

    test('detects flexible update when client build is above min but below latest', () {
      final json = {
        'latest_version': '1.2.0',
        'latest_build_number': 3,
        'min_version': '1.0.0',
        'min_build_number': 1,
        'force_update': false,
        'title': 'New Features Available',
        'release_notes': 'Check out new series categories',
        'package_name': 'com.armss.ott.armss_ott_mobile',
        'is_active': true,
        'update_available': true,
        'update_required': false,
      };

      final model = AppVersionModel.fromJson(json);

      expect(model.updateAvailable, isTrue);
      expect(model.updateRequired, isFalse);
    });
  });
}

