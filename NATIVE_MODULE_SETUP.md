# Native Module Setup Guide

## Current Status
✅ App runs successfully with mock call detection service
✅ Error handling implemented for missing native modules
🔄 Native modules created but need manual integration

## Adding iOS CallDetectionModule to Xcode

### Step 1: Open Xcode Project
```bash
open ios/ReliveApp.xcworkspace
```

### Step 2: Add Swift Files to Xcode Project
1. In Xcode, right-click on the `ReliveApp` folder in the navigator
2. Select "Add Files to ReliveApp"
3. Navigate to `ios/ReliveApp/` and select:
   - `CallDetectionModule.swift`
   - `CallDetectionModule.m`
4. Make sure "Copy items if needed" is checked
5. Make sure "ReliveApp" target is selected
6. Click "Add"

### Step 3: Configure Swift Bridging Header
1. In Xcode, you'll be prompted to create a bridging header
2. Click "Create Bridging Header"
3. This creates `ReliveApp-Bridging-Header.h`

### Step 4: Add CallKit Framework
1. Select your project in the navigator (top level "ReliveApp")
2. Select the "ReliveApp" target
3. Go to "Build Phases" tab
4. Expand "Link Binary With Libraries"
5. Click the "+" button
6. Search for and add "CallKit.framework"

### Step 5: Build and Test
```bash
cd ios && pod install && cd ..
npm run ios
```

## Android Native Module Setup

The Android module should already be working since we:
1. ✅ Added the module to `MainApplication.kt`
2. ✅ Added required permissions to `AndroidManifest.xml`
3. ✅ Created the native module files

### Test Android
```bash
npm run android
```

## Testing Call Detection

### Option 1: Test with Mock Service (Current)
The app currently uses a mock service that simulates call detection for UI testing.

### Option 2: Test with Real Call Detection (After Xcode Setup)
1. Complete the iOS Xcode setup above
2. Run the app on a physical device (call detection doesn't work in simulator)
3. Make or receive a phone call
4. Check the app for automatic call detection

### Development Testing Commands
```bash
# Test on iOS simulator (mock service)
npm run ios

# Test on physical iOS device (real call detection after setup)
npm run ios -- --device

# Test on Android emulator (mock service)
npm run android

# Test on Android device (real call detection)
npm run android -- --device
```

## Expected Behavior

### With Mock Service (Current)
- App starts successfully
- Auto-Detection shows "OFF"
- Can toggle permissions and monitoring buttons
- No actual call detection (simulated only)

### With Native Modules (After Setup)
- App starts successfully
- Auto-Detection can be enabled
- Real call detection works on physical devices
- Automatic recording starts/stops with calls

## Troubleshooting

### iOS Build Issues
1. Clean build folder: Xcode → Product → Clean Build Folder
2. Delete derived data: Xcode → Window → Organizer → Projects → Delete
3. Reinstall pods: `cd ios && pod deintegrate && pod install`

### Android Build Issues
1. Clean project: `cd android && ./gradlew clean`
2. Rebuild: `npm run android`

### Module Not Found Errors
- This is expected during development
- The mock service handles missing modules gracefully
- Complete the Xcode setup to enable real functionality

## Next Steps

1. **Complete iOS Setup**: Follow the Xcode steps above
2. **Test on Physical Device**: Call detection requires real device
3. **Add Audio Recording**: Next phase is capturing call audio
4. **Add Transcription**: Convert audio to text for analysis

## Files Created

```
iOS Native Module:
├── ios/ReliveApp/CallDetectionModule.swift
└── ios/ReliveApp/CallDetectionModule.m

Android Native Module:
├── android/app/src/main/java/com/reliveapp/CallDetectionModule.kt
└── android/app/src/main/java/com/reliveapp/CallDetectionPackage.kt

React Native Services:
├── src/services/CallDetectionService.ts
├── src/services/MockCallDetectionService.ts
└── src/hooks/useCallDetection.ts
```

The foundation is complete - now it's just a matter of connecting the native modules to the build system!