#!/bin/bash

echo "🚀 Installing Relive App on Device"
echo "Please ensure your iPhone is:"
echo "1. ✅ Unlocked (not showing passcode screen)"
echo "2. ✅ Connected via USB"
echo "3. ✅ Trusted for development (should have been done earlier)"
echo ""

# Check if device is connected
DEVICE_ID="00008140-0014149E2082201C"
if xcrun devicectl list devices | grep -q "$DEVICE_ID"; then
    echo "✅ Victor's iPhone detected and connected"
else
    echo "❌ iPhone not found. Please connect your device."
    exit 1
fi

echo ""
echo "🔨 Building and installing app..."

# Make sure we're in the iOS directory
cd ios

# Build and install the app
xcodebuild -workspace ReliveApp.xcworkspace \
           -scheme ReliveApp \
           -configuration Debug \
           -destination "platform=iOS,id=$DEVICE_ID" \
           -allowProvisioningUpdates \
           build \
           | grep -E "(error|warning|BUILD SUCCEEDED|BUILD FAILED)"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"

    # Try to install the app
    echo "📱 Installing app on device..."
    xcrun devicectl device install app \
        --device "$DEVICE_ID" \
        build/Build/Products/Debug-iphoneos/ReliveApp.app

    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 SUCCESS! ReliveApp has been installed on your iPhone!"
        echo "📱 You can now find the Relive app on your device's home screen."

        # Try to launch the app
        echo "🚀 Attempting to launch the app..."
        xcrun devicectl device process launch \
            --device "$DEVICE_ID" \
            --start-stopped \
            com.ReliveApp
    else
        echo ""
        echo "❌ Installation failed. The app was built but couldn't be installed."
        echo "💡 You can try installing manually through Xcode:"
        echo "   1. Open ReliveApp.xcworkspace in Xcode"
        echo "   2. Select your device as the destination"
        echo "   3. Click the Run button (▶️)"
    fi
else
    echo ""
    echo "❌ Build failed. Please check the errors above."
fi