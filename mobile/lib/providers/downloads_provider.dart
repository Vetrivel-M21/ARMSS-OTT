import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repositories/downloads_repository.dart';

final downloadsStreamProvider = StreamProvider<Map<String, DownloadItem>>((ref) {
  return downloadsRepository.downloadStream;
});

final downloadedItemsProvider = Provider<List<DownloadItem>>((ref) {
  // Watch stream to rebuild whenever downloads update
  ref.watch(downloadsStreamProvider);
  return downloadsRepository.getDownloadedItems();
});

final titleDownloadStatusProvider = Provider.family<DownloadStatus, String>((ref, titleId) {
  ref.watch(downloadsStreamProvider);
  return downloadsRepository.getStatus(titleId);
});
