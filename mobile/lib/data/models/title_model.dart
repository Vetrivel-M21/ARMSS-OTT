import 'episode_model.dart';

class CastMember {
  final String name;
  final String role;

  CastMember({required this.name, required this.role});

  factory CastMember.fromJson(Map<String, dynamic> json) {
    return CastMember(
      name: json['name'] ?? '',
      role: json['role'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'name': name, 'role': role};
}

class TitleModel {
  final String id;
  final String title;
  final String kind; // "film" | "series" | "documentary" | "live"
  final int year;
  final String maturity;
  final int runtimeMin;
  final int? seasons;
  final List<String> genres;
  final String logline;
  final String synopsis;
  final int match;
  final List<String> badges;
  final String? language;
  final String? poster;
  final String? backdrop;
  final String? trailer;
  final String? videoUrl;
  final String tone;
  final bool featured;
  final int? rank;
  final bool trending;
  final bool fresh;
  final bool original;
  final String requiredTier; // "free" | "standard" | "premium"
  final List<CastMember> cast;
  final String? director;
  final List<EpisodeModel> episodes;
  final List<String> similar;

  TitleModel({
    required this.id,
    required this.title,
    required this.kind,
    required this.year,
    required this.maturity,
    required this.runtimeMin,
    this.seasons,
    required this.genres,
    required this.logline,
    required this.synopsis,
    this.match = 95,
    this.badges = const [],
    this.language,
    this.poster,
    this.backdrop,
    this.trailer,
    this.videoUrl,
    this.tone = 'ember',
    this.featured = false,
    this.rank,
    this.trending = false,
    this.fresh = false,
    this.original = false,
    this.requiredTier = 'free',
    this.cast = const [],
    this.director,
    this.episodes = const [],
    this.similar = const [],
  });

  factory TitleModel.fromJson(Map<String, dynamic> json) {
    var rawCast = json['cast'] as List? ?? [];
    List<CastMember> castList = rawCast.map((c) {
      if (c is Map<String, dynamic>) return CastMember.fromJson(c);
      return CastMember(name: c.toString(), role: 'Actor');
    }).toList();

    var rawEpisodes = json['episodes'] as List? ?? [];
    List<EpisodeModel> episodesList = rawEpisodes.map((e) {
      return EpisodeModel.fromJson(Map<String, dynamic>.from(e));
    }).toList();

    return TitleModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      kind: json['kind'] ?? 'film',
      year: json['year'] is int ? json['year'] : int.tryParse('${json['year']}') ?? 2024,
      maturity: json['maturity'] ?? '13+',
      runtimeMin: json['runtimeMin'] is int ? json['runtimeMin'] : int.tryParse('${json['runtimeMin']}') ?? 120,
      seasons: json['seasons'] is int ? json['seasons'] : int.tryParse('${json['seasons']}'),
      genres: (json['genres'] as List? ?? []).map((e) => e.toString()).toList(),
      logline: json['logline'] ?? '',
      synopsis: json['synopsis'] ?? '',
      match: json['match'] is int ? json['match'] : int.tryParse('${json['match']}') ?? 95,
      badges: (json['badges'] as List? ?? []).map((e) => e.toString()).toList(),
      language: json['language'],
      poster: json['poster'],
      backdrop: json['backdrop'],
      trailer: json['trailer'],
      videoUrl: json['videoUrl'] ?? json['video_url'] ?? json['trailer'],
      tone: json['tone'] ?? 'ember',
      featured: json['featured'] == true,
      rank: json['rank'] is int ? json['rank'] : int.tryParse('${json['rank']}'),
      trending: json['trending'] == true,
      fresh: json['fresh'] == true,
      original: json['original'] == true,
      requiredTier: json['required_tier'] ?? 'free',
      cast: castList,
      director: json['director'],
      episodes: episodesList,
      similar: (json['similar'] as List? ?? []).map((e) => e.toString()).toList(),
    );
  }

  String get durationString {
    if (kind == 'series') {
      final s = seasons ?? 1;
      return '$s ${s == 1 ? 'Season' : 'Seasons'}';
    }
    final hrs = runtimeMin ~/ 60;
    final mins = runtimeMin % 60;
    if (hrs > 0 && mins > 0) return '${hrs}h ${mins}m';
    if (hrs > 0) return '${hrs}h';
    return '${mins}m';
  }

  String get posterAssetPath => 'assets/posters/$id.jpg';
  String get backdropAssetPath => 'assets/backdrops/$id.jpg';

  TitleModel copyWith({
    String? id,
    String? title,
    String? kind,
    int? year,
    String? maturity,
    int? runtimeMin,
    int? seasons,
    List<String>? genres,
    String? logline,
    String? synopsis,
    int? match,
    List<String>? badges,
    String? language,
    String? poster,
    String? backdrop,
    String? trailer,
    String? videoUrl,
    String? tone,
    bool? featured,
    int? rank,
    bool? trending,
    bool? fresh,
    bool? original,
    String? requiredTier,
    List<CastMember>? cast,
    String? director,
    List<EpisodeModel>? episodes,
    List<String>? similar,
  }) {
    return TitleModel(
      id: id ?? this.id,
      title: title ?? this.title,
      kind: kind ?? this.kind,
      year: year ?? this.year,
      maturity: maturity ?? this.maturity,
      runtimeMin: runtimeMin ?? this.runtimeMin,
      seasons: seasons ?? this.seasons,
      genres: genres ?? this.genres,
      logline: logline ?? this.logline,
      synopsis: synopsis ?? this.synopsis,
      match: match ?? this.match,
      badges: badges ?? this.badges,
      language: language ?? this.language,
      poster: poster ?? this.poster,
      backdrop: backdrop ?? this.backdrop,
      trailer: trailer ?? this.trailer,
      videoUrl: videoUrl ?? this.videoUrl,
      tone: tone ?? this.tone,
      featured: featured ?? this.featured,
      rank: rank ?? this.rank,
      trending: trending ?? this.trending,
      fresh: fresh ?? this.fresh,
      original: original ?? this.original,
      requiredTier: requiredTier ?? this.requiredTier,
      cast: cast ?? this.cast,
      director: director ?? this.director,
      episodes: episodes ?? this.episodes,
      similar: similar ?? this.similar,
    );
  }
}
