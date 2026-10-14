import 'package:flutter_test/flutter_test.dart';
import 'package:armss_ott_mobile/data/models/display_settings_model.dart';

void main() {
  group('NavVisibilityModel Tests', () {
    test('Default model has all categories visible', () {
      const model = NavVisibilityModel();
      expect(model.films, isTrue);
      expect(model.series, isTrue);
      expect(model.live, isTrue);
      expect(model.myList, isTrue);
      expect(model.comingSoon, isTrue);
      expect(model.plans, isTrue);
    });

    test('Parses backend envelope settings correctly when films and series are hidden', () {
      final backendResponse = {
        'success': true,
        'settings': {
          'navVisibility': {
            'films': false,
            'series': false,
            'live': true,
            'myList': true,
            'comingSoon': true,
            'plans': true,
          },
          'homeLayout': {
            'heroTitleId': 'auto',
          }
        }
      };

      final settings = backendResponse['settings'] as Map<String, dynamic>;
      final navVisibilityJson = settings['navVisibility'] as Map<String, dynamic>;

      final model = NavVisibilityModel.fromJson(navVisibilityJson);
      expect(model.films, isFalse);
      expect(model.series, isFalse);
      expect(model.live, isTrue);
      expect(model.myList, isTrue);
    });

    test('Handles null or missing JSON gracefully', () {
      final model = NavVisibilityModel.fromJson(null);
      expect(model.films, isTrue);
      expect(model.series, isTrue);
      expect(model.live, isTrue);
    });
  });
}
