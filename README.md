# YouTube Shorts Blocker Chrome Extension

A powerful Chrome extension that blocks and hides YouTube Shorts from your YouTube browsing experience.

## Features

- 🚫 **Complete Shorts Blocking**: Hides YouTube Shorts from homepage, search results, and recommendations
- 🔄 **Real-time Detection**: Automatically detects and blocks newly loaded shorts content
- 🎯 **Smart Filtering**: Uses multiple detection methods including URL patterns, video duration, and element attributes
- 🌐 **URL Redirection**: Automatically redirects shorts URLs to regular video format
- ⚡ **Toggle Control**: Easy on/off toggle through popup interface
- 🎨 **Clean UI**: Modern, intuitive popup interface with visual status indicators
- 💾 **Persistent Settings**: Remembers your preferences across browser sessions

## What Gets Blocked

- YouTube Shorts shelf on homepage
- Individual shorts videos in feeds
- Shorts in search results
- Shorts tab in navigation menu
- Shorts recommendations in sidebar
- Direct shorts URLs (redirected to regular video format)
- Mobile shorts elements

## Installation

1. **Download or Clone** this repository to your computer
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right corner
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your toolbar for easy access

## Usage

1. **Click the extension icon** in your Chrome toolbar
2. **Toggle the switch** to enable/disable shorts blocking
3. **Refresh YouTube pages** to apply changes (automatic refresh for current tab)
4. **Enjoy a shorts-free YouTube experience!**

## Technical Details

### Files Structure
- `manifest.json` - Extension configuration and permissions
- `content.js` - Main content script that detects and hides shorts
- `styles.css` - CSS rules for hiding shorts elements
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality and settings management
- `icons/` - Extension icons (16px, 48px, 128px)

### How It Works

The extension uses multiple detection methods:

1. **CSS Selectors**: Targets specific YouTube element classes and attributes
2. **URL Pattern Matching**: Detects "/shorts/" in video URLs
3. **Duration Analysis**: Identifies short-form content by video length
4. **Mutation Observer**: Monitors page changes for dynamically loaded content
5. **Attribute Detection**: Looks for shorts-specific element attributes

### Browser Permissions

- `activeTab`: To interact with YouTube pages
- `storage`: To save user preferences

## Compatibility

- ✅ Chrome (Manifest V3)
- ✅ YouTube desktop site
- ✅ YouTube mobile site (when accessed through Chrome)
- ✅ All YouTube page types (homepage, search, watch, channel pages)

## Troubleshooting

**Shorts still appearing?**
- Try refreshing the YouTube page
- Check that the extension is enabled in the popup
- Ensure you're on a YouTube page (*.youtube.com)

**Extension not working?**
- Verify the extension is enabled in `chrome://extensions/`
- Check for Chrome updates
- Try reloading the extension

## Privacy

This extension:
- ✅ Works entirely locally in your browser
- ✅ Does not collect or transmit any data
- ✅ Does not require internet connectivity
- ✅ Only accesses YouTube pages when you visit them

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension!

## License

This project is open source and available under the MIT License.

---

**Enjoy a distraction-free YouTube experience! 🎉** 