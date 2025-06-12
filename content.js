// YouTube Vanced Plugin - Optimized Content Script

class YouTubeVancedPlugin {
  constructor() {
    this.isGeneralEnabled = true;
    this.isShortsEnabled = true;
    this.blockedCount = 0;
    
    // 性能优化：缓存和状态管理
    this.lastBlockTime = 0;
    this.blockedElements = new WeakSet(); // 使用WeakSet避免内存泄漏
    this.isBlocking = false;
    this.blockQueue = new Set();
    
    // 缓存编译后的选择器（按优先级排序）
    this.primarySelectors = [
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-reel-shelf-renderer',
      '[page-subtype="shorts"]',
      'ytd-shorts'
    ];
    
    this.secondarySelectors = [
      'ytd-video-renderer[is-shorts]',
      'ytd-grid-video-renderer[is-shorts]',
      'ytd-compact-video-renderer[is-shorts]',
      '[is-shorts]',
      '[shorts]'
    ];
    
    this.linkSelectors = [
      'a[href*="/shorts/"]'
    ];
    
    this.init();
  }

  init() {
    // Load settings from storage
    chrome.storage.sync.get([
      'shortsBlockerEnabled', 
      'shortsOnlyMode',
      'blockedShortsCount'
    ], (result) => {
      if (!result || typeof result !== 'object') {
        console.warn('Storage result is undefined or not an object, using defaults');
        result = {};
      }

      this.isGeneralEnabled = result.shortsBlockerEnabled !== false;
      this.isShortsEnabled = result.shortsOnlyMode !== false;
      this.blockedCount = result.blockedShortsCount || 0;
      
      if (this.isGeneralEnabled || this.isShortsEnabled) {
        this.blockContentOptimized();
        this.observeChangesOptimized();
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes || typeof changes !== 'object') {
        console.warn('Storage changes is undefined or not an object');
        return;
      }

      try {
        let needsUpdate = false;
        
        if (changes.shortsBlockerEnabled && changes.shortsBlockerEnabled.newValue !== undefined) {
          this.isGeneralEnabled = changes.shortsBlockerEnabled.newValue;
          needsUpdate = true;
        }
        if (changes.shortsOnlyMode && changes.shortsOnlyMode.newValue !== undefined) {
          this.isShortsEnabled = changes.shortsOnlyMode.newValue;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          if (this.isGeneralEnabled || this.isShortsEnabled) {
            this.blockContentOptimized();
          } else {
            this.unblockContent();
          }
        }
      } catch (error) {
        console.error('Error handling storage changes:', error);
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) {
        sendResponse({ success: false, error: 'Invalid message' });
        return;
      }

      try {
        switch (message.action) {
          case 'reinitialize':
            if (message.settings && typeof message.settings === 'object') {
              this.isGeneralEnabled = message.settings.shortsBlockerEnabled !== false;
              this.isShortsEnabled = message.settings.shortsOnlyMode !== false;
              
              if (this.isGeneralEnabled || this.isShortsEnabled) {
                this.blockContentOptimized();
              } else {
                this.unblockContent();
              }
            }
            sendResponse({ success: true });
            break;
          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  }

  // 优化的内容屏蔽方法
  blockContentOptimized() {
    if (!this.isGeneralEnabled && !this.isShortsEnabled) return;
    
    // 防止重复执行
    if (this.isBlocking) {
      return;
    }
    
    this.isBlocking = true;
    const startTime = performance.now();
    
    // 使用requestAnimationFrame优化DOM操作
    requestAnimationFrame(() => {
      let blockedElements = 0;
      
      try {
        // 按优先级执行屏蔽
        blockedElements += this.blockBySelectors(this.primarySelectors, true);
        blockedElements += this.blockBySelectors(this.secondarySelectors, false);
        blockedElements += this.blockShortsLinksOptimized();
        
        // 只在真正有元素被屏蔽时执行额外检查
        if (blockedElements > 0) {
          blockedElements += this.blockShortsInFeedOptimized();
          this.redirectShortsUrls();
          this.updateBlockedCount(blockedElements);
        }
        
        const endTime = performance.now();
        console.debug(`Blocking completed in ${endTime - startTime}ms, blocked: ${blockedElements}`);
        
      } finally {
        this.isBlocking = false;
        this.lastBlockTime = Date.now();
      }
    });
  }

  // 优化的选择器屏蔽
  blockBySelectors(selectors, isPrimary = false) {
    let blockedCount = 0;
    
    for (const selector of selectors) {
      try {
        // 使用document.querySelectorAll的性能优化版本
        const elements = document.querySelectorAll(selector + ':not([data-vanced-blocked])');
        
        if (elements.length === 0) continue;
        
        // 批量处理元素
        const elementsArray = Array.from(elements);
        blockedCount += this.hideElementsBatch(elementsArray);
        
        // 对于主要选择器，找到就可以跳过其他检查
        if (isPrimary && blockedCount > 0) {
          break;
        }
        
      } catch (e) {
        console.debug('Invalid selector:', selector);
      }
    }
    
    return blockedCount;
  }

  // 优化的链接屏蔽
  blockShortsLinksOptimized() {
    let blockedCount = 0;
    
    // 使用更具体的选择器减少查询范围
    const containers = document.querySelectorAll(
      'ytd-video-renderer:not([data-vanced-blocked]), ' +
      'ytd-grid-video-renderer:not([data-vanced-blocked]), ' +
      'ytd-compact-video-renderer:not([data-vanced-blocked]), ' +
      'ytd-rich-item-renderer:not([data-vanced-blocked])'
    );
    
    const containersToBlock = [];
    
    for (const container of containers) {
      const shortsLink = container.querySelector('a[href*="/shorts/"]');
      if (shortsLink) {
        containersToBlock.push(container);
      }
    }
    
    if (containersToBlock.length > 0) {
      blockedCount = this.hideElementsBatch(containersToBlock);
    }
    
    return blockedCount;
  }

  // 优化的Feed屏蔽
  blockShortsInFeedOptimized() {
    let blockedCount = 0;
    
    // 使用缓存的选择器减少重复查询
    const videoRenderers = document.querySelectorAll(
      'ytd-video-renderer:not([data-vanced-blocked]), ' +
      'ytd-grid-video-renderer:not([data-vanced-blocked]), ' +
      'ytd-compact-video-renderer:not([data-vanced-blocked])'
    );
    
    const renderersToBlock = [];
    
    for (const renderer of videoRenderers) {
      if (this.isShortVideo(renderer)) {
        renderersToBlock.push(renderer);
      }
    }
    
    if (renderersToBlock.length > 0) {
      blockedCount = this.hideElementsBatch(renderersToBlock);
    }
    
    return blockedCount;
  }

  // 优化的短视频检测
  isShortVideo(renderer) {
    // 检查shorts标识
    const badges = renderer.querySelectorAll('.badge-shape-wiz__text, .ytd-badge-supported-renderer');
    for (const badge of badges) {
      if (badge.textContent && badge.textContent.toLowerCase().includes('short')) {
        return true;
      }
    }
    
    // 检查时长
    const timeElement = renderer.querySelector(
      '#time-status .badge-shape-wiz__text, .ytd-thumbnail-overlay-time-status-renderer span'
    );
    
    if (timeElement && timeElement.textContent) {
      const duration = timeElement.textContent.trim();
      if (/^[0-5]?\d$/.test(duration) || /^0:[0-5]\d$/.test(duration)) {
        const link = renderer.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
        return link && (link.href.includes('/shorts/') || this.isLikelyShorts(renderer));
      }
    }
    
    return false;
  }

  isLikelyShorts(element) {
    // 缓存查询结果
    if (element._vancedChecked) {
      return element._vancedLikelyShorts || false;
    }
    
    let isShorts = false;
    
    // 检查缩略图宽高比
    const thumbnail = element.querySelector('img');
    if (thumbnail && thumbnail.naturalWidth && thumbnail.naturalHeight) {
      isShorts = thumbnail.naturalHeight > thumbnail.naturalWidth;
    }
    
    // 检查CSS类名
    if (!isShorts) {
      const shortsIndicators = ['shorts', 'reel', 'vertical-video', 'short-form'];
      isShorts = shortsIndicators.some(indicator => 
        element.className.toLowerCase().includes(indicator) ||
        element.querySelector(`[class*="${indicator}"]`)
      );
    }
    
    // 缓存结果
    element._vancedChecked = true;
    element._vancedLikelyShorts = isShorts;
    
    return isShorts;
  }

  redirectShortsUrls() {
    if (window.location.pathname.includes('/shorts/')) {
      const videoId = window.location.pathname.split('/shorts/')[1].split('?')[0];
      if (videoId && videoId.length === 11) {
        const currentParams = new URLSearchParams(window.location.search);
        const newUrl = `https://www.youtube.com/watch?v=${videoId}${currentParams.toString() ? '&' + currentParams.toString() : ''}`;
        window.location.replace(newUrl);
      }
    }
  }

  // 批量隐藏元素（性能优化）
  hideElementsBatch(elements) {
    if (!elements || elements.length === 0) return 0;
    
    let hiddenCount = 0;
    
    // 使用DocumentFragment减少重排
    for (const element of elements) {
      if (element && !this.blockedElements.has(element)) {
        this.blockedElements.add(element);
        
        // 立即隐藏，减少动画开销
        element.style.display = 'none';
        element.setAttribute('data-vanced-blocked', 'true');
        element.setAttribute('aria-hidden', 'true');
        
        hiddenCount++;
      }
    }
    
    return hiddenCount;
  }

  unblockContent() {
    const blockedElements = document.querySelectorAll('[data-vanced-blocked]');
    for (const element of blockedElements) {
      element.style.display = '';
      element.style.opacity = '';
      element.style.transform = '';
      element.style.transition = '';
      element.removeAttribute('data-vanced-blocked');
      element.removeAttribute('aria-hidden');
      this.blockedElements.delete(element);
      
      // 清除缓存
      if (element._vancedChecked) {
        delete element._vancedChecked;
        delete element._vancedLikelyShorts;
      }
    }
  }

  updateBlockedCount(newBlocked) {
    if (typeof newBlocked !== 'number' || isNaN(newBlocked) || newBlocked < 0) {
      console.warn('Invalid blocked count:', newBlocked);
      return;
    }

    this.blockedCount += newBlocked;
    
    try {
      chrome.storage.sync.set({
        blockedShortsCount: this.blockedCount
      });
    } catch (error) {
      console.error('Error updating blocked count in storage:', error);
    }
  }

  // 优化的变化观察器
  observeChangesOptimized() {
    // 智能防抖机制
    let mutationTimeout;
    let pendingMutations = 0;
    
    const observer = new MutationObserver((mutations) => {
      if (!this.isGeneralEnabled && !this.isShortsEnabled) return;
      
      pendingMutations += mutations.length;
      
      // 清除之前的定时器
      if (mutationTimeout) {
        clearTimeout(mutationTimeout);
      }
      
      // 根据变化量动态调整延迟
      const delay = Math.min(50 + pendingMutations * 5, 300);
      
      mutationTimeout = setTimeout(() => {
        // 避免在滚动时频繁触发
        const now = Date.now();
        if (now - this.lastBlockTime < 100) {
          return;
        }
        
        this.blockContentOptimized();
        pendingMutations = 0;
      }, delay);
    });

    // 优化观察器配置
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // URL变化检测（优化版）
    let lastUrl = location.href;
    const urlCheckInterval = setInterval(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // URL变化时立即执行一次
        setTimeout(() => this.blockContentOptimized(), 50);
        // 延迟执行一次以捕获动态内容
        setTimeout(() => this.blockContentOptimized(), 500);
      }
    }, 1000); // 降低检查频率

    // 页面可见性变化时重新检查
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (this.isGeneralEnabled || this.isShortsEnabled)) {
        setTimeout(() => this.blockContentOptimized(), 100);
      }
    });

    // 清理函数
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      clearInterval(urlCheckInterval);
      if (mutationTimeout) {
        clearTimeout(mutationTimeout);
      }
    });
  }
}

// Initialize the plugin
const vancedPlugin = new YouTubeVancedPlugin();

// 优化的样式注入
const style = document.createElement('style');
style.textContent = `
  [data-vanced-blocked] {
    display: none !important;
    visibility: hidden !important;
  }
`;
document.head.appendChild(style); 