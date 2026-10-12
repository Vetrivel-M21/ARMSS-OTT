import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models/user_model.dart';
import '../models/profile_model.dart';
import 'profile_repository.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/storage_service.dart';
import '../../core/constants/api_constants.dart';

class AuthRepository {
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: '91550463965-ktb1qff856pg0miit1ns607r3ehvuvvv.apps.googleusercontent.com',
    serverClientId: '91550463965-0lmm9iu9h5fes5i3lh7qhme986s4va6u.apps.googleusercontent.com',
    scopes: ['email', 'profile'],
  );
  UserModel? _currentUser;

  UserModel? get currentUser => _currentUser;

  Future<UserModel?> checkCurrentUser() async {
    final token = await storageService.getToken();
    if (token == null || token.isEmpty) {
      _currentUser = null;
      return null;
    }

    try {
      final response = await apiClient.get(ApiConstants.me);
      if (response.statusCode == 200 && response.data != null) {
        final userData = response.data['user'] ?? response.data;
        _currentUser = UserModel.fromJson(Map<String, dynamic>.from(userData));
        await storageService.saveUserName(_currentUser!.name);
        return _currentUser;
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        // Token expired or invalid, invalidate local token
        await storageService.clearToken();
        _currentUser = null;
        return null;
      }
    } catch (_) {
      // Offline / network failure: keep current cached session if present
    }
    return _currentUser;
  }

  Future<UserModel> login({required String email, required String password}) async {
    try {
      final response = await apiClient.post(
        ApiConstants.login,
        data: {
          'identifier': email,
          'email': email,
          'password': password,
        },
      );

      final token = response.data['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        await storageService.saveToken(token);
      }

      final userData = response.data['user'] ?? response.data;
      _currentUser = UserModel.fromJson(Map<String, dynamic>.from(userData));
      await storageService.saveUserName(_currentUser!.name);

      // Cache returned profiles if provided in AuthResponse
      if (response.data['profiles'] != null && response.data['profiles'] is List) {
        final profilesList = (response.data['profiles'] as List)
            .map((p) => ProfileModel.fromJson(Map<String, dynamic>.from(p)))
            .toList();
        profileRepository.setInitialProfiles(profilesList);
      }

      return _currentUser!;
    } on DioException catch (dioErr) {
      String message = 'Login failed. Please check your credentials.';
      if (dioErr.response?.data != null) {
        final data = dioErr.response!.data;
        if (data is Map && data['error'] != null) {
          message = data['error'].toString();
        } else if (data is String && data.isNotEmpty) {
          message = data;
        }
      } else if (dioErr.type == DioExceptionType.connectionTimeout ||
          dioErr.type == DioExceptionType.receiveTimeout) {
        message = 'Connection timed out. Server unreachable.';
      } else if (dioErr.type == DioExceptionType.connectionError) {
        message = 'Cannot connect to server at ${ApiConstants.baseUrl}. Make sure backend is running.';
      }
      throw Exception(message);
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<UserModel> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw Exception('Google sign-in was cancelled');
      }

      final googleAuth = await googleUser.authentication;
      final credential = googleAuth.idToken ?? googleAuth.accessToken ?? '';

      final response = await apiClient.post(
        ApiConstants.googleAuth,
        data: {
          'credential': credential,
          'email': googleUser.email,
          'name': googleUser.displayName ?? '',
          'avatar': googleUser.photoUrl ?? '',
        },
      );

      final token = response.data['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        await storageService.saveToken(token);
      }

      final userData = response.data['user'] ?? response.data;
      _currentUser = UserModel.fromJson(Map<String, dynamic>.from(userData));
      await storageService.saveUserName(_currentUser!.name);

      if (response.data['profiles'] != null && response.data['profiles'] is List) {
        final profilesList = (response.data['profiles'] as List)
            .map((p) => ProfileModel.fromJson(Map<String, dynamic>.from(p)))
            .toList();
        profileRepository.setInitialProfiles(profilesList);
      }

      return _currentUser!;
    } on DioException catch (dioErr) {
      String message = 'Google sign-in failed. Please try again.';
      if (dioErr.response?.data != null) {
        final data = dioErr.response!.data;
        if (data is Map && data['error'] != null) {
          message = data['error'].toString();
        } else if (data is String && data.isNotEmpty) {
          message = data;
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<String> sendRegistrationOtp({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await apiClient.post(
        ApiConstants.registerSendOtp,
        data: {'name': name, 'email': email, 'password': password},
      );
      return response.data['message']?.toString() ?? 'Verification code sent to your email';
    } on DioException catch (dioErr) {
      String message = 'Failed to send verification code.';
      if (dioErr.response?.data != null) {
        final data = dioErr.response!.data;
        if (data is Map && data['error'] != null) {
          message = data['error'].toString();
        } else if (data is String && data.isNotEmpty) {
          message = data;
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<UserModel> verifyRegistrationOtp({
    required String name,
    required String email,
    required String password,
    required String otp,
  }) async {
    try {
      final response = await apiClient.post(
        ApiConstants.registerVerifyOtp,
        data: {'name': name, 'email': email, 'password': password, 'otp': otp},
      );

      final token = response.data['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        await storageService.saveToken(token);
      }

      final userData = response.data['user'] ?? response.data;
      _currentUser = UserModel.fromJson(Map<String, dynamic>.from(userData));
      await storageService.saveUserName(_currentUser!.name);

      if (response.data['profiles'] != null && response.data['profiles'] is List) {
        final profilesList = (response.data['profiles'] as List)
            .map((p) => ProfileModel.fromJson(Map<String, dynamic>.from(p)))
            .toList();
        profileRepository.setInitialProfiles(profilesList);
      }

      return _currentUser!;
    } on DioException catch (dioErr) {
      String message = 'OTP verification failed. Please try again.';
      if (dioErr.response?.data != null) {
        final data = dioErr.response!.data;
        if (data is Map && data['error'] != null) {
          message = data['error'].toString();
        } else if (data is String && data.isNotEmpty) {
          message = data;
        }
      }
      throw Exception(message);
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<UserModel> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await apiClient.post(
        ApiConstants.register,
        data: {'name': name, 'email': email, 'password': password},
      );

      final token = response.data['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        await storageService.saveToken(token);
      }

      final userData = response.data['user'] ?? response.data;
      _currentUser = UserModel.fromJson(Map<String, dynamic>.from(userData));

      if (response.data['profiles'] != null && response.data['profiles'] is List) {
        final profilesList = (response.data['profiles'] as List)
            .map((p) => ProfileModel.fromJson(Map<String, dynamic>.from(p)))
            .toList();
        profileRepository.setInitialProfiles(profilesList);
      }

      return _currentUser!;
    } on DioException catch (dioErr) {
      String message = 'Registration failed. Please try again.';
      if (dioErr.response?.data != null) {
        final data = dioErr.response!.data;
        if (data is Map && data['error'] != null) {
          message = data['error'].toString();
        } else if (data is String && data.isNotEmpty) {
          message = data;
        }
      } else if (dioErr.type == DioExceptionType.connectionError) {
        message = 'Cannot connect to server at ${ApiConstants.baseUrl}.';
      }
      throw Exception(message);
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<bool> forgotPassword(String email) async {
    try {
      final response = await apiClient.post(
        ApiConstants.forgotPassword,
        data: {'email': email},
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    await storageService.clearSession();
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
  }
}

final authRepository = AuthRepository();
