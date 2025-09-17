#!/bin/bash

# Script to add CallDetectionModule files to Xcode project
# This automates the manual Xcode integration process

echo "🔧 Adding CallDetectionModule files to Xcode project..."

# Change to iOS directory
cd ios

# Check if files exist
if [ ! -f "ReliveApp/CallDetectionModule.swift" ]; then
    echo "❌ CallDetectionModule.swift not found"
    exit 1
fi

if [ ! -f "ReliveApp/CallDetectionModule.m" ]; then
    echo "❌ CallDetectionModule.m not found"
    exit 1
fi

echo "✅ Found CallDetectionModule files"

# Use ruby script to modify project.pbxproj
cat > add_to_project.rb << 'EOF'
require 'xcodeproj'

project_path = 'ReliveApp.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main app target
target = project.targets.find { |t| t.name == 'ReliveApp' }

# Find the ReliveApp group
main_group = project.main_group.find_subpath('ReliveApp', true)

# Add CallDetectionModule.swift
swift_file = main_group.new_file('ReliveApp/CallDetectionModule.swift')
target.source_build_phase.add_file_reference(swift_file)

# Add CallDetectionModule.m
objc_file = main_group.new_file('ReliveApp/CallDetectionModule.m')
target.source_build_phase.add_file_reference(objc_file)

# Add CallKit framework
callkit_framework = project.frameworks_group.new_file('System/Library/Frameworks/CallKit.framework')
callkit_framework.source_tree = 'SDKROOT'
target.frameworks_build_phase.add_file_reference(callkit_framework)

# Save the project
project.save

puts "✅ Successfully added CallDetectionModule files to Xcode project"
puts "✅ Added CallKit framework"
puts "📱 Files added:"
puts "   - CallDetectionModule.swift"
puts "   - CallDetectionModule.m"
puts "   - CallKit.framework"
EOF

# Check if xcodeproj gem is available
if ! gem list xcodeproj -i > /dev/null 2>&1; then
    echo "📦 Installing xcodeproj gem..."
    gem install xcodeproj
fi

# Run the ruby script
echo "🔧 Modifying Xcode project..."
ruby add_to_project.rb

# Clean up
rm add_to_project.rb

echo "✅ CallDetectionModule integration complete!"
echo ""
echo "Next steps:"
echo "1. Build the project: npm run ios"
echo "2. Test on physical device for call detection"
echo "3. Check for any Swift bridging header prompts"