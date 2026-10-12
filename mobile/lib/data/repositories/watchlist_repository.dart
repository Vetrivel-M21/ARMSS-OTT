import '../models/title_model.dart';
import 'catalog_repository.dart';
import '../../core/storage/storage_service.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';

class WatchlistRepository {
  Future<List<TitleModel>> getWatchlist() async {
    final localIds = storageService.getLocalWatchlist();
    final allTitles = await catalogRepository.getTitles();
    return allTitles.where((t) => localIds.contains(t.id)).toList();
  }

  Future<bool> toggleWatchlist(String titleId) async {
    await storageService.toggleLocalWatchlist(titleId);
    try {
      await apiClient.post('${ApiConstants.myList}/toggle', data: {'title_id': titleId});
    } catch (_) {
      // offline silent sync
    }
    return storageService.isInWatchlist(titleId);
  }

  bool isInWatchlist(String titleId) {
    return storageService.isInWatchlist(titleId);
  }
}

final watchlistRepository = WatchlistRepository();
