#!/bin/bash
# Custom React Native Xcode script that avoids sandbox issues

set -e

# Source the environment
WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
source "$WITH_ENVIRONMENT"

# Get the destination directory
DEST=$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH

# Skip IP detection for device builds to avoid sandbox issues
if [[ "$PLATFORM_NAME" == "iphoneos" ]]; then
    echo "Skipping IP detection for device build to avoid sandbox issues"
    export SKIP_BUNDLING=1
fi

# Check if we should skip bundling
if [[ -n "$SKIP_BUNDLING" ]]; then
    echo "Skipping bundling due to SKIP_BUNDLING environment variable"
    exit 0
fi

# For simulator builds, proceed normally
if [[ "$PLATFORM_NAME" == "iphonesimulator" ]]; then
    # Run the standard React Native Xcode script
    "$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"
else
    echo "Device build detected - creating minimal bundle"
    # Create a minimal main.jsbundle for device builds
    mkdir -p "$DEST"
    echo "// Minimal bundle for device testing" > "$DEST/main.jsbundle"
fi