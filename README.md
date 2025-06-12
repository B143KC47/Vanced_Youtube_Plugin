# YouTube Shorts Blocker Chrome Extension  
📺 油管短视频屏蔽器 - Chrome扩展

A powerful Chrome extension that blocks and hides YouTube Shorts from your YouTube browsing experience.  
一款强大的浏览器扩展，可自动屏蔽YouTube Shorts短视频，还您清爽的观看体验。

## Features 功能特点
- 🚫 **Complete Shorts Blocking**...  
- 🚫 **全面屏蔽**：首页、搜索页、推荐栏中的短视频内容一键消失
- 🔄 **Real-time Detection**...  
- 🔄 **实时监控**：动态加载的内容也逃不过火眼金睛
- 🌐 **URL Redirection**...  
- 🌐 **智能跳转**：误点shorts链接自动转正常视频模式
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

## Installation 安装指南
1. **Download or Clone**...  
1. **获取文件**：下载或克隆本仓库到本地
2. **Open Chrome**...  
2. **打开Chrome**：地址栏输入 `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top right corner
4. **Click "Load unpacked"**...  
4. **加载扩展**：点击「加载已解压的扩展程序」选择项目文件夹
5. **Pin the extension** to your toolbar for easy access

## Usage

1. **Click the extension icon** in your Chrome toolbar
2. **Toggle the switch** to enable/disable shorts blocking
3. **Refresh YouTube pages** to apply changes (automatic refresh for current tab)
4. **Enjoy a shorts-free YouTube experience!**

## Technical Details 技术实现
### How It Works 工作原理
5. **Attribute Detection**...  
5. **特征识别**：通过20+个元素特征精准识别短视频

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

## Privacy 隐私保护
This extension:  
本扩展：
- ✅ Works entirely locally...  
- ✅ 完全本地运行：不上传任何数据
- ✅ Only accesses...  
- ✅ 仅在访问YouTube时激活：不监控其他网站

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension!

## License

This project is open source and available under the MIT License.

---

**Enjoy a distraction-free YouTube experience! 🎉**  
**现在开始，享受纯净的YouTube观看体验吧！🎉** 