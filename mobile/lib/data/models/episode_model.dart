class EpisodeModel {
  final String id;
  final int season;
  final int number;
  final String title;
  final int runtime; // in minutes
  final String synopsis;
  final String? videoUrl;
  final String? thumbnailUrl;

  EpisodeModel({
    required this.id,
    required this.season,
    required this.number,
    required this.title,
    required this.runtime,
    required this.synopsis,
    this.videoUrl,
    this.thumbnailUrl,
  });

  factory EpisodeModel.fromJson(Map<String, dynamic> json) {
    return EpisodeModel(
      id: json['id'] ?? '',
      season: json['season_number'] is int
          ? json['season_number']
          : (json['season'] is int
              ? json['season']
              : int.tryParse('${json['season_number'] ?? json['season']}') ?? 1),
      number: json['episode_number'] is int
          ? json['episode_number']
          : (json['number'] is int
              ? json['number']
              : int.tryParse('${json['episode_number'] ?? json['number']}') ?? 1),
      title: json['title'] ?? '',
      runtime: json['runtime_min'] is int
          ? json['runtime_min']
          : (json['runtime'] is int
              ? json['runtime']
              : int.tryParse('${json['runtime_min'] ?? json['runtime']}') ?? 45),
      synopsis: json['synopsis'] ?? '',
      videoUrl: json['video_url'] ?? json['videoUrl'],
      thumbnailUrl: json['thumbnail_url'] ?? json['thumbnailUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'season': season,
      'number': number,
      'title': title,
      'runtime': runtime,
      'synopsis': synopsis,
      'videoUrl': videoUrl,
      'thumbnailUrl': thumbnailUrl,
    };
  }
}
