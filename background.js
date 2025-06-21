// YouTube Vanced Plugin - Optimized Background Service Worker

// 性能优化：缓存和状态管理
let tabStates = new Map(); // 跟踪标签页状态
let cleanupInterval = null;

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings with optimized structure
    const defaultSettings = {
      shortsBlockerEnabled: true,
      shortsOnlyMode: true,
      sponsorBlockEnabled: true,
      adBlockerEnabled: true,
      autoRepeatEnabled: false,
      blockedShortsCount: 0,
      sessionCount: 1,
      lastCleanup: Date.now()
    };
    
    chrome.storage.sync.set(defaultSettings);
    console.log('YouTube Vanced Plugin installed successfully! 🎯');
    
  } else if (details.reason === 'update') {
    console.log('YouTube Vanced Plugin updated to version', chrome.runtime.getManifest().version);
    
    // 更新时清理旧数据
    optimizeStorageOnUpdate();
  }
  
  // 启动优化的清理机制
  startOptimizedCleanup();
});

// 优化的存储清理（更新时）
function optimizeStorageOnUpdate() {
  chrome.storage.sync.get(null, (data) => {
    if (!data || typeof data !== 'object') return;
    
    const updates = {};
    let needsUpdate = false;
    
    // 重置过大的统计数据
    if (data.blockedShortsCount > 50000) {
      updates.blockedShortsCount = Math.min(data.blockedShortsCount, 10000);
      needsUpdate = true;
    }
    
    if (data.sessionCount > 2000) {
      updates.sessionCount = Math.min(data.sessionCount, 100);
      needsUpdate = true;
    }
    
    // 添加清理时间戳
    if (!data.lastCleanup) {
      updates.lastCleanup = Date.now();
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      chrome.storage.sync.set(updates);
    }
  });
}

// Handle tab updates with optimization
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 性能优化：只处理完成状态的YouTube页面
  if (changeInfo.status !== 'complete' || 
      !tab.url || 
      !tab.url.includes('youtube.com')) {
    return;
  }
  
  // 防抖机制：避免重复处理同一个标签页
  const lastUpdate = tabStates.get(tabId);
  const now = Date.now();
  
  if (lastUpdate && (now - lastUpdate) < 1000) {
    return; // 1秒内忽略重复更新
  }
  
  tabStates.set(tabId, now);
  
  // 异步检查设置，避免阻塞
  chrome.storage.sync.get(['shortsBlockerEnabled', 'shortsOnlyMode', 'sponsorBlockEnabled', 'autoRepeatEnabled', 'adBlockerEnabled'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Storage error:', chrome.runtime.lastError);
      return;
    }
    
    if (result && (result.shortsBlockerEnabled || result.shortsOnlyMode)) {
      // 使用更短的延迟，提高响应性
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'reinitialize',
          settings: result,
          timestamp: now
        }).catch(() => {
          // Content script not ready yet, normal behavior
        });
      }, 100);
    }
  });
});

// 优化的消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 性能优化：提前验证请求
  if (!request || typeof request !== 'object' || !request.action) {
    sendResponse({ success: false, message: 'Invalid request format' });
    return false;
  }
  
  // 使用策略模式处理不同消息类型
  const messageHandlers = {
    updateBlockedCount: handleUpdateBlockedCount,
    getStatistics: handleGetStatistics,
    incrementSession: handleIncrementSession,
    batchUpdate: handleBatchUpdate // 新增批量更新处理
  };
  
  const handler = messageHandlers[request.action];
  if (handler) {
    return handler(request, sender, sendResponse);
  } else {
    sendResponse({ success: false, message: 'Unknown action: ' + request.action });
    return false;
  }
});

// 优化的blocked count更新处理
function handleUpdateBlockedCount(request, sender, sendResponse) {
  const count = parseInt(request.count) || 1;
  
  if (count <= 0 || count > 1000) { // 限制单次更新量
    sendResponse({ success: false, message: 'Invalid count value' });
    return false;
  }
  
  chrome.storage.sync.get(['blockedShortsCount'], (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, message: 'Storage error: ' + chrome.runtime.lastError.message });
      return;
    }
    
    if (result && typeof result === 'object') {
      const currentCount = result.blockedShortsCount || 0;
      const newCount = Math.min(currentCount + count, 99999); // 防止数值过大
      
      chrome.storage.sync.set({ 
        blockedShortsCount: newCount,
        lastUpdate: Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, message: 'Failed to update storage' });
        } else {
          sendResponse({ success: true, newCount });
        }
      });
    } else {
      sendResponse({ success: false, message: 'Storage read error' });
    }
  });
  
  return true; // 保持消息通道开放
}

// 优化的统计数据获取
function handleGetStatistics(request, sender, sendResponse) {
  chrome.storage.sync.get(['blockedShortsCount', 'sessionCount', 'lastUpdate'], (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        message: 'Storage error: ' + chrome.runtime.lastError.message
      });
      return;
    }
    
    const response = {
      success: true,
      blockedCount: result.blockedShortsCount || 0,
      sessionCount: result.sessionCount || 1,
      lastUpdate: result.lastUpdate || Date.now()
    };
    
    sendResponse(response);
  });
  
  return true;
}

