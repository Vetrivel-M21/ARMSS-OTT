import '../../core/constants/api_constants.dart';

class PlaybackTicket {
  final String videoId;
  final String manifestUrl;
  final int maxHeight;
  final double resumePositionSec;
  final String? token;
  /// Authoritative video duration from the backend DB (seconds).
  /// Non-zero when the transcoder has set videos.duration.
  /// Used as the primary fallback duration before HLS manifest resolves.
  final double durationSeconds;

  PlaybackTicket({
    required this.videoId,
    required this.manifestUrl,
    required this.maxHeight,
    required this.resumePositionSec,
    this.token,
    this.durationSeconds = 0.0,
  });

  factory PlaybackTicket.fromJson(String videoId, Map<String, dynamic> json) {
    final manifest = json['manifestUrl'] as String? ?? '';
    String? extractedToken;
    try {
      final parsed = Uri.parse(manifest);
      extractedToken = parsed.queryParameters['token'];
    } catch (_) {}

    final rawDurationSec = (json['durationSeconds'] as num?)?.toDouble() ?? 0.0;
    // Reject sentinel values: must be positive and < 24 hours
    final sanitizedDurationSec =
        (rawDurationSec > 0 && rawDurationSec < 86400) ? rawDurationSec : 0.0;

    return PlaybackTicket(
      videoId: videoId,
      manifestUrl: manifest,
      maxHeight: (json['maxHeight'] as num?)?.toInt() ?? 1080,
      resumePositionSec:
          (json['resumePositionSec'] as num?)?.toDouble() ?? 0.0,
      token: extractedToken,
      durationSeconds: sanitizedDurationSec,
    );
  }

  /// Resolved absolute URL for Master playlist (ABR Auto)
  String get autoUrl => ApiConstants.resolveMediaUrl(manifestUrl);

  /// Resolved absolute URL for a specific rendition (e.g. 1080p, 720p, 480p, 360p)
  String getRenditionUrl(String rendition) {
    final t = token;
    final tokenSuffix = (t != null && t.isNotEmpty) ? '?token=$t' : '';
    final path = '/api/videos/$videoId/$rendition/index.m3u8$tokenSuffix';
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
