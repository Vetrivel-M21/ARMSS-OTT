import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:armss_ott_mobile/main.dart';

void main() {
  testWidgets('ARMSS OTT Smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: ArmssOttApp(),
      ),
    );

    // Initial frame builds without throwing
    expect(find.byType(ArmssOttApp), findsOneWidget);
  });
}
