#!/bin/bash

# Fix iOS Build Sandbox Issues for Relive App
echo "🔧 Fixing iOS Build Sandbox Issues"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the ReliveApp root directory"
    exit 1
fi

echo "🧹 Cleaning build artifacts..."

# Clean React Native cache
echo "• Clearing React Native cache..."
npx react-native start --reset-cache --port 8081 > /dev/null 2>&1 &
METRO_PID=$!
sleep 2
kill $METRO_PID 2>/dev/null

# Clean iOS build
echo "• Cleaning iOS build directory..."
rm -rf ios/build
rm -rf ios/DerivedData

# Clean Xcode DerivedData
echo "• Cleaning Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/ReliveApp-*

# Clean node modules cache
echo "• Cleaning node modules cache..."
rm -rf node_modules/.cache
rm -rf /tmp/metro-*

# Clean CocoaPods cache
echo "• Cleaning CocoaPods cache..."
cd ios
pod deintegrate > /dev/null 2>&1
pod install
cd ..

echo "✅ Build artifacts cleaned"

echo ""
echo "🔧 Fixing Metro configuration..."

# Create or update metro.config.js to handle the ip.txt issue
cat > metro.config.js << 'EOF'
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Handle ip.txt requests that cause sandbox issues
        if (req.url.endsWith('/ip.txt')) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('127.0.0.1');
          return;
        }
        return middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
EOF

echo "✅ Metro configuration updated"

echo ""
echo "🍎 iOS Bundle Configuration..."

# Check and update .xcode.env if needed
if [ -f "ios/.xcode.env" ]; then
    echo "• Updating .xcode.env..."
    # Ensure proper Metro configuration
    if ! grep -q "export NODE_BINARY" ios/.xcode.env; then
        echo "export NODE_BINARY=node" >> ios/.xcode.env
    fi
else
    echo "• Creating .xcode.env..."
    cat > ios/.xcode.env << 'EOF'
export NODE_BINARY=node
export SKIP_BUNDLING=1
EOF
fi

echo "✅ iOS configuration updated"

echo ""
echo "🔐 Checking code signing..."

# Verify code signing configuration
if grep -q "DEVELOPMENT_TEAM" ios/ReliveApp.xcodeproj/project.pbxproj; then
    TEAM_ID=$(grep "DEVELOPMENT_TEAM" ios/ReliveApp.xcodeproj/project.pbxproj | head -1 | sed 's/.*= //;s/;//' | tr -d '"')
    echo "• Development team configured: $TEAM_ID"
else
    echo "⚠️  Development team not configured"
    echo "   Please configure in Xcode: Signing & Capabilities"
fi

echo ""
echo "🚀 Ready to build! Try one of these options:"
echo ""
echo "Option 1 - Xcode (Recommended):"
echo "   1. Open ios/ReliveApp.xcworkspace in Xcode"
echo "   2. Select your iPhone in device dropdown"
echo "   3. Click the Play button ▶️"
echo ""
echo "Option 2 - Command Line:"
echo "   npx react-native run-ios --device"
echo ""
echo "Option 3 - Clean Build in Xcode:"
echo "   1. In Xcode: Product → Clean Build Folder"
echo "   2. Build and run"

# Auto-open Xcode if requested
read -p "Open Xcode workspace now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open ios/ReliveApp.xcworkspace
fi