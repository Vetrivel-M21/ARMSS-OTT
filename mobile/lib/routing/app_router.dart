import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../presentation/screens/splash_screen.dart';
import '../presentation/screens/auth/login_screen.dart';
import '../presentation/screens/auth/register_screen.dart';
import '../presentation/screens/auth/otp_verification_screen.dart';
import '../presentation/screens/auth/forgot_password_screen.dart';
import '../presentation/screens/profiles/profile_selector_screen.dart';
import '../presentation/screens/main_shell.dart';
import '../presentation/screens/home/home_screen.dart';
import '../presentation/screens/search/search_screen.dart';
import '../presentation/screens/live/live_tv_screen.dart';
import '../presentation/screens/my_list/watchlist_screen.dart';
import '../presentation/screens/settings/settings_screen.dart';
import '../presentation/screens/details/title_details_screen.dart';
import '../presentation/screens/player/native_video_player_screen.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/verify-otp',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>? ?? {};
        return OtpVerificationScreen(
          name: extra['name']?.toString() ?? '',
          email: extra['email']?.toString() ?? '',
          password: extra['password']?.toString() ?? '',
        );
      },
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (context, state) => const ForgotPasswordScreen(),
    ),
    GoRoute(
      path: '/profiles',
      builder: (context, state) => const ProfileSelectorScreen(),
    ),

    // Bottom Navigation Shell
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return MainShell(navigationShell: navigationShell);
      },
      branches: [
        // Branch 0: Home
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),

        // Branch 1: Search
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/search',
              builder: (context, state) => const SearchScreen(),
            ),
          ],
        ),

        // Branch 2: Live TV
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/live',
              builder: (context, state) => const LiveTvScreen(),
            ),
          ],
        ),

        // Branch 3: My Space (Watchlist & Downloads)
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/my-space',
              builder: (context, state) => const WatchlistScreen(),
            ),
          ],
        ),

        // Branch 4: Settings
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (context, state) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),

    // Full screen routes outside shell (no bottom nav)
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/title/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? '';
        return TitleDetailsScreen(titleId: id);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/player/:id',
      builder: (context, state) {
        final id = state.pathParameters['id'] ?? '';
        final episodeId = state.uri.queryParameters['episode_id'];
        final episodeTitle = state.uri.queryParameters['ep_title'];
        final directUrl = state.uri.queryParameters['url'];
        return NativeVideoPlayerScreen(
          titleId: id,
          episodeId: episodeId,
          episodeTitle: episodeTitle != null ? Uri.decodeComponent(episodeTitle) : null,
          directUrl: directUrl != null ? Uri.decodeComponent(directUrl) : null,
        );
      },
    ),
  ],
);
