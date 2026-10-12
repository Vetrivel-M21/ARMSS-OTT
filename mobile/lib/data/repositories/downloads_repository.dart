import 'dart:async';
import '../models/title_model.dart';
import 'catalog_repository.dart';

enum DownloadStatus { notDownloaded, downloading, downloaded }

class DownloadItem {
  final String titleId;
  final String titleName;
  final String poster;
  final double sizeMb;
  final DownloadStatus status;
  final double progress; // 0.0 to 1.0

  DownloadItem({
    required this.titleId,
    required this.titleName,
    required this.poster,
    required this.sizeMb,
    required this.status,
    this.progress = 1.0,
  });
}

class DownloadsRepository {
  final Map<String, DownloadItem> _downloads = {};
  final _controller = StreamController<Map<String, DownloadItem>>.broadcast();

  Stream<Map<String, DownloadItem>> get downloadStream => _controller.stream;

  DownloadsRepository() {
    // Seed sample downloaded content (Vikram)
    _downloads['vikram'] = DownloadItem(
      titleId: 'vikram',
      titleName: 'Vikram (Tamil - 1080p)',
      poster: 'assets/posters/vikram.jpg',
      sizeMb: 1420.5,
      status: DownloadStatus.downloaded,
      progress: 1.0,
    );
  }

  List<DownloadItem> getDownloadedItems() {
    return _downloads.values.toList();
  }

  DownloadStatus getStatus(String titleId) {
    return _downloads[titleId]?.status ?? DownloadStatus.notDownloaded;
  }

  Future<void> startDownload(TitleModel title) async {
    _downloads[title.id] = DownloadItem(
      titleId: title.id,
      titleName: title.title,
      poster: title.posterAssetPath,
      sizeMb: 1250.0,
      status: DownloadStatus.downloading,
      progress: 0.1,
    );
    _controller.add(_downloads);

    // Simulate progressive download
    for (int i = 2; i <= 10; i++) {
      await Future.delayed(const Duration(milliseconds: 300));
      if (_downloads[title.id]?.status == DownloadStatus.downloading) {
        _downloads[title.id] = DownloadItem(
          titleId: title.id,
          titleName: title.title,
          poster: title.posterAssetPath,
          sizeMb: 1250.0,
          status: i == 10 ? DownloadStatus.downloaded : DownloadStatus.downloading,
          progress: i / 10.0,
        );
        _controller.add(_downloads);
      }
    }
  }

  void removeDownload(String titleId) {
    _downloads.remove(titleId);
    _controller.add(_downloads);
  }
}

final downloadsRepository = DownloadsRepository();
