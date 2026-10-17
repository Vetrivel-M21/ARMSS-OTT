# ARMSS OTT — Mobile Native Application (Flutter)

A dedicated, native OTT mobile streaming application for iOS & Android built with Flutter 3.x, Riverpod, and GoRouter, reflecting the exact design aesthetics and backend APIs of ARMSS OTT.

---

## 📱 Features

- **Obsidian Cinema Dark Theme**: Deep obsidian black palette (`#0E0F14`), crimson cinema accents (`#E50914`), gold subscription accents (`#F59E0B`), and Google Fonts `Outfit` typography.
- **Cinematic Hero Carousel**: Full-bleed portrait/landscape backdrop art with smooth gradient fades, match percentages, quality badges, and instant Play/My List CTAs.
- **Mobile Content Rails**:
  - *Continue Watching* rail with real-time watch percentage progress bar.
  - *Top 10 in Tamil Nadu Today* with bold, stylized oversized numbers (#1 through #10).
  - *Trending Blockbusters* & *ARMSS Originals* horizontal media rails.
- **Native Video Player**:
  - Full gestures: double tap left/right for ±10s seek, tap to show/hide controls.
  - Heartbeat sync reporting `progress_percent` and `time_seconds` to Go backend (`POST /api/progress/heartbeat`).
  - Screen rotation lock & automatic landscape support.
  - Quality selector (1080p / 720p / 480p), audio track & English CC subtitle modal sheets.
  - Wakelock enabled to keep screen active during playback.
- **Live TV & EPG Schedules**:
  - Live broadcast streaming for Tamil channels (Sun TV HD, Vijay TV, KTV, etc.).
  - Electronic Program Guide (EPG) schedule strips displaying current show progress, Up Next, and upcoming programs.
- **Offline Downloads & My Space**:
  - Manage downloaded media with file sizes (e.g., 1.4 GB) and offline playback.
  - Personal watchlist synced with backend API and cached offline.
- **Multi-Profile Selector ("Who's Watching?")**:
  - Switch between profiles (Personal, Living Room, Kids Zone).
- **Authentication**:
  - Sign in, Sign up, Forgot Password, and Guest exploration.
  - Secure JWT storage with auto-injected `Bearer` headers on all Dio requests.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Flutter 3.47+ / Dart 3.13+ |
| **State Management** | Flutter Riverpod (`flutter_riverpod: ^2.6.1`) |
| **Routing** | GoRouter with `StatefulShellRoute` (`go_router: ^14.8.1`) |
| **HTTP & Networking** | Dio (`dio: ^5.11.1`) with request interceptors & base URL resolver |
| **Storage** | `flutter_secure_storage` (JWT tokens) + `shared_preferences` |
| **Video Engine** | `video_player` + `wakelock_plus` |
| **Design & Typography**| Google Fonts (`Outfit`) + Obsidian Dark Theme |

---

## 🚀 How to Run Locally

### 1. Start the Go Backend
In a terminal, start the ARMSS OTT backend:
```bash
cd backend
go run main.go
```
The backend listens on `http://localhost:8081`.

### 2. Run the Flutter Mobile App
In another terminal:
```bash
cd mobile
flutter pub get
```

#### Android Emulator:
```bash
flutter run -d emulator
```
*(Android automatically routes `10.0.2.2:8081` to the host machine)*

#### Physical Device or iOS Simulator:
```bash
flutter run
```
*(If running on a physical Android/iOS phone over Wi-Fi, update `ApiConstants.baseUrl` in `lib/core/constants/api_constants.dart` with your PC's local LAN IP, e.g. `http://192.168.1.50:8081/api`)*

---

## 📁 Directory Structure

```
mobile/
├── assets/
│   ├── backdrops/         # 16:9 cinematic backdrops
│   ├── posters/           # 2:3 high-res poster art
│   └── images/            # Brand logos & icons
├── lib/
│   ├── core/
│   │   ├── constants/     # API endpoints & base URL resolver
│   │   ├── network/       # Dio API client & auth interceptor
│   │   ├── storage/       # Secure token & preferences storage
│   │   └── theme/         # Colors, typography & dark theme
│   ├── data/
│   │   ├── models/        # Title, Episode, User, Profile models
│   │   └── repositories/  # Catalog, Auth, Profile, Watchlist, Downloads
│   ├── providers/         # Riverpod StateNotifier & Future providers
│   ├── routing/           # GoRouter declarative navigation shell
│   ├── presentation/
│   │   ├── common/        # PosterCard, ContentRail, BadgeChip, TopNavBar
│   │   └── screens/
│   │       ├── splash_screen.dart
│   │       ├── auth/      # Login, Register, Forgot Password
│   │       ├── profiles/  # "Who's Watching" profile selector
│   │       ├── home/      # Hero Carousel, Continue Watching, Top 10
│   │       ├── details/   # Backdrop header, episodes, cast, similar
│   │       ├── player/    # Gesture video player with seek ±10s
│   │       ├── search/    # Debounced search & genre exploration
│   │       ├── live/      # Live TV channels & EPG strips
│   │       ├── my_list/   # Watchlist & Offline downloads
│   │       ├── settings/  # Account, quality & subscription
│   │       └── main_shell.dart # 5-tab BottomNavigationBar
│   └── main.dart          # Entry point with ProviderScope
└── pubspec.yaml
```

---

## 📦 Production Release Build & Keystore Signing

The release APK is cryptographically signed using the project's upload keystore and configured for production distribution.

### 📋 Build Summary & Artifacts

| Attribute | Specification |
|---|---|
| **Artifact Path** | `build/app/outputs/flutter-apk/app-release.apk` |
| **Artifact Size** | `~90.7 MB` (95,144,702 bytes) |
| **Package / Application ID** | `com.armss.ott.armss_ott_mobile` |
| **Signing Scheme** | APK Signature Scheme v2 (Full APK block signing) |
| **Signing Status** | Verified (`Verifies: true`) |
| **Minimum SDK** | Android 21 (Lollipop 5.0) |
| **Target SDK** | Android 34 / 35 |
| **Default Production API** | `https://aurapictures.online/api` / `http://aurapictures.online/api` (Dual-Scheme Fallback) |

### 🔐 Keystore & Certificate Details

- **Keystore Path**: `android/app/upload-keystore.jks`
- **Configuration File**: `android/key.properties`
- **Key Alias**: `upload`
- **Owner / DN**: `CN=ARMSS OTT, OU=Engineering, O=ARMSS Group, L=Chennai, ST=Tamil Nadu, C=IN`
- **Certificate SHA-256**: `05:AD:8B:46:E1:7D:8E:3C:D3:DC:30:BD:D0:93:B8:2D:EB:6D:F0:A7:38:0B:C5:01:54:52:E4:5B:4A:1B:8A:F0`
- **Certificate SHA-1**: `7C:39:45:8F:F4:C4:B5:86:8B:6D:92:93:20:DA:B7:3A:AB:4C:60:BE`

### 🔨 Build & Verification Commands

To reproduce the release build:
```bash
cd mobile
flutter build apk --release
```

To verify the APK signature integrity:
```bash
apksigner verify --verbose --print-certs build/app/outputs/flutter-apk/app-release.apk
```

### 📲 Installation on Android Device

Connect your device via USB with USB debugging enabled, then run:
```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

