import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiConstants {
  // Allow runtime override via flutter run --dart-define=API_URL=... or --dart-define=API_HOST=... or --dart-define=USE_HTTPS=true
  static const String envApiUrl = String.fromEnvironment('API_URL');
  static const String envApiHost = String.fromEnvironment('API_HOST');
  static const String envUseHttps = String.fromEnvironment('USE_HTTPS');

  // Live production domain and fallback settings
  static const String defaultHost = 'aurapictures.online';
  static const String serverPort = ''; // Standard port 80/443 (empty string avoids appending :port)

  // Dynamic scheme flag: allows seamless switching between HTTP and HTTPS if one protocol fails
  static bool useHttps = envUseHttps.isNotEmpty
      ? (envUseHttps.toLowerCase() == 'true')
      : envApiUrl.startsWith('https://');

  static String get serverHost {
    if (envApiHost.isNotEmpty) return envApiHost;
    if (kIsWeb) return 'localhost';
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      return 'localhost';
    }
    // Default to the live server domain on mobile devices
    return defaultHost;
  }

  static String get currentScheme => useHttps ? 'https' : 'http';
  static String get fallbackScheme => useHttps ? 'http' : 'https';

  static String get mediaBaseUrl {
    if (envApiUrl.isNotEmpty) {
      final stripped = envApiUrl.replaceAll(RegExp(r'/api/?$'), '');
      if (useHttps && stripped.startsWith('http://')) {
        return stripped.replaceFirst('http://', 'https://');
      } else if (!useHttps && stripped.startsWith('https://')) {
        return stripped.replaceFirst('https://', 'http://');
      }
      return stripped;
    }
    final portSuffix = serverPort.isNotEmpty ? ':$serverPort' : '';
    return '$currentScheme://$serverHost$portSuffix';
  }

  static String get baseUrl {
    if (envApiUrl.isNotEmpty && serverHost == defaultHost) {
      if (useHttps && envApiUrl.startsWith('http://')) {
        return envApiUrl.replaceFirst('http://', 'https://');
      } else if (!useHttps && envApiUrl.startsWith('https://')) {
        return envApiUrl.replaceFirst('https://', 'http://');
      }
      return envApiUrl;
    }
    return '$mediaBaseUrl/api';
  }

  /// Switch between HTTP and HTTPS dynamically when a fallback is needed
  static void toggleScheme() {
    useHttps = !useHttps;
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
