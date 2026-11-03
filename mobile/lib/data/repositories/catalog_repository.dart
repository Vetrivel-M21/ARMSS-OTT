import '../models/title_model.dart';
import '../models/episode_model.dart';
import '../models/display_settings_model.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';

class CatalogRepository {
  List<TitleModel>? _cachedTitles;

  Future<List<TitleModel>> getTitles({bool refresh = false}) async {
    if (_cachedTitles != null && !refresh) {
      return _cachedTitles!;
    }

    try {
      final response = await apiClient.get(ApiConstants.titles);
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data is List ? response.data : (response.data['titles'] ?? []);
        final seen = <String>{};
        final uniqueList = <TitleModel>[];
        for (final e in list) {
          final t = TitleModel.fromJson(Map<String, dynamic>.from(e));
          if (t.id.isNotEmpty && seen.add(t.id)) {
            uniqueList.add(t);
          }
        }
        _cachedTitles = uniqueList;
        return _cachedTitles!;
      }
    } catch (_) {
      // Offline or network error
    }

    if (_cachedTitles != null && !refresh) {
      return _cachedTitles!;
    }
    _cachedTitles = [];
    return _cachedTitles!;
  }

  Future<NavVisibilityModel> getNavVisibility() async {
    try {
      final response = await apiClient.get(ApiConstants.settingsLayout);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map) {
          final settings = data['settings'] is Map ? data['settings'] : data;
          if (settings['navVisibility'] != null) {
            return NavVisibilityModel.fromJson(Map<String, dynamic>.from(settings['navVisibility']));
          }
        }
      }
    } catch (_) {}
    return const NavVisibilityModel();
  }

  Future<TitleModel?> getTitleById(String id) async {
    try {
      final response = await apiClient.get('${ApiConstants.titles}/$id');
      if (response.statusCode == 200 && response.data != null) {
        final title = TitleModel.fromJson(Map<String, dynamic>.from(response.data));
        if (title.kind == 'series' && title.episodes.isEmpty) {
          final eps = await getEpisodes(id);
          if (eps.isNotEmpty) {
            return title.copyWith(episodes: eps);
          }
        }
        return title;
      }
    } catch (_) {}

    final titles = await getTitles();
    try {
      final found = titles.firstWhere((t) => t.id == id);
      if (found.kind == 'series' && found.episodes.isEmpty) {
        final eps = await getEpisodes(id);
        if (eps.isNotEmpty) {
          return found.copyWith(episodes: eps);
        }
      }
      return found;
    } catch (_) {
      return null;
    }
  }

  Future<List<EpisodeModel>> getEpisodes(String titleId) async {
    try {
      final response = await apiClient.get('${ApiConstants.titles}/$titleId/episodes');
      if (response.statusCode == 200 && response.data != null) {
        final List list = response.data['episodes'] as List? ?? [];
        return list.map((e) => EpisodeModel.fromJson(Map<String, dynamic>.from(e))).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<TitleModel>> getTrending() async {
    final titles = await getTitles();
    return titles.where((t) => t.trending).toList();
  }

  Future<List<TitleModel>> getFeatured() async {
    final titles = await getTitles();
    return titles.where((t) => t.featured).toList();
  }

  Future<List<TitleModel>> getTop10() async {
    final titles = await getTitles();
    final ranked = titles.where((t) => t.rank != null).toList();
    ranked.sort((a, b) => (a.rank ?? 99).compareTo(b.rank ?? 99));
    return ranked;
  }

  Future<List<TitleModel>> getLiveChannels() async {
    final titles = await getTitles();
    return titles.where((t) => t.kind == 'live').toList();
  }

  Future<List<TitleModel>> search(String query) async {
    if (query.trim().isEmpty) return [];
    final titles = await getTitles();
    final q = query.toLowerCase().trim();
    final seen = <String>{};
    final matched = <TitleModel>[];
    for (final t in titles) {
      if (t.id.isEmpty || !seen.add(t.id)) continue;
      final inTitle = t.title.toLowerCase().contains(q);
      final inGenre = t.genres.any((g) => g.toLowerCase().contains(q));
      final inKind = t.kind.toLowerCase().contains(q) ||
          t.kind.replaceAll('_', ' ').toLowerCase().contains(q);
      final inCast = t.cast.any((c) => c.name.toLowerCase().contains(q));
      final inDirector = (t.director ?? '').toLowerCase().contains(q);
      if (inTitle || inGenre || inKind || inCast || inDirector) {
        matched.add(t);
      }
    }
    return matched;
  }

  List<TitleModel> _getStaticTitles() => const [];
}

final catalogRepository = CatalogRepository();
