#!/bin/bash
# scripts/increment-build.sh

# Target the pbxproj file
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
    echo "❌ Error: $PBXPROJ not found!"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(grep "CURRENT_PROJECT_VERSION =" "$PBXPROJ" | head -n 1 | sed 's/.*= \(.*\);/\1/')
NEW_VERSION=$((CURRENT_VERSION + 1))

echo "🔄 Incrementing build number: $CURRENT_VERSION -> $NEW_VERSION"

# Use sed to replace all occurrences
# (On macOS, sed -i requires an empty string argument for the backup extension)
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_VERSION;/CURRENT_PROJECT_VERSION = $NEW_VERSION;/g" "$PBXPROJ"
else
    sed -i "s/CURRENT_PROJECT_VERSION = $CURRENT_VERSION;/CURRENT_PROJECT_VERSION = $NEW_VERSION;/g" "$PBXPROJ"
fi

echo "✅ Done!"
