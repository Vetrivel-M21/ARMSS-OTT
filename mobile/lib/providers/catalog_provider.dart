import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/title_model.dart';
import '../data/repositories/catalog_repository.dart';

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
  return await catalogRepository.getLiveChannels();
});

final titleDetailProvider = FutureProvider.family<TitleModel?, String>((ref, id) async {
  return await catalogRepository.getTitleById(id);
});

final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<TitleModel>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().isEmpty) return [];
  return await catalogRepository.search(query);
});
