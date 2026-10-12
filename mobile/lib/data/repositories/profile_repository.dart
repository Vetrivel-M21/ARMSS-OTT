import '../models/profile_model.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/storage_service.dart';
import '../../core/constants/api_constants.dart';

class ProfileRepository {
  List<ProfileModel> _profiles = [];
  ProfileModel? _activeProfile;

  ProfileModel? get activeProfile => _activeProfile;

  void setInitialProfiles(List<ProfileModel> profiles) {
    if (profiles.isNotEmpty) {
      _profiles = profiles;
      _restoreActiveProfile();
    }
  }

  Future<List<ProfileModel>> getProfiles() async {
    try {
      final response = await apiClient.get(ApiConstants.profiles);
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data is List ? response.data : (response.data['profiles'] ?? []);
        _profiles = list.map((e) => ProfileModel.fromJson(Map<String, dynamic>.from(e))).toList();
        _restoreActiveProfile();
        return _profiles;
      }
    } catch (_) {
      // Offline fallback
    }

    if (_profiles.isEmpty) {
      final savedName = storageService.getUserName();
      final userName = (savedName != null && savedName.trim().isNotEmpty) ? savedName.trim() : 'Personal';
      _profiles = [
        ProfileModel(
          id: 'p_1',
          userId: 'u_1',
          name: userName,
          avatarColor: '#E50914',
          isKids: false,
        ),
        ProfileModel(
          id: 'p_2',
          userId: 'u_1',
          name: 'Home / Living Room',
          avatarColor: '#38BDF8',
          isKids: false,
        ),
        ProfileModel(
          id: 'p_3',
          userId: 'u_1',
          name: 'Kids Zone',
          avatarColor: '#10B981',
          isKids: true,
        ),
      ];
    }

    _restoreActiveProfile();
    return _profiles;
  }

  void _restoreActiveProfile() {
    final activeId = storageService.getActiveProfileId();
    if (activeId != null) {
      _activeProfile = _profiles.firstWhere(
        (p) => p.id == activeId,
        orElse: () => _profiles.first,
      );
    } else if (_profiles.isNotEmpty) {
      _activeProfile = _profiles.first;
    }
  }

  Future<void> selectProfile(ProfileModel profile) async {
    _activeProfile = profile;
    await storageService.setActiveProfileId(profile.id);
  }
}

final profileRepository = ProfileRepository();