// 优化的session增量处理
function handleIncrementSession(request, sender, sendResponse) {
  chrome.storage.sync.get(['sessionCount'], (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, message: 'Storage error: ' + chrome.runtime.lastError.message });
      return;
    }
    
    if (result && typeof result === 'object') {
      const newCount = Math.min((result.sessionCount || 1) + 1, 9999); // 限制最大值
      
      chrome.storage.sync.set({ 
        sessionCount: newCount,
        lastSessionUpdate: Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, message: 'Failed to update session count' });
        } else {
          sendResponse({ success: true, newCount });
        }
      });
    } else {
      sendResponse({ success: false, message: 'Session data read error' });
    }
  });
  
  return true;
}

// 新增：批量更新处理
function handleBatchUpdate(request, sender, sendResponse) {
  if (!request.updates || typeof request.updates !== 'object') {
    sendResponse({ success: false, message: 'Invalid batch updates' });
    return false;
  }
  
  // 验证更新数据
  const validatedUpdates = {};
  const updates = request.updates;
  
  if (typeof updates.blockedShortsCount === 'number' && updates.blockedShortsCount >= 0) {
    validatedUpdates.blockedShortsCount = Math.min(updates.blockedShortsCount, 99999);
  }
  
  if (typeof updates.sessionCount === 'number' && updates.sessionCount >= 1) {
    validatedUpdates.sessionCount = Math.min(updates.sessionCount, 9999);
  }
  
  if (Object.keys(validatedUpdates).length === 0) {
    sendResponse({ success: false, message: 'No valid updates provided' });
    return false;
  }
  
  validatedUpdates.lastBatchUpdate = Date.now();
  
  chrome.storage.sync.set(validatedUpdates, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, message: 'Batch update failed' });
    } else {
      sendResponse({ success: true, updated: validatedUpdates });
    }
  });
  
  return true;
}

// 优化的定期清理机制
function startOptimizedCleanup() {
  // 清除可能存在的旧定时器
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  // 降低清理频率，从1小时改为6小时
  cleanupInterval = setInterval(() => {
    performOptimizedCleanup();
  }, 6 * 60 * 60 * 1000); // 6小时
  
  // 启动时执行一次清理
  setTimeout(performOptimizedCleanup, 30000); // 30秒后执行
}

// 执行优化的清理
function performOptimizedCleanup() {
  chrome.storage.sync.get(null, (data) => {
    if (chrome.runtime.lastError) {
      console.warn('Cleanup storage error:', chrome.runtime.lastError);
      return;
    }
    
    if (!data || typeof data !== 'object') {
      console.warn('Storage data is undefined or not an object');
      return;
    }

    try {
      const updates = {};
      let needsUpdate = false;
      const now = Date.now();

      // 智能统计数据管理
      if (data.blockedShortsCount && data.blockedShortsCount > 50000) {
        updates.blockedShortsCount = 50000;
        needsUpdate = true;
      }
      
      if (data.sessionCount && data.sessionCount > 2000) {
        updates.sessionCount = 1000;
        needsUpdate = true;
      }
      
      // 清理过期的临时数据
      if (data.lastUpdate && (now - data.lastUpdate) > 7 * 24 * 60 * 60 * 1000) { // 7天
        // 重置过期统计
        if (data.blockedShortsCount > 10000) {
          updates.blockedShortsCount = Math.floor(data.blockedShortsCount * 0.5);
          needsUpdate = true;
        }
      }
      
      // 更新清理时间戳
      updates.lastCleanup = now;
      needsUpdate = true;

      if (needsUpdate) {
        chrome.storage.sync.set(updates, () => {
          if (chrome.runtime.lastError) {
            console.error('Cleanup update failed:', chrome.runtime.lastError);
          } else {
            console.log('Storage cleanup completed:', updates);
          }
        });
      }
      
      // 清理标签页状态缓存
      cleanupTabStates();
      
    } catch (error) {
      console.error('Error in optimized cleanup:', error);
    }
  });
}

// 清理标签页状态缓存
function cleanupTabStates() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10分钟
  
  for (const [tabId, timestamp] of tabStates.entries()) {
    if (now - timestamp > maxAge) {
      tabStates.delete(tabId);
    }
  }
  
  // 限制缓存大小
  if (tabStates.size > 100) {
    const entries = Array.from(tabStates.entries());
    entries.sort((a, b) => a[1] - b[1]); // 按时间排序
    
    // 删除最旧的一半
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    toDelete.forEach(([tabId]) => tabStates.delete(tabId));
  }
}

// 标签页关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// Service Worker 生命周期管理
chrome.runtime.onStartup.addListener(() => {
  console.log('YouTube Vanced Plugin service worker started');
  startOptimizedCleanup();
});

// 卸载时清理
chrome.runtime.onSuspend.addListener(() => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  tabStates.clear();
  console.log('YouTube Vanced Plugin service worker suspended');
});

console.log('YouTube Vanced Plugin background script loaded! 🚀'); 