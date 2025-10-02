#!/bin/bash

# Quick iPhone Installation Script for Relive App
# This script will help install the app on your iPhone

echo "📱 Relive App - iPhone Installation"
echo "==================================="

# Check if device is connected
echo "🔍 Checking connected devices..."
DEVICE_COUNT=$(xcrun devicectl list devices | grep "iPhone" | grep "available" | wc -l)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "❌ No iPhone devices found. Please:"
    echo "   1. Connect your iPhone with USB cable"
    echo "   2. Trust this computer on your iPhone"
    echo "   3. Run this script again"
    exit 1
fi

echo "✅ Found iPhone device(s)"

# Check for team configuration
echo "🔍 Checking code signing configuration..."

if ! grep -q "44AJZS8RLH" ios/ReliveApp.xcodeproj/project.pbxproj 2>/dev/null; then
    echo "⚠️  Code signing not configured. Please:"
    echo ""
    echo "📋 Manual Configuration Required:"
    echo "1. Open ios/ReliveApp.xcworkspace in Xcode"
    echo "2. Select ReliveApp project → ReliveApp target"
    echo "3. Go to 'Signing & Capabilities' tab"
    echo "4. Check ✅ 'Automatically manage signing'"
    echo "5. Select Team: 'Suresh Victor (44AJZS8RLH)'"
    echo "6. Run this script again"
    echo ""
    echo "🚀 Quick Open Xcode:"
    echo "   open ios/ReliveApp.xcworkspace"
    exit 1
fi

echo "✅ Code signing appears to be configured"

# Build and install
echo "🔨 Building and installing Relive app..."
echo "   This may take 2-3 minutes..."

# Start metro bundler if not running
if ! lsof -i :8081 >/dev/null 2>&1; then
    echo "🚀 Starting Metro bundler..."
    npx react-native start --port 8081 >/dev/null 2>&1 &
    METRO_PID=$!
    sleep 5
fi

# Install on device
echo "📱 Installing on device..."
if npx react-native run-ios --device 2>&1; then
    echo ""
    echo "🎉 SUCCESS! Relive app installed on your iPhone"
    echo ""
    echo "📱 Next Steps:"
    echo "1. Check your iPhone home screen for 'ReliveApp'"
    echo "2. If prompted, go to Settings → General → VPN & Device Management"
    echo "3. Trust the developer certificate"
    echo "4. Open the app and test the service dashboard"
    echo ""
    echo "🔧 Testing Features:"
    echo "• Tap 'Test Audio Recording' to check microphone permissions"
    echo "• Tap 'Test Encryption' to verify security systems"
    echo "• Tap 'Test OpenAI Integration' to check AI features"
else
    echo ""
    echo "❌ Installation failed. Common solutions:"
    echo ""
    echo "1. 🔐 Code Signing Issue:"
    echo "   • Open ios/ReliveApp.xcworkspace in Xcode"
    echo "   • Configure signing as described above"
    echo ""
    echo "2. 📱 Device Trust Issue:"
    echo "   • On your iPhone: Settings → General → VPN & Device Management"
    echo "   • Trust the developer certificate"
    echo ""
    echo "3. 🔌 Connection Issue:"
    echo "   • Disconnect and reconnect iPhone"
    echo "   • Trust this computer when prompted"
    echo ""
    echo "4. 🧹 Clean Build:"
    echo "   • In Xcode: Product → Clean Build Folder"
    echo "   • Run this script again"
fi

# Cleanup
if [ ! -z "$METRO_PID" ]; then
    kill $METRO_PID >/dev/null 2>&1
fi