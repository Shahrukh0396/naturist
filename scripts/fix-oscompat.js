const fs = require('fs');
const path = require('path');

// Fix the umbrella header
const umbrellaPath = 'ios/Pods/Target Support Files/React-oscompat/React-oscompat-umbrella.h';

if (fs.existsSync(umbrellaPath)) {
  let content = fs.readFileSync(umbrellaPath, 'utf8');
  
  // Replace double quotes with angle brackets
  content = content.replace(/#import "OSCompat\.h"/g, '#import <oscompat/OSCompat.h>');
  
  fs.writeFileSync(umbrellaPath, content, 'utf8');
  console.log('✅ Fixed React-oscompat umbrella header');
} else {
  console.log('⚠️  Umbrella header not found yet (will be created by pod install)');
}
