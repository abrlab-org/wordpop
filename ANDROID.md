# WordPop! — Android app

The Play Store build wraps the exact same game in a Capacitor shell. There is no
separate mobile codebase: `dist/capacitor-single/index.html` is one self-contained
file, and `src/platform/admob.js` picks itself when it sees the native bridge.

**Package:** `com.abrlab.wordpop` — permanent once published, so change it before
the first upload if you want something different.

## Build

```bash
npm run android:build
```

That runs the single-file web build, `cap sync`, then Gradle. Output:
`android/app/build/outputs/apk/debug/app-debug.apk`

### JDK 21 is required here — not 17

Capacitor 8 compiles against Java 21. Building with JDK 17 fails with
`invalid source release: 21`. This differs from the Expo/React Native projects on
this machine, which need JDK 17, so export it per shell rather than globally:

```bash
export JAVA_HOME=$(ls -d /opt/homebrew/Cellar/openjdk@21/*/libexec/openjdk.jdk/Contents/Home | head -1)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

## Run on the emulator

```bash
emulator -avd Pixel_4_ARM64 -no-snapshot-save > /tmp/emulator.log 2>&1 & disown
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r\n')" = "1" ]; do sleep 3; done
adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.abrlab.wordpop/.MainActivity
```

If the app seems to vanish while testing, check the reason before assuming a bug:

```bash
adb shell dumpsys activity exit-info com.abrlab.wordpop
```

`reason=10 (USER REQUESTED)` and `reason=15 (STATE CHANGE)` are your own
install/force-stop cycles, not crashes. A real fault shows as `reason=6 (ANR)`,
`reason=5 (CRASH_NATIVE)`, or a `FATAL EXCEPTION` in logcat.

## Ads — before you ship

Two values must be swapped together, and both currently hold Google's **public
test** credentials:

| What | Where | Current value |
| --- | --- | --- |
| App ID | `android/app/src/main/AndroidManifest.xml` | `ca-app-pub-3940256099942544~3347511713` |
| Interstitial unit | `src/platform/admob.js` → `AD_UNITS` | `…3940256099942544/1033173712` |
| Rewarded unit | `src/platform/admob.js` → `AD_UNITS` | `…3940256099942544/5224354917` |

Note the App ID uses `~` while ad units use `/`. The manifest entry is not
optional: the Mobile Ads SDK aborts on launch if it is missing.

`admob.js` derives its `isTesting` flag from whether the ad unit still starts
with Google's test publisher prefix. That kills both classic failure modes at
once — shipping with testing left on (ads serve, revenue is zero) and developing
against live units (self-clicks read as invalid traffic, which gets AdMob
accounts suspended). Replace the IDs and the flag flips itself.

## Verified on device

Android 16 (API 36), Pixel_4_ARM64: builds, installs, launches, renders the title
and game screens, and plays. No crash, ANR, or native fault in `exit-info`.

Not yet verified: live ad fill (needs a real AdMob account), and emoji coverage on
older Android. The emulator runs API 36, which has complete emoji fonts; budget
devices on Android 10–12 may show blank glyphs for the newest characters. The
vocabulary deliberately sticks to Unicode ≤ 13 (2020) apart from one pre-existing
`🩷`, so exposure is small — worth a spot check on a real low-end device.
