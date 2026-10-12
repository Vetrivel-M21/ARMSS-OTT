class UserModel {
  final String id;
  final String email;
  final String name;
  final String subscriptionTier; // "free" | "standard" | "premium"
  final bool isAdmin;
  final String? createdAt;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.subscriptionTier = 'free',
    this.isAdmin = false,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      subscriptionTier: json['subscription_tier'] ?? 'free',
      isAdmin: json['is_admin'] ?? false,
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'subscription_tier': subscriptionTier,
      'is_admin': isAdmin,
      'created_at': createdAt,
    };
  }
}
