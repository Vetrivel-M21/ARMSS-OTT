import '../../core/constants/api_constants.dart';

class PlaybackTicket {
  final String videoId;
  final String manifestUrl;
  final int maxHeight;
  final double resumePositionSec;
  final String? token;

  PlaybackTicket({
    required this.videoId,
    required this.manifestUrl,
    required this.maxHeight,
    required this.resumePositionSec,
    this.token,
  });

  factory PlaybackTicket.fromJson(String videoId, Map<String, dynamic> json) {
    final manifest = json['manifestUrl'] as String? ?? '';
    String? extractedToken;
    try {
      final parsed = Uri.parse(manifest);
      extractedToken = parsed.queryParameters['token'];
    } catch (_) {}

    return PlaybackTicket(
      videoId: videoId,
      manifestUrl: manifest,
      maxHeight: (json['maxHeight'] as num?)?.toInt() ?? 1080,
      resumePositionSec: (json['resumePositionSec'] as num?)?.toDouble() ?? 0.0,
      token: extractedToken,
    );
  }

  /// Resolved absolute URL for Master playlist (ABR Auto)
  String get autoUrl => ApiConstants.resolveMediaUrl(manifestUrl);

  /// Resolved absolute URL for a specific rendition (e.g. 1080p, 720p, 480p, 360p)
  String getRenditionUrl(String rendition) {
    final t = token;
    final tokenSuffix = (t != null && t.isNotEmpty) ? '?token=$t' : '';
    final path = '/api/videos/$videoId/$rendition.m3u8$tokenSuffix';
    return ApiConstants.resolveMediaUrl(path);
  }

  /// Available ladder rungs capped at maxHeight (1080p on mobile)
  List<String> get availableRenditions {
    const allRungs = ['1080p', '720p', '480p', '360p'];
    return allRungs.where((r) {
      final height = int.tryParse(r.replaceAll('p', '')) ?? 0;
      return height <= maxHeight;
    }).toList();
  }
}
