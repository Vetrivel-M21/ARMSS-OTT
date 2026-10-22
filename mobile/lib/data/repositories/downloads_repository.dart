import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/title_model.dart';
import '../../core/constants/api_constants.dart';

enum DownloadStatus { notDownloaded, downloading, downloaded, error }

class DownloadItem {
  final String titleId;
  final String titleName;
  final String poster;
  final double sizeMb;
  final DownloadStatus status;
  final double progress; // 0.0 to 1.0
  final String? localFilePath;
  final String? errorMessage;

  DownloadItem({
    required this.titleId,
    required this.titleName,
    required this.poster,
    required this.sizeMb,
    required this.status,
    this.progress = 1.0,
    this.localFilePath,
    this.errorMessage,
  });

  Map<String, dynamic> toJson() => {
    'titleId': titleId,
    'titleName': titleName,
    'poster': poster,
    'sizeMb': sizeMb,
    'status': status.name,
    'progress': progress,
    'localFilePath': localFilePath,
  };

  factory DownloadItem.fromJson(Map<String, dynamic> json) => DownloadItem(
    titleId: json['titleId'] as String? ?? '',
    titleName: json['titleName'] as String? ?? '',
    poster: json['poster'] as String? ?? '',
    sizeMb: (json['sizeMb'] as num?)?.toDouble() ?? 0.0,
    status: DownloadStatus.values.firstWhere(
      (e) => e.name == json['status'],
      orElse: () => DownloadStatus.notDownloaded,
    ),
    progress: (json['progress'] as num?)?.toDouble() ?? 1.0,
    localFilePath: json['localFilePath'] as String?,
  );
}

class DownloadsRepository {
  static const String _storageKey = 'armss_downloads_meta_v1';
  final Map<String, DownloadItem> _downloads = {};
  final Map<String, CancelToken> _cancelTokens = {};
  final _controller = StreamController<Map<String, DownloadItem>>.broadcast();
  final Dio _dio = Dio();
  bool _initialized = false;

  Stream<Map<String, DownloadItem>> get downloadStream => _controller.stream;

  DownloadsRepository() {
    _initStorage();
  }

  Future<void> _initStorage() async {
    if (_initialized) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final Map<String, dynamic> decoded = jsonDecode(raw);
        decoded.forEach((key, val) {
          if (val is Map<String, dynamic>) {
            final item = DownloadItem.fromJson(val);
            // Verify file exists on device disk
            if (item.localFilePath != null && File(item.localFilePath!).existsSync()) {
              _downloads[key] = item;
            }
          }
        });
      }
    } catch (e) {
      debugPrint('[DownloadsRepo] Storage load error: $e');
    }
    _initialized = true;
    _controller.add(_downloads);
  }

  Future<void> _saveMeta() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final mapToSave = _downloads.map((k, v) => MapEntry(k, v.toJson()));
      await prefs.setString(_storageKey, jsonEncode(mapToSave));
    } catch (e) {
      debugPrint('[DownloadsRepo] Storage save error: $e');
    }
  }

  List<DownloadItem> getDownloadedItems() {
    return _downloads.values.toList();
  }

  DownloadStatus getStatus(String titleId) {
    return _downloads[titleId]?.status ?? DownloadStatus.notDownloaded;
  }

  String? getLocalPlaybackPath(String titleId) {
    final item = _downloads[titleId];
    if (item != null && item.status == DownloadStatus.downloaded && item.localFilePath != null) {
      if (File(item.localFilePath!).existsSync()) {
        return item.localFilePath;
      }
    }
    return null;
  }

  Future<void> startDownload(TitleModel title) async {
    if (_downloads[title.id]?.status == DownloadStatus.downloading) {
      return;
    }

    final cancelToken = CancelToken();
    _cancelTokens[title.id] = cancelToken;

    _downloads[title.id] = DownloadItem(
      titleId: title.id,
      titleName: title.title,
      poster: title.posterAssetPath,
      sizeMb: 0.0,
      status: DownloadStatus.downloading,
      progress: 0.01,
    );
    _controller.add(_downloads);

    try {
      final dir = await getApplicationDocumentsDirectory();
      final savePath = '${dir.path}/offline_${title.id}.mp4';

      // Resolve download media URL (direct MP4 / trailer / media asset)
      String downloadUrl = '';
      if (title.videoUrl != null && title.videoUrl!.isNotEmpty) {
        downloadUrl = ApiConstants.resolveMediaUrl(title.videoUrl);
      } else if (title.trailer != null && title.trailer!.isNotEmpty) {
        downloadUrl = ApiConstants.resolveMediaUrl(title.trailer);
      } else {
        downloadUrl = '${ApiConstants.mediaBaseUrl}/trailers/${title.id}.mp4';
      }

      await _dio.download(
        downloadUrl,
        savePath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            final prog = received / total;
            final mb = total / (1024 * 1024);
            _downloads[title.id] = DownloadItem(
              titleId: title.id,
              titleName: title.title,
              poster: title.posterAssetPath,
              sizeMb: double.parse(mb.toStringAsFixed(1)),
              status: DownloadStatus.downloading,
              progress: prog,
              localFilePath: savePath,
            );
            _controller.add(_downloads);
          }
        },
      );

      final downloadedFile = File(savePath);
      final finalBytes = await downloadedFile.length();
      final finalMb = finalBytes / (1024 * 1024);

      _downloads[title.id] = DownloadItem(
        titleId: title.id,
        titleName: title.title,
        poster: title.posterAssetPath,
        sizeMb: double.parse(finalMb.toStringAsFixed(1)),
        status: DownloadStatus.downloaded,
        progress: 1.0,
        localFilePath: savePath,
      );

      _cancelTokens.remove(title.id);
      await _saveMeta();
      _controller.add(_downloads);
    } catch (e) {
      if (CancelToken.isCancel(e as dynamic)) {
        _downloads.remove(title.id);
      } else {
        debugPrint('[DownloadsRepo] Download error: $e');
        _downloads[title.id] = DownloadItem(
          titleId: title.id,
          titleName: title.title,
          poster: title.posterAssetPath,
          sizeMb: 0.0,
          status: DownloadStatus.error,
          progress: 0.0,
          errorMessage: 'Download failed: $e',
        );
      }
      _cancelTokens.remove(title.id);
      _controller.add(_downloads);
    }
  }

  Future<void> removeDownload(String titleId) async {
    // 1. Cancel in-progress download if any
    _cancelTokens[titleId]?.cancel();
    _cancelTokens.remove(titleId);

    // 2. Delete local file from disk
    final item = _downloads[titleId];
    if (item?.localFilePath != null) {
      try {
        final f = File(item!.localFilePath!);
        if (await f.exists()) {
          await f.delete();
        }
      } catch (e) {
        debugPrint('[DownloadsRepo] File delete error: $e');
      }
    }

    _downloads.remove(titleId);
    await _saveMeta();
    _controller.add(_downloads);
  }
}

final downloadsRepository = DownloadsRepository();
