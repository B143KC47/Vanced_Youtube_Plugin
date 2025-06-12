// YouTube Vanced Plugin - Background Service Worker (Simplified)

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      shortsBlockerEnabled: true,
      shortsOnlyMode: true,
      blockedShortsCount: 0,
      sessionCount: 1
    });
    
    console.log('YouTube Vanced Plugin installed successfully! 🎯');
  } else if (details.reason === 'update') {
    console.log('YouTube Vanced Plugin updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
    // Inject enhanced functionality when YouTube loads
    chrome.storage.sync.get(['shortsBlockerEnabled', 'shortsOnlyMode'], (result) => {
      if (result && (result.shortsBlockerEnabled || result.shortsOnlyMode)) {
        // Send message to content script if needed
        chrome.tabs.sendMessage(tabId, {
          action: 'reinitialize',
          settings: result
        }).catch(() => {
          // Content script not ready yet, ignore error
        });
      }
    });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    sendResponse({ success: false, message: 'Invalid request' });
    return;
  }

  switch (request.action) {
    case 'updateBlockedCount':
      chrome.storage.sync.get(['blockedShortsCount'], (result) => {
        if (result && typeof result === 'object') {
          const newCount = (result.blockedShortsCount || 0) + (request.count || 1);
          chrome.storage.sync.set({ blockedShortsCount: newCount });
          sendResponse({ success: true, newCount });
        } else {
          sendResponse({ success: false, message: 'Storage read error' });
        }
      });
      return true; // Keep message channel open
      
    case 'getStatistics':
      chrome.storage.sync.get(['blockedShortsCount', 'sessionCount'], (result) => {
        if (result && typeof result === 'object') {
          sendResponse({
            blockedCount: result.blockedShortsCount || 0,
            sessionCount: result.sessionCount || 1
          });
        } else {
          sendResponse({
            blockedCount: 0,
            sessionCount: 1
          });
        }
      });
      return true;
      
    case 'incrementSession':
      chrome.storage.sync.get(['sessionCount'], (result) => {
        if (result && typeof result === 'object') {
          const newCount = (result.sessionCount || 1) + 1;
          chrome.storage.sync.set({ sessionCount: newCount });
          sendResponse({ success: true, newCount });
        } else {
          sendResponse({ success: false, message: 'Storage read error' });
        }
      });
      return true;
      
    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }
});

// Periodic cleanup with safety checks
setInterval(() => {
  chrome.storage.sync.get(null, (data) => {
    // 安全检查：确保data存在且是对象
    if (!data || typeof data !== 'object') {
      console.warn('Storage data is undefined or not an object');
      return;
    }

    // 安全地访问属性
    try {
      let needsUpdate = false;
      const updates = {};

      // Keep statistics reasonable
      if (data.blockedShortsCount && data.blockedShortsCount > 10000) {
        updates.blockedShortsCount = 10000;
        needsUpdate = true;
      }
      
      if (data.sessionCount && data.sessionCount > 1000) {
        updates.sessionCount = 1000;
        needsUpdate = true;
      }

      // 只在需要时更新存储
      if (needsUpdate) {
        chrome.storage.sync.set(updates);
      }
    } catch (error) {
      console.error('Error in periodic cleanup:', error);
    }
  });
}, 3600000); // Every hour

console.log('YouTube Vanced Plugin background script loaded! 🚀'); 