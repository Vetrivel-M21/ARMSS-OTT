import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiConstants {
  // Allow runtime override via flutter run --dart-define=API_URL=... or --dart-define=API_HOST=...
  static const String envApiUrl = String.fromEnvironment('API_URL');
  static const String envApiHost = String.fromEnvironment('API_HOST');

  // Local network IP for physical device testing on same Wi-Fi
  static const String defaultLanHost = '10.10.100.30';
  static const String serverPort = '8081';

  static String get serverHost {
    if (envApiHost.isNotEmpty) return envApiHost;
    if (kIsWeb) return 'localhost';
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      return 'localhost';
    }
    // Mobile devices (physical Android/iOS or emulator if configured)
    return defaultLanHost;
  }

  static String get baseUrl {
    if (envApiUrl.isNotEmpty) return envApiUrl;
    return 'http://$serverHost:$serverPort/api';
  }

  static String get mediaBaseUrl {
    return 'http://$serverHost:$serverPort';
  }

  static String resolveMediaUrl(String? path) {
    if (path == null || path.trim().isEmpty) return '';
    final trimmed = path.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '$mediaBaseUrl$trimmed';
    }
    return '$mediaBaseUrl/$trimmed';
  }

  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String registerSendOtp = '/auth/register/send-otp';
  static const String registerVerifyOtp = '/auth/register/verify-otp';
  static const String googleAuth = '/auth/google';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String me = '/auth/me';

  static const String titles = '/titles';
  static const String profiles = '/profiles';
  static const String myList = '/my-list';
  static const String history = '/history';
  static const String playbackTicket = '/playback-ticket';
  static const String progressHeartbeat = '/progress/heartbeat';
  static const String search = '/search';
  static const String subscriptionPlans = '/subscription/plans';
  static const String subscriptionCheckout = '/subscription/checkout';
  static const String settingsLayout = '/settings/layout';

  // Video Playback & ABR Endpoints
  static String videoPlayback(String id) => '/videos/$id/playback';
  static String videoProgress(String id) => '/videos/$id/progress';
  static String videoHeartbeat(String id) => '/videos/$id/heartbeat';
}
