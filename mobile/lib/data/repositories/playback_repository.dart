import 'package:dio/dio.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/storage_service.dart';
import '../models/playback_model.dart';

class PlaybackRepository {
  final ApiClient _client;

  PlaybackRepository({ApiClient? client}) : _client = client ?? apiClient;

  Future<PlaybackTicket> getPlaybackTicket(String videoId) async {
    final deviceId = await storageService.getOrCreateDeviceId();
    
    final response = await _client.get(
      ApiConstants.videoPlayback(videoId),
      queryParameters: {
        'device_id': deviceId,
      },
    );

    if (response.data is Map<String, dynamic>) {
      return PlaybackTicket.fromJson(videoId, response.data as Map<String, dynamic>);
    }

    throw Exception('Invalid playback response payload');
  }

  Future<void> sendWatchProgress({
    required String videoId,
    required double timeSeconds,
    required int progressPercent,
    String? profileId,
  }) async {
    try {
      final activeProfile = profileId ?? storageService.getActiveProfileId();
      await _client.post(
        ApiConstants.videoProgress(videoId),
        data: {
          'time_seconds': timeSeconds,
          'progress_percent': progressPercent,
          'profile_id': activeProfile,
        },
      );
    } catch (_) {
      // Progress reporting failure is non-fatal; will retry next interval
    }
  }

  Future<void> sendHeartbeat({
    required String videoId,
    required String deviceId,
    required String sessionId,
  }) async {
    try {
      await _client.post(
        ApiConstants.videoHeartbeat(videoId),
        data: {
          'device_id': deviceId,
          'session_id': sessionId,
        },
      );
    } catch (_) {
      // Heartbeat failure is non-fatal; will retry next interval
    }
  }
}

final playbackRepository = PlaybackRepository();
