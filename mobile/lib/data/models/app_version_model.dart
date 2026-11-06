class AppVersionModel {
  final String latestVersion;
  final int latestBuildNumber;
  final String minVersion;
  final int minBuildNumber;
  final bool forceUpdate;
  final String title;
  final String releaseNotes;
  final String packageName;
  final String playStoreUrl;
  final String androidApkUrl;
  final String iosUrl;
  final bool isActive;
  final bool updateAvailable;
  final bool updateRequired;
  final String marketUri;

  const AppVersionModel({
    required this.latestVersion,
    required this.latestBuildNumber,
    required this.minVersion,
    required this.minBuildNumber,
    required this.forceUpdate,
    required this.title,
    required this.releaseNotes,
    required this.packageName,
    required this.playStoreUrl,
    required this.androidApkUrl,
    required this.iosUrl,
    required this.isActive,
    required this.updateAvailable,
    required this.updateRequired,
    required this.marketUri,
  });

  factory AppVersionModel.fromJson(Map<String, dynamic> json) {
    return AppVersionModel(
      latestVersion: json['latest_version'] as String? ?? '1.0.0',
      latestBuildNumber: (json['latest_build_number'] as num?)?.toInt() ?? 1,
      minVersion: json['min_version'] as String? ?? '1.0.0',
      minBuildNumber: (json['min_build_number'] as num?)?.toInt() ?? 1,
      forceUpdate: json['force_update'] as bool? ?? false,
      title: json['title'] as String? ?? 'Update Available',
      releaseNotes: json['release_notes'] as String? ?? '',
      packageName: json['package_name'] as String? ?? 'com.armss.ott.armss_ott_mobile',
      playStoreUrl: json['play_store_url'] as String? ??
          'https://play.google.com/store/apps/details?id=com.armss.ott.armss_ott_mobile',
      androidApkUrl: json['android_apk_url'] as String? ?? '',
      iosUrl: json['ios_url'] as String? ?? '',
      isActive: json['is_active'] as bool? ?? true,
      updateAvailable: json['update_available'] as bool? ?? false,
      updateRequired: json['update_required'] as bool? ?? false,
      marketUri: json['market_uri'] as String? ??
          'market://details?id=com.armss.ott.armss_ott_mobile',
    );
  }
}

