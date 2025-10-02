#!/bin/bash

# Configure iOS Code Signing for Relive App
# This script helps set up the development team for device deployment

echo "🔧 Configuring iOS Code Signing for Relive App"
echo "==============================================="

# Get the project file path
PROJECT_PATH="ios/ReliveApp.xcodeproj/project.pbxproj"

# Check if project file exists
if [ ! -f "$PROJECT_PATH" ]; then
    echo "❌ Error: Xcode project file not found at $PROJECT_PATH"
    exit 1
fi

# List available development teams
echo "📋 Available Development Teams:"
security find-identity -v -p codesigning | grep "Apple Development"

echo ""
echo "🔍 Current Bundle Identifier:"
grep -A 1 "PRODUCT_BUNDLE_IDENTIFIER" "$PROJECT_PATH" | grep -v "PRODUCT_BUNDLE_IDENTIFIER" | head -1 | sed 's/.*= //;s/;//'

echo ""
echo "⚙️  Manual Steps Required in Xcode:"
echo "1. Open the Xcode workspace: ios/ReliveApp.xcworkspace"
echo "2. Select 'ReliveApp' project in the navigator"
echo "3. Select 'ReliveApp' target"
echo "4. Go to 'Signing & Capabilities' tab"
echo "5. Check 'Automatically manage signing'"
echo "6. Select your Team (Apple Development account)"
echo "7. Xcode will automatically generate a bundle identifier"
echo ""
echo "📱 After signing is configured, run:"
echo "   npx react-native run-ios --device"
echo ""
echo "🔧 Alternative: Use this script to set team automatically"

# Function to set development team
set_development_team() {
    local team_id="$1"

    if [ -z "$team_id" ]; then
        echo "❌ Error: No team ID provided"
        return 1
    fi

    echo "🔧 Setting development team to: $team_id"

    # Create a backup of the project file
    cp "$PROJECT_PATH" "$PROJECT_PATH.backup"

    # Set the development team using sed
    sed -i '' "s/DEVELOPMENT_TEAM = \"\";/DEVELOPMENT_TEAM = \"$team_id\";/g" "$PROJECT_PATH"
    sed -i '' "s/DEVELOPMENT_TEAM = ;/DEVELOPMENT_TEAM = \"$team_id\";/g" "$PROJECT_PATH"

    # Add development team if it doesn't exist
    if ! grep -q "DEVELOPMENT_TEAM" "$PROJECT_PATH"; then
        echo "Adding DEVELOPMENT_TEAM configuration..."
        # This is a complex operation, better to do it in Xcode
        echo "⚠️  Please use Xcode to configure the development team."
        return 1
    fi

    echo "✅ Development team configured"
    echo "📱 Now run: npx react-native run-ios --device"
}

# Check if team ID is provided as argument
if [ ! -z "$1" ]; then
    set_development_team "$1"
else
    echo "💡 To automatically set the team, run:"
    echo "   ./scripts/configure-signing.sh YOUR_TEAM_ID"
    echo ""
    echo "   Example team IDs from your certificates:"
    security find-identity -v -p codesigning | grep "Apple Development" | sed 's/.*(\(.*\)).*/   \1/'
fi