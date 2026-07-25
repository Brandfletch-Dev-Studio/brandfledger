# Brandfledger Android App (TWA Wrapper)

This Android project wraps the Brandfledger web app (`https://brandfledger-three.vercel.app`) into a native Android APK using a WebView-based approach.

## Build Instructions

### Prerequisites
- **Android Studio** (Hedgehog 2023.1.1 or newer)
- **JDK 17** (bundled with Android Studio)
- **Android SDK** (API 34)

### Option A: Build in Android Studio (Recommended)

1. Open Android Studio
2. Select **Open an existing project**
3. Navigate to the `android/` folder in this repo and select it
4. Wait for Gradle sync to complete
5. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
6. The APK will be generated at `android/app/build/outputs/apk/release/app-release.apk` (or `debug/`)

### Option B: Build via Command Line

```bash
cd android
./gradlew assembleRelease
# or for debug:
./gradlew assembleDebug
```

The APK will be at:
- Release: `app/build/outputs/apk/release/app-release.apk`
- Debug: `app/build/outputs/apk/debug/app-debug.apk`

## Signing the Release APK

For production distribution, generate a keystore:

```bash
keytool -genkey -v -keystore brandfledger.keystore \
  -alias brandfledger -keyalg RSA -keysize 2048 -validity 10000
```

Then update `app/build.gradle` with:

```gradle
signingConfigs {
    release {
        storeFile file('../brandfledger.keystore')
        storePassword 'your_password'
        keyAlias 'brandfledger'
        keyPassword 'your_password'
    }
}
```

And change the release `signingConfig` to `signingConfigs.release`.

## App Details

- **Package ID:** `com.brandfledger.app`
- **Min SDK:** 24 (Android 7.0+)
- **Target SDK:** 34 (Android 14)
- **App URL:** `https://brandfledger-three.vercel.app`
- **Deep links:** `https://brandfledger-three.vercel.app` (all paths)
