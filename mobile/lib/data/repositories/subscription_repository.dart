import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/storage_service.dart';
import '../models/plan_model.dart';
import '../models/user_model.dart';

class SubscriptionRepository {
  final ApiClient _client;

  SubscriptionRepository({ApiClient? client}) : _client = client ?? apiClient;

  Future<List<PlanModel>> getPlans() async {
    try {
      final response = await _client.get(ApiConstants.plans);
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data is List
            ? response.data
            : (response.data['plans'] as List? ?? []);
        if (list.isNotEmpty) {
          return list.map((p) => PlanModel.fromJson(Map<String, dynamic>.from(p))).toList();
        }
      }
    } catch (_) {
      // Fallback to default plans if backend unreachable or endpoint offline
    }
    return PlanModel.defaultPlans();
  }

  Future<UserModel> upgradeSubscription(String tier) async {
    final response = await _client.post(
      ApiConstants.subscriptionUpgrade,
      data: {'tier': tier},
    );

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data is Map<String, dynamic> ? response.data : {};
      final token = data['token']?.toString();
      if (token != null && token.isNotEmpty) {
        await storageService.saveToken(token);
      }

      final userData = data['user'] as Map<String, dynamic>? ?? {};
      final updatedUser = UserModel.fromJson(userData);
      await storageService.saveUser(
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        subscriptionTier: updatedUser.subscriptionTier,
      );
      return updatedUser;
    }

    throw Exception('Failed to upgrade subscription');
  }
}

final subscriptionRepository = SubscriptionRepository();
