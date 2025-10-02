#!/bin/bash

# Bypass React Native bundling script for device builds to avoid sandbox issues
# This creates a minimal bundle for testing purposes

echo "🚀 Bypass bundling script for device build"

# Get the destination directory
DEST=$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH

# Create destination directory if it doesn't exist
mkdir -p "$DEST"

# Create a minimal main.jsbundle that will load from the Metro server
cat > "$DEST/main.jsbundle" << 'EOF'
// Minimal bundle - will load from Metro server for development
var __DEV__ = true;
EOF

echo "✅ Minimal bundle created at $DEST/main.jsbundle"

# Skip the IP file creation completely
echo "🔒 Skipping IP file creation to avoid sandbox issues"

exit 0