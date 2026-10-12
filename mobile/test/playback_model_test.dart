import 'package:flutter_test/flutter_test.dart';
import 'package:armss_ott_mobile/data/models/playback_model.dart';

void main() {
  group('PlaybackTicket & ABR Rendition Model Tests', () {
    test('parses playback ticket response correctly', () {
      final json = {
        'manifestUrl': '/api/videos/test-vid-1/master.m3u8?token=mock-signed-token-123',
        'maxHeight': 1080,
        'resumePositionSec': 42.5,
      };

      final ticket = PlaybackTicket.fromJson('test-vid-1', json);

      expect(ticket.videoId, 'test-vid-1');
      expect(ticket.maxHeight, 1080);
      expect(ticket.resumePositionSec, 42.5);
      expect(ticket.token, 'mock-signed-token-123');
    });

    test('resolves auto master playlist URL for native ABR', () {
      final json = {
        'manifestUrl': '/api/videos/test-vid-1/master.m3u8?token=token-abc',
        'maxHeight': 1080,
        'resumePositionSec': 0.0,
      };

      final ticket = PlaybackTicket.fromJson('test-vid-1', json);
      final autoUrl = ticket.autoUrl;

      expect(autoUrl, contains('/api/videos/test-vid-1/master.m3u8?token=token-abc'));
    });

    test('generates individual rendition index URLs with signed token preserved', () {
      final json = {
        'manifestUrl': '/api/videos/test-vid-1/master.m3u8?token=token-xyz',
        'maxHeight': 1080,
        'resumePositionSec': 10.0,
      };

      final ticket = PlaybackTicket.fromJson('test-vid-1', json);
      
      final url720p = ticket.getRenditionUrl('720p');
      final url480p = ticket.getRenditionUrl('480p');

      expect(url720p, contains('/api/videos/test-vid-1/720p/index.m3u8?token=token-xyz'));
      expect(url480p, contains('/api/videos/test-vid-1/480p/index.m3u8?token=token-xyz'));
    });

    test('caps available renditions at maxHeight (e.g. 1080p on mobile)', () {
      final mobileTicket = PlaybackTicket.fromJson('vid-mobile', {
        'manifestUrl': '/api/videos/vid-mobile/master.m3u8?token=t',
        'maxHeight': 1080,
        'resumePositionSec': 0.0,
      });

      expect(mobileTicket.availableRenditions, contains('1080p'));
      expect(mobileTicket.availableRenditions, contains('720p'));
      expect(mobileTicket.availableRenditions, contains('480p'));
      expect(mobileTicket.availableRenditions, contains('360p'));
      expect(mobileTicket.availableRenditions.contains('2160p'), isFalse);

      final cappedTicket = PlaybackTicket.fromJson('vid-sd', {
        'manifestUrl': '/api/videos/vid-sd/master.m3u8?token=t',
        'maxHeight': 720,
        'resumePositionSec': 0.0,
      });

      expect(cappedTicket.availableRenditions.contains('1080p'), isFalse);
      expect(cappedTicket.availableRenditions, contains('720p'));
      expect(cappedTicket.availableRenditions, contains('480p'));
      expect(cappedTicket.availableRenditions, contains('360p'));
    });
  });
}
