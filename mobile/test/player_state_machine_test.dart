import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';
import 'package:armss_ott_mobile/data/models/playback_model.dart';

enum PlayerPlaybackState {
  uninitialized,
  requestingTicket,
  buffering,
  playing,
  paused,
  renewingToken,
  error,
}

class MockPlayerStateMachine {
  PlayerPlaybackState state = PlayerPlaybackState.uninitialized;
  PlaybackTicket? currentTicket;
  String selectedQuality = 'Auto';
  Duration currentPosition = Duration.zero;
  bool isWakelockActive = false;
  int tokenRenewalCount = 0;
  String? lastLoadedUrl;

  Future<void> loadTicket(PlaybackTicket ticket, {bool isRenewal = false}) async {
    if (isRenewal) {
      state = PlayerPlaybackState.renewingToken;
      tokenRenewalCount++;
    } else {
      state = PlayerPlaybackState.requestingTicket;
    }

    currentTicket = ticket;
    if (!isRenewal) {
      currentPosition = Duration(seconds: ticket.resumePositionSec.round());
    }

    state = PlayerPlaybackState.buffering;
    final targetUrl = selectedQuality == 'Auto' ? ticket.autoUrl : ticket.getRenditionUrl(selectedQuality);
    lastLoadedUrl = targetUrl;
    
    // Simulate player initialized & playing
    state = PlayerPlaybackState.playing;
    isWakelockActive = true;
  }

  void switchQuality(String newQuality) {
    if (selectedQuality == newQuality || currentTicket == null) return;
    selectedQuality = newQuality;
    state = PlayerPlaybackState.buffering;

    final targetUrl = newQuality == 'Auto' ? currentTicket!.autoUrl : currentTicket!.getRenditionUrl(newQuality);
    lastLoadedUrl = targetUrl;
    
    // Resumes at current position
    state = PlayerPlaybackState.playing;
    isWakelockActive = true;
  }

  void onAppLifecycleChanged(AppLifecycleState lifecycleState) {
    if (lifecycleState == AppLifecycleState.paused || lifecycleState == AppLifecycleState.inactive) {
      if (state == PlayerPlaybackState.playing) {
        state = PlayerPlaybackState.paused;
      }
      isWakelockActive = false;
    } else if (lifecycleState == AppLifecycleState.resumed) {
      // Screen comes back to foreground
    }
  }

  void onStreamError(int statusCode) {
    if (statusCode == 401 || statusCode == 403) {
      // Expired token triggers automatic renewal
      state = PlayerPlaybackState.renewingToken;
    } else {
      state = PlayerPlaybackState.error;
      isWakelockActive = false;
    }
  }

  void dispose() {
    isWakelockActive = false;
    state = PlayerPlaybackState.uninitialized;
  }
}

void main() {
  group('Player State Machine & Lifecycle Tests', () {
    late MockPlayerStateMachine machine;
    late PlaybackTicket ticket;

    setUp(() {
      machine = MockPlayerStateMachine();
      ticket = PlaybackTicket.fromJson('vid-456', {
        'manifestUrl': '/api/videos/vid-456/master.m3u8?token=initial-token-1',
        'maxHeight': 1080,
        'resumePositionSec': 30.0,
      });
    });

    test('initializes from server resume position and enables wakelock', () async {
      expect(machine.state, PlayerPlaybackState.uninitialized);
      expect(machine.isWakelockActive, isFalse);

      await machine.loadTicket(ticket);

      expect(machine.state, PlayerPlaybackState.playing);
      expect(machine.currentPosition, const Duration(seconds: 30));
      expect(machine.isWakelockActive, isTrue);
      expect(machine.lastLoadedUrl, contains('master.m3u8?token=initial-token-1'));
    });

    test('switches quality to 720p and updates stream URL while preserving position', () async {
      await machine.loadTicket(ticket);
      machine.currentPosition = const Duration(seconds: 75);

      machine.switchQuality('720p');

      expect(machine.selectedQuality, '720p');
      expect(machine.state, PlayerPlaybackState.playing);
      expect(machine.currentPosition, const Duration(seconds: 75));
      expect(machine.lastLoadedUrl, contains('/720p/index.m3u8?token=initial-token-1'));
    });

    test('pauses playback and disables wakelock when app is backgrounded', () async {
      await machine.loadTicket(ticket);
      expect(machine.state, PlayerPlaybackState.playing);
      expect(machine.isWakelockActive, isTrue);

      machine.onAppLifecycleChanged(AppLifecycleState.paused);

      expect(machine.state, PlayerPlaybackState.paused);
      expect(machine.isWakelockActive, isFalse);
    });

    test('handles 401 token expiry by triggering token renewal and preserving position', () async {
      await machine.loadTicket(ticket);
      machine.currentPosition = const Duration(seconds: 120);

      machine.onStreamError(401);
      expect(machine.state, PlayerPlaybackState.renewingToken);

      final freshTicket = PlaybackTicket.fromJson('vid-456', {
        'manifestUrl': '/api/videos/vid-456/master.m3u8?token=fresh-token-2',
        'maxHeight': 1080,
        'resumePositionSec': 0.0,
      });

      await machine.loadTicket(freshTicket, isRenewal: true);

      expect(machine.state, PlayerPlaybackState.playing);
      expect(machine.currentPosition, const Duration(seconds: 120));
      expect(machine.tokenRenewalCount, 1);
      expect(machine.lastLoadedUrl, contains('fresh-token-2'));
    });

    test('cleans up resources and disables wakelock on dispose', () async {
      await machine.loadTicket(ticket);
      expect(machine.isWakelockActive, isTrue);

      machine.dispose();

      expect(machine.state, PlayerPlaybackState.uninitialized);
      expect(machine.isWakelockActive, isFalse);
    });
  });
}
