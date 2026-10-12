class ProfileModel {
  final String id;
  final String userId;
  final String name;
  final String avatarColor;
  final bool isKids;
  final String? pin;

  ProfileModel({
    required this.id,
    required this.userId,
    required this.name,
    this.avatarColor = '#E50914',
    this.isKids = false,
    this.pin,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      name: json['name'] ?? '',
      avatarColor: json['avatar_color'] ?? '#E50914',
      isKids: json['is_kids'] ?? false,
      pin: json['pin'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'name': name,
      'avatar_color': avatarColor,
      'is_kids': isKids,
      if (pin != null) 'pin': pin,
    };
  }
}
