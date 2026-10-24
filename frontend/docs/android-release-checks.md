# Android release verification

Build the optimized, upload-key-signed artifacts with:

```
cd android
./gradlew :app:bundleRelease :app:assembleRelease
```

Both release tasks run `scripts/verify-release-jni.cjs` against the packaged DEX.
The check requires the actual class definitions and JNI method names; finding a
class name in a DEX string table is not sufficient. It rejects the broken
version 15 artifact, where R8 removed `CxxInspectorPackagerConnection` and its
`DelegateImpl`.

React Native 0.82 initializes `react_devsupportjni` through `InspectorFlags` in
production builds. Its native registration looks up the connection classes by
name even though the optimizer sees no reachable Java call to them. Keep the
targeted rules in `android/app/proguard-rules.pro` until a React Native upgrade
provides equivalent consumer rules. Do not disable optimization to bypass this
check.

The packaged check can also be run separately:

```
node scripts/verify-release-jni.cjs android/app/build/outputs/bundle/release/app-release.aab
node scripts/verify-release-jni.cjs android/app/build/outputs/apk/release/app-release.apk
```

Before distributing a release:

1. Validate the AAB with bundletool, check the package/version and upload-key
   certificate, and retain the matching R8 mapping file.
2. Check native ELF LOAD alignment and APK ZIP alignment for 16 KB pages.
3. Install the release on an isolated test device. Check its actual page size
   with `adb -s SERIAL shell getconf PAGE_SIZE`; a 16 KB test must return `16384`.
4. Cold-start the app and exercise guest navigation and sign-in while collecting
   crash logs. A debug build or a successful Gradle build is not a substitute
   for running the optimized release. Record ABI translation if the emulator
   runs ARM64 libraries on an x86_64 host.
5. Check Play's device-lab result for the uploaded version. A startup crash on
   its 16 KB device can be caused by Java/JNI failures as well as page alignment;
   inspect the complete stack trace before changing native build settings.

Use an isolated emulator when the connected phone has a Play-signed install
that does not accept an APK signed with the upload key. Do not uninstall a
user's app or clear its data just to make a test installation succeed.
