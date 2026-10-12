import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/repositories/auth_repository.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserModel?>>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AsyncValue<UserModel?>> {
  AuthNotifier() : super(const AsyncValue.loading()) {
    checkStatus();
  }

  Future<UserModel?> checkStatus() async {
    state = const AsyncValue.loading();
    try {
      final user = await authRepository.checkCurrentUser();
      state = AsyncValue.data(user);
      return user;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<String?> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await authRepository.login(email: email, password: password);
      state = AsyncValue.data(user);
      return null; // Success (no error)
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  Future<String?> register(String name, String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await authRepository.register(name: name, email: email, password: password);
      state = AsyncValue.data(user);
      return null; // Success (no error)
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  Future<String?> signInWithGoogle() async {
    state = const AsyncValue.loading();
    try {
      final user = await authRepository.signInWithGoogle();
      state = AsyncValue.data(user);
      return null;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  Future<String?> sendRegistrationOtp(String name, String email, String password) async {
    try {
      await authRepository.sendRegistrationOtp(name: name, email: email, password: password);
      return null;
    } catch (e) {
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  Future<String?> verifyRegistrationOtp(String name, String email, String password, String otp) async {
    state = const AsyncValue.loading();
    try {
      final user = await authRepository.verifyRegistrationOtp(
        name: name,
        email: email,
        password: password,
        otp: otp,
      );
      state = AsyncValue.data(user);
      return null;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  Future<void> logout() async {
    await authRepository.logout();
    state = const AsyncValue.data(null);
  }
}
