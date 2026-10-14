import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/title_model.dart';
import '../data/models/display_settings_model.dart';
import '../data/repositories/catalog_repository.dart';

final navVisibilityProvider = FutureProvider<NavVisibilityModel>((ref) async {
  return await catalogRepository.getNavVisibility();
});

final titlesProvider = FutureProvider<List<TitleModel>>((ref) async {
  return await catalogRepository.getTitles();
});

final featuredTitlesProvider = FutureProvider<List<TitleModel>>((ref) async {
  return await catalogRepository.getFeatured();
});

final trendingTitlesProvider = FutureProvider<List<TitleModel>>((ref) async {
  return await catalogRepository.getTrending();
});

final top10TitlesProvider = FutureProvider<List<TitleModel>>((ref) async {
  return await catalogRepository.getTop10();
});

final liveChannelsProvider = FutureProvider<List<TitleModel>>((ref) async {
  final navVisAsync = ref.watch(navVisibilityProvider);
  final navVis = navVisAsync.value ?? const NavVisibilityModel();
  if (!navVis.live) return [];
  return await catalogRepository.getLiveChannels();
});

final titleDetailProvider = FutureProvider.family<TitleModel?, String>((ref, id) async {
  return await catalogRepository.getTitleById(id);
});

final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<TitleModel>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().isEmpty) return [];
  final navVisAsync = ref.watch(navVisibilityProvider);
  final navVis = navVisAsync.value ?? const NavVisibilityModel();
  final results = await catalogRepository.search(query);
  return results.where((t) {
    if (!navVis.films && t.kind == 'film') return false;
    if (!navVis.series && t.kind == 'series') return false;
    if (!navVis.live && t.kind == 'live') return false;
    return true;
  }).toList();
});
