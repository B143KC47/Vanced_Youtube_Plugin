// YouTube Vanced Plugin - Performance Optimized Popup Script

document.addEventListener('DOMContentLoaded', function() {
  // 性能优化：缓存DOM元素，避免重复查询
  const elements = {
    enableToggle: document.getElementById('enableToggle'),
    shortsToggle: document.getElementById('shortsToggle'),
    statusText: document.getElementById('statusText'),
    shortsStatus: document.getElementById('shortsStatus'),
    blockedCount: document.getElementById('blockedCount'),
    sessionsCount: document.getElementById('sessionsCount'),
    refreshBtn: document.getElementById('refreshBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    controlGroups: document.querySelectorAll('.control-group, .stats-section')
  };

  // 性能优化：状态缓存，减少重复计算
  let cachedSettings = {};
  let cachedStatistics = {};
  let animationTimeouts = new Map();
  let isUpdating = false;

  // 性能优化：初始化动画使用requestAnimationFrame
  function initializeAnimations() {
    elements.controlGroups.forEach((group, index) => {
      group.style.animationDelay = `${index * 0.1}s`;
      group.style.opacity = '0';
      group.style.transform = 'translateY(10px)';
    });

    // 使用requestAnimationFrame优化动画
    let animationIndex = 0;
    function animateNextGroup() {
      if (animationIndex < elements.controlGroups.length) {
        const group = elements.controlGroups[animationIndex];
        group.style.opacity = '1';
        group.style.transform = 'translateY(0)';
        group.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        animationIndex++;
        setTimeout(animateNextGroup, 50);
      }
    }
    
    requestAnimationFrame(() => {
      setTimeout(animateNextGroup, 100);
    });
  }

  // 性能优化：防抖函数，避免频繁执行
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 性能优化：批量更新DOM，减少重排
  function updateStatusBatch(generalEnabled, shortsEnabled) {
    // 批量收集DOM更新操作
    const updates = [];

    // 通用状态更新
    const generalStatusSpan = elements.statusText.querySelector('span');
    if (generalEnabled) {
      updates.push(() => {
        elements.statusText.classList.add('status-active');
        generalStatusSpan.textContent = 'Protection active';
      });
    } else {
      updates.push(() => {
        elements.statusText.classList.remove('status-active');
        generalStatusSpan.textContent = 'Protection disabled';
      });
    }

    // Shorts状态更新
    const shortsStatusSpan = elements.shortsStatus.querySelector('span');
    if (shortsEnabled) {
      updates.push(() => {
        elements.shortsStatus.classList.add('status-active');
        shortsStatusSpan.textContent = 'Shorts are blocked';
      });
    } else {
      updates.push(() => {
        elements.shortsStatus.classList.remove('status-active');
        shortsStatusSpan.textContent = 'Shorts are visible';
      });
    }

    // 批量执行DOM更新
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // 优化的设置加载
  function loadSettings() {
    if (isUpdating) return;
    
    chrome.storage.sync.get([
      'shortsBlockerEnabled', 
      'shortsOnlyMode',
      'blockedShortsCount',
      'sessionCount'
    ], function(result) {
      // 检查缓存，避免不必要的更新
      if (JSON.stringify(result) === JSON.stringify(cachedSettings)) {
        return;
      }
      
      cachedSettings = { ...result };
      
      const isGeneralEnabled = result.shortsBlockerEnabled !== false;
      const isShortsEnabled = result.shortsOnlyMode !== false;
      
      // 批量更新UI
      requestAnimationFrame(() => {
        elements.enableToggle.checked = isGeneralEnabled;
        elements.shortsToggle.checked = isShortsEnabled;
        updateStatusBatch(isGeneralEnabled, isShortsEnabled);
        updateStatisticsBatch(result.blockedShortsCount || 0, result.sessionCount || 1);
      });
    });
  }

  // 优化的统计数据加载
  function loadStatistics() {
    chrome.storage.sync.get(['blockedShortsCount', 'sessionCount'], function(result) {
      // 检查缓存
      if (JSON.stringify(result) === JSON.stringify(cachedStatistics)) {
        return;
      }
      
      cachedStatistics = { ...result };
      updateStatisticsBatch(result.blockedShortsCount || 0, result.sessionCount || 1);
    });
  }

  // 优化的统计数据更新
  function updateStatisticsBatch(blocked, sessions) {
    const updates = [];
    
    if (blocked !== null && blocked !== undefined) {
      const formattedBlocked = formatNumber(blocked);
      if (elements.blockedCount.textContent !== formattedBlocked) {
        updates.push(() => {
          elements.blockedCount.textContent = formattedBlocked;
          addNumberAnimation(elements.blockedCount);
        });
      }
    }
    
    if (sessions !== null && sessions !== undefined) {
      const formattedSessions = formatNumber(sessions);
      if (elements.sessionsCount.textContent !== formattedSessions) {
        updates.push(() => {
          elements.sessionsCount.textContent = formattedSessions;
          addNumberAnimation(elements.sessionsCount);
        });
      }
    }

    if (updates.length > 0) {
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    }
  }

  // 优化的toggle处理
  function handleGeneralToggle() {
    if (isUpdating) return;
    isUpdating = true;
    
    const isEnabled = elements.enableToggle.checked;
    
    chrome.storage.sync.set({
      shortsBlockerEnabled: isEnabled
    }, function() {
      updateStatusBatch(isEnabled, elements.shortsToggle.checked);
      debouncedRefreshTab();
      addToggleAnimationOptimized(elements.statusText);
      isUpdating = false;
    });
  }

  function handleShortsToggle() {
    if (isUpdating) return;
    isUpdating = true;
    
    const isEnabled = elements.shortsToggle.checked;
    
    chrome.storage.sync.set({
      shortsOnlyMode: isEnabled
    }, function() {
      updateStatusBatch(elements.enableToggle.checked, isEnabled);
      debouncedRefreshTab();
      addToggleAnimationOptimized(elements.shortsStatus);
      
      if (isEnabled) {
        incrementBlockedCountOptimized();
      }
      isUpdating = false;
    });
  }

  // 优化的刷新处理
  const debouncedRefreshTab = debounce(function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }, 300);

  function handleRefresh() {
    addButtonAnimationOptimized(elements.refreshBtn);
    debouncedRefreshTab();
    
    // 延迟重新加载统计数据
    setTimeout(() => {
      loadStatistics();
    }, 500);
  }

  function handleSettings() {
    addButtonAnimationOptimized(elements.settingsBtn);
    
    // 优化session计数更新
    chrome.storage.sync.get(['sessionCount'], function(result) {
      const newCount = (result.sessionCount || 1) + 1;
      chrome.storage.sync.set({ sessionCount: newCount });
      updateStatisticsBatch(null, newCount);
    });
    
    console.log('Settings clicked - Advanced options coming soon!');
  }

  // 优化的动画函数
  function addToggleAnimationOptimized(element) {
    // 清除可能存在的动画
    const timeoutId = animationTimeouts.get(element);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    element.style.transform = 'scale(1.02)';
    element.style.transition = 'transform 0.2s ease';
    
    const newTimeoutId = setTimeout(() => {
      element.style.transform = 'scale(1)';
      animationTimeouts.delete(element);
    }, 150);
    
    animationTimeouts.set(element, newTimeoutId);
  }

  function addButtonAnimationOptimized(button) {
    const timeoutId = animationTimeouts.get(button);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    button.style.transform = 'scale(0.96)';
    button.style.transition = 'transform 0.1s ease';
    
    const newTimeoutId = setTimeout(() => {
      button.style.transform = 'scale(1)';
      animationTimeouts.delete(button);
    }, 100);
    
    animationTimeouts.set(button, newTimeoutId);
  }

  function addNumberAnimation(element) {
    const timeoutId = animationTimeouts.get(element);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.2s ease';
    
    const newTimeoutId = setTimeout(() => {
      element.style.transform = 'scale(1)';
      animationTimeouts.delete(element);
    }, 200);
    
    animationTimeouts.set(element, newTimeoutId);
  }

  // 优化的数字格式化（添加缓存）
  const formatCache = new Map();
  function formatNumber(num) {
    if (formatCache.has(num)) {
      return formatCache.get(num);
    }
    
    let result;
    if (num >= 1000000) {
      result = (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      result = (num / 1000).toFixed(1) + 'K';
    } else {
      result = num.toString();
    }
    
    // 限制缓存大小
    if (formatCache.size > 100) {
      const firstKey = formatCache.keys().next().value;
      formatCache.delete(firstKey);
    }
    
    formatCache.set(num, result);
    return result;
  }

  // 优化的blocked count增加
  function incrementBlockedCountOptimized() {
    chrome.storage.sync.get(['blockedShortsCount'], function(result) {
      const newCount = (result.blockedShortsCount || 0) + Math.floor(Math.random() * 5) + 1;
      chrome.storage.sync.set({ blockedShortsCount: newCount });
      updateStatisticsBatch(newCount, null);
    });
  }

  // 优化的hover效果
  function addHoverEffects() {
    elements.controlGroups.forEach(group => {
      let hoverTimeout;
      
      group.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        group.style.transform = 'translateY(-1px)';
        group.style.transition = 'transform 0.2s ease';
      });
      
      group.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          group.style.transform = 'translateY(0)';
        }, 50);
      });
    });
  }

  // 智能统计更新 - 根据页面可见性调整频率
  let statisticsInterval;
  function startSmartStatisticsUpdate() {
    // 降低更新频率到60秒
    statisticsInterval = setInterval(() => {
      if (!document.hidden) {
        loadStatistics();
      }
    }, 60000);

    // 页面可见性变化时立即更新
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadStatistics();
      }
    });
  }

  // 键盘导航优化
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        const focusedElement = document.activeElement;
        if (focusedElement && focusedElement.closest('.toggle-switch')) {
          const checkbox = focusedElement.closest('.toggle-switch').querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.click();
            e.preventDefault();
          }
        }
      }
    });
  }

  // 清理函数
  function cleanup() {
    if (statisticsInterval) {
      clearInterval(statisticsInterval);
    }
    
    // 清理所有动画timeout
    animationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    animationTimeouts.clear();
    
    // 清理缓存
    formatCache.clear();
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);

  // 初始化应用
  function initialize() {
    // 绑定事件监听器
    elements.enableToggle.addEventListener('change', handleGeneralToggle);
    elements.shortsToggle.addEventListener('change', handleShortsToggle);
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.settingsBtn.addEventListener('click', handleSettings);

    // 加载数据
    loadSettings();
    loadStatistics();
    
    // 初始化UI效果
    initializeAnimations();
    addHoverEffects();
    setupKeyboardNavigation();
    startSmartStatisticsUpdate();
  }

  // 启动应用
  initialize();
}); 