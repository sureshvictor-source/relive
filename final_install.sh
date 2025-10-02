#!/bin/bash

echo "🎯 FINAL RELIVE APP INSTALLATION ATTEMPT"
echo "=========================================="

# Make sure we're in the right directory
cd "$(dirname "$0")"

echo "📍 Current directory: $(pwd)"
echo ""

# Check device connection
echo "📱 Checking device connection..."
DEVICE_COUNT=$(xcrun devicectl list devices | grep "iPhone" | wc -l)
if [ $DEVICE_COUNT -eq 0 ]; then
    echo "❌ No iPhone detected. Please ensure your device is:"
    echo "   - Connected via USB"
    echo "   - Unlocked (showing home screen)"
    echo "   - Trusted for development"
    exit 1
fi

echo "✅ iPhone detected"
DEVICE_ID=$(xcrun devicectl list devices | grep iPhone | awk '{print $NF}' | head -1)
echo "📱 Device ID: $DEVICE_ID"
echo ""

# Check Metro server
echo "🚀 Checking Metro server..."
if lsof -i :8082 > /dev/null 2>&1; then
    echo "✅ Metro server running on port 8082"
else
    echo "🔄 Starting Metro server..."
    npx react-native start --port 8082 &
    METRO_PID=$!
    echo "⏳ Waiting for Metro to start..."
    sleep 5
fi
echo ""

# Clean and build
echo "🧹 Cleaning previous builds..."
cd ios
rm -rf build/ DerivedData/ 2>/dev/null || true
cd ..

echo ""
echo "🔨 Building and installing app..."
echo "This may take several minutes..."

# Use React Native CLI with specific configuration
METRO_PORT=8082 npx react-native run-ios \
    --device="$DEVICE_ID" \
    --configuration Debug \
    --verbose

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! ReliveApp should now be installed on your iPhone!"
    echo "📱 Look for the app icon on your home screen"
    echo "🚀 The Metro server is running and ready to serve updates"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Find ReliveApp on your iPhone home screen"
    echo "   2. Tap to launch the app"
    echo "   3. Test the app functionality"
else
    echo ""
    echo "❌ Build failed with status code: $BUILD_STATUS"
    echo ""
    echo "🔧 Alternative: Try manual installation via Xcode"
    echo "   1. Open ios/ReliveApp.xcworkspace in Xcode"
    echo "   2. Select your iPhone from the device dropdown"
    echo "   3. Click the Run button (▶️)"
    echo ""
    echo "🐛 If issues persist, check:"
    echo "   - iPhone is unlocked and trusted"
    echo "   - Xcode signing configuration is correct"
    echo "   - No other build processes are running"
fi

exit $BUILD_STATUS