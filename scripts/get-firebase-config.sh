#!/bin/bash

# Script to extract Firebase config from mobile app config files
# This allows you to use the sync script without creating a web app

echo "🔍 Extracting Firebase config from mobile app config files..."
echo ""

# Check for Android config
if [ -f "android/app/google-services.json" ]; then
    echo "✅ Found android/app/google-services.json"
    
    # Extract values using jq (if available) or grep
    if command -v jq &> /dev/null; then
        PROJECT_ID=$(jq -r '.project_info.project_id' android/app/google-services.json)
        DATABASE_URL="https://${PROJECT_ID}-default-rtdb.firebaseio.com"
        STORAGE_BUCKET="${PROJECT_ID}.appspot.com"
        API_KEY=$(jq -r '.client[0].api_key[0].current_key' android/app/google-services.json)
        MESSAGING_SENDER_ID=$(jq -r '.project_info.project_number' android/app/google-services.json)
        
        echo ""
        echo "📋 Add these to your environment variables:"
        echo ""
        echo "export FIREBASE_PROJECT_ID=\"${PROJECT_ID}\""
        echo "export FIREBASE_DATABASE_URL=\"${DATABASE_URL}\""
        echo "export FIREBASE_STORAGE_BUCKET=\"${STORAGE_BUCKET}\""
        echo "export FIREBASE_API_KEY=\"${API_KEY}\""
        echo "export FIREBASE_MESSAGING_SENDER_ID=\"${MESSAGING_SENDER_ID}\""
        echo "export FIREBASE_AUTH_DOMAIN=\"${PROJECT_ID}.firebaseapp.com\""
        echo "export FIREBASE_APP_ID=\"1:${MESSAGING_SENDER_ID}:web:$(openssl rand -hex 8)\""
        echo ""
        echo "💡 Note: FIREBASE_APP_ID can be any value for the sync script"
    else
        echo "⚠️  jq is not installed. Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
        echo ""
        echo "Or manually extract values from android/app/google-services.json:"
        echo "  - project_id"
        echo "  - project_number"
        echo "  - api_key[0].current_key"
    fi
else
    echo "❌ android/app/google-services.json not found"
fi

# Check for iOS config
if [ -f "ios/naturism/GoogleService-Info.plist" ]; then
    echo ""
    echo "✅ Found ios/naturism/GoogleService-Info.plist"
    echo "💡 iOS config file uses different format. Use Android config or create a web app."
else
    echo ""
    echo "⚠️  ios/naturism/GoogleService-Info.plist not found"
fi

echo ""
echo "📝 After setting environment variables, run:"
echo "   npm run sync-firebase:test"

