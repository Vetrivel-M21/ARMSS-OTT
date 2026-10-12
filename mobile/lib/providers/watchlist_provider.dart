import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/title_model.dart';
import '../data/repositories/watchlist_repository.dart';

final watchlistProvider = StateNotifierProvider<WatchlistNotifier, List<TitleModel>>((ref) {
  return WatchlistNotifier();
});

class WatchlistNotifier extends StateNotifier<List<TitleModel>> {
  WatchlistNotifier() : super([]) {
    loadWatchlist();
  }

  Future<void> loadWatchlist() async {
    state = await watchlistRepository.getWatchlist();
  }

  Future<void> toggle(TitleModel title) async {
    await watchlistRepository.toggleWatchlist(title.id);
    await loadWatchlist();
  }

  bool isBookmarked(String titleId) {
    return state.any((t) => t.id == titleId);
  }
}
