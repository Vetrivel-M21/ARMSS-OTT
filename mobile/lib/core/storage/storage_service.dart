import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const String _tokenKey = 'armss_ott_token';
  static const String _activeProfileKey = 'armss_ott_active_profile';
  static const String _watchlistKey = 'armss_ott_local_watchlist';

  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Token management
  Future<void> saveToken(String token) async {
    await _prefs.setString(_tokenKey, token);
  }

  Future<String?> getToken() async {
    return _prefs.getString(_tokenKey);
  }

  Future<void> clearToken() async {
    await _prefs.remove(_tokenKey);
  }

  // User details persistence
  static const String _userNameKey = 'armss_ott_user_name';
  Future<void> saveUserName(String name) async {
    await _prefs.setString(_userNameKey, name);
  }

  String? getUserName() {
    return _prefs.getString(_userNameKey);
  }

  // Active Profile ID
  Future<void> setActiveProfileId(String profileId) async {
    await _prefs.setString(_activeProfileKey, profileId);
  }

  String? getActiveProfileId() {
    return _prefs.getString(_activeProfileKey);
  }

  // Local Watchlist (Offline sync cache)
  List<String> getLocalWatchlist() {
    return _prefs.getStringList(_watchlistKey) ?? [];
  }

  Future<void> toggleLocalWatchlist(String titleId) async {
    List<String> list = getLocalWatchlist().toList();
    if (list.contains(titleId)) {
      list.remove(titleId);
    } else {
      list.add(titleId);
    }
    await _prefs.setStringList(_watchlistKey, list);
  }

  bool isInWatchlist(String titleId) {
    return getLocalWatchlist().contains(titleId);
  }

  // Clear all session data on logout
  Future<void> clearSession() async {
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_activeProfileKey);
    await _prefs.remove(_userNameKey);
  }

  // Persistent Device ID
  static const String _deviceIdKey = 'armss_ott_device_id';

  Future<String> getOrCreateDeviceId() async {
    String? devId = _prefs.getString(_deviceIdKey);
    if (devId == null || devId.isEmpty) {
      devId = 'mobile-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
      await _prefs.setString(_deviceIdKey, devId);
    }
    return devId;
  }
}

// Global singleton instance for easy access
final storageService = StorageService();
