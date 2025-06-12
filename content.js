// YouTube Vanced Plugin - Enhanced Content Script

class YouTubeVancedPlugin {
  constructor() {
    this.isGeneralEnabled = true;
    this.isShortsEnabled = true;
    this.blockedCount = 0;
    this.init();
  }

  init() {
    // Load settings from storage
    chrome.storage.sync.get([
      'shortsBlockerEnabled', 
      'shortsOnlyMode',
      'blockedShortsCount'
    ], (result) => {
      // 安全检查：确保result存在且是对象
      if (!result || typeof result !== 'object') {
        console.warn('Storage result is undefined or not an object, using defaults');
        result = {};
      }

      this.isGeneralEnabled = result.shortsBlockerEnabled !== false;
      this.isShortsEnabled = result.shortsOnlyMode !== false;
      this.blockedCount = result.blockedShortsCount || 0;
      
      if (this.isGeneralEnabled || this.isShortsEnabled) {
        this.blockContent();
        this.observeChanges();
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      // 安全检查：确保changes存在且是对象
      if (!changes || typeof changes !== 'object') {
        console.warn('Storage changes is undefined or not an object');
        return;
      }

      try {
        if (changes.shortsBlockerEnabled && changes.shortsBlockerEnabled.newValue !== undefined) {
          this.isGeneralEnabled = changes.shortsBlockerEnabled.newValue;
        }
        if (changes.shortsOnlyMode && changes.shortsOnlyMode.newValue !== undefined) {
          this.isShortsEnabled = changes.shortsOnlyMode.newValue;
        }
        
        if (this.isGeneralEnabled || this.isShortsEnabled) {
          this.blockContent();
        } else {
          this.unblockContent();
        }
      } catch (error) {
        console.error('Error handling storage changes:', error);
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 安全检查：确保message存在且有action
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
                this.blockContent();
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

  // Enhanced selectors for different YouTube shorts elements
  getShortsSelectors() {
    return [
      // Shorts shelf on homepage
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-reel-shelf-renderer',
      
      // Individual shorts videos
      'ytd-video-renderer[is-shorts]',
      'ytd-grid-video-renderer[is-shorts]',
      'ytd-compact-video-renderer[is-shorts]',
      
      // Shorts in search results
      'ytd-video-renderer:has([aria-label*="Shorts"])',
      'ytd-video-renderer:has([aria-label*="Short"])',
      
      // Shorts tab and navigation
      'yt-tab-shape:has([title*="Shorts"])',
      'ytd-guide-entry-renderer:has([title*="Shorts"])',
      
      // Shorts player page elements
      '[page-subtype="shorts"]',
      'ytd-shorts',
      
      // Mobile shorts elements
      '.ytd-reel-video-renderer',
      
      // Additional selectors for shorts content
      '[href*="/shorts/"]',
      'a[href*="/shorts/"]',
      
      // Shorts recommendations
      'ytd-compact-video-renderer:has([href*="/shorts/"])',
      'ytd-video-renderer:has([href*="/shorts/"])',
      
      // Shorts in sidebar
      'ytd-compact-video-renderer:has(.badge-shape-wiz__text:contains("SHORT"))',
      
      // More specific shorts identifiers
      '[is-shorts]',
      '[shorts]',
      
      // New shorts containers
      'ytd-rich-item-renderer:has([href*="/shorts/"])',
      'ytd-video-preview:has([href*="/shorts/"])'
    ];
  }

  blockContent() {
    if (!this.isGeneralEnabled && !this.isShortsEnabled) return;

    let blockedElements = 0;

    // Block shorts if either general blocking or shorts-specific blocking is enabled
    if (this.isGeneralEnabled || this.isShortsEnabled) {
      blockedElements += this.blockShorts();
    }

    // Update statistics
    if (blockedElements > 0) {
      this.updateBlockedCount(blockedElements);
    }
  }

  blockShorts() {
    let blockedCount = 0;
    const selectors = this.getShortsSelectors();
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.hideElement(element)) {
            blockedCount++;
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });

    // Additional blocking strategies
    blockedCount += this.blockShortsLinks();
    blockedCount += this.blockShortsInFeed();
    this.redirectShortsUrls();

    return blockedCount;
  }

  blockShortsLinks() {
    let blockedCount = 0;
    const links = document.querySelectorAll('a[href*="/shorts/"]');
    
    links.forEach(link => {
      const videoContainer = link.closest(
        'ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer'
      );
      
      if (videoContainer) {
        if (this.hideElement(videoContainer)) {
          blockedCount++;
        }
      } else {
        if (this.hideElement(link)) {
          blockedCount++;
        }
      }
    });

    return blockedCount;
  }

  blockShortsInFeed() {
    let blockedCount = 0;
    const videoRenderers = document.querySelectorAll(
      'ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer'
    );
    
    videoRenderers.forEach(renderer => {
      // Check for shorts badges
      const badges = renderer.querySelectorAll('.badge-shape-wiz__text, .ytd-badge-supported-renderer');
      const hasShortsBadge = Array.from(badges).some(badge => 
        badge.textContent && badge.textContent.toLowerCase().includes('short')
      );
      
      if (hasShortsBadge) {
        if (this.hideElement(renderer)) {
          blockedCount++;
        }
        return;
      }
      
      // Check video duration for shorts detection
      const timeElement = renderer.querySelector(
        '#time-status .badge-shape-wiz__text, .ytd-thumbnail-overlay-time-status-renderer span'
      );
      
      if (timeElement && timeElement.textContent) {
        const duration = timeElement.textContent.trim();
        // Detect short-form content (under 1 minute)
        if (/^[0-5]?\d$/.test(duration) || /^0:[0-5]\d$/.test(duration)) {
          const link = renderer.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
          if (link && (link.href.includes('/shorts/') || this.isLikelyShorts(renderer))) {
            if (this.hideElement(renderer)) {
              blockedCount++;
            }
          }
        }
      }
    });

    return blockedCount;
  }

  isLikelyShorts(element) {
    // Additional heuristics to detect shorts
    const thumbnail = element.querySelector('img');
    if (thumbnail) {
      // Shorts typically have vertical aspect ratios
      const width = thumbnail.naturalWidth || parseInt(thumbnail.style.width);
      const height = thumbnail.naturalHeight || parseInt(thumbnail.style.height);
      if (height > width) return true;
    }

    // Check for shorts-specific CSS classes or attributes
    const shortsIndicators = [
      'shorts', 'reel', 'vertical-video', 'short-form'
    ];

    return shortsIndicators.some(indicator => 
      element.className.toLowerCase().includes(indicator) ||
      element.querySelector(`[class*="${indicator}"]`)
    );
  }

  redirectShortsUrls() {
    // Enhanced URL redirection for shorts
    if (window.location.pathname.includes('/shorts/')) {
      const videoId = window.location.pathname.split('/shorts/')[1].split('?')[0];
      if (videoId && videoId.length === 11) { // YouTube video ID length
        const currentParams = new URLSearchParams(window.location.search);
        const newUrl = `https://www.youtube.com/watch?v=${videoId}${currentParams.toString() ? '&' + currentParams.toString() : ''}`;
        window.location.replace(newUrl);
      }
    }
  }

  hideElement(element) {
    if (element && !element.hasAttribute('data-vanced-blocked')) {
      // Add smooth fade-out animation
      element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      element.style.opacity = '0';
      element.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        element.style.display = 'none';
        element.setAttribute('data-vanced-blocked', 'true');
      }, 300);
      
      return true; // Successfully hidden
    }
    return false;
  }

  unblockContent() {
    const blockedElements = document.querySelectorAll('[data-vanced-blocked]');
    blockedElements.forEach(element => {
      element.style.display = '';
      element.style.opacity = '';
      element.style.transform = '';
      element.style.transition = '';
      element.removeAttribute('data-vanced-blocked');
    });
  }

  updateBlockedCount(newBlocked) {
    // 安全检查：确保newBlocked是有效数字
    if (typeof newBlocked !== 'number' || isNaN(newBlocked) || newBlocked < 0) {
      console.warn('Invalid blocked count:', newBlocked);
      return;
    }

    this.blockedCount += newBlocked;
    
    // Update storage with new count
    try {
      chrome.storage.sync.set({
        blockedShortsCount: this.blockedCount
      });
    } catch (error) {
      console.error('Error updating blocked count in storage:', error);
    }
  }

  observeChanges() {
    // Enhanced mutation observer for better performance
    const observer = new MutationObserver((mutations) => {
      if (!this.isGeneralEnabled && !this.isShortsEnabled) return;
      
      let shouldBlock = false;
      let addedNodesCount = 0;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          addedNodesCount += mutation.addedNodes.length;
          shouldBlock = true;
        }
      });
      
      if (shouldBlock) {
        // Debounce blocking with adaptive delay based on activity
        clearTimeout(this.blockTimeout);
        const delay = Math.min(100 + (addedNodesCount * 10), 500);
        
        this.blockTimeout = setTimeout(() => {
          this.blockContent();
        }, delay);
      }
    });

    // Start observing with optimized config
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, // Disable attribute observation for performance
      characterData: false
    });

    // Enhanced SPA navigation detection
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // Immediate blocking on navigation
        setTimeout(() => this.blockContent(), 100);
        // Follow-up blocking for dynamic content
        setTimeout(() => this.blockContent(), 1000);
      }
    });

    // 安全检查：确保title元素存在
    const titleElement = document.querySelector('title');
    if (titleElement) {
      urlObserver.observe(titleElement, {
        childList: true
      });
    } else {
      console.warn('Title element not found, SPA navigation detection disabled');
    }

    // Periodic cleanup and re-blocking
    setInterval(() => {
      if (this.isGeneralEnabled || this.isShortsEnabled) {
        this.blockContent();
      }
    }, 5000);
  }
}

// Initialize the plugin
const vancedPlugin = new YouTubeVancedPlugin();

// Add visual feedback for blocked content
const style = document.createElement('style');
style.textContent = `
  [data-vanced-blocked] {
    transition: opacity 0.3s ease, transform 0.3s ease !important;
  }
  
  .vanced-blocked-notice {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
    border: 1px solid rgba(76, 175, 80, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    color: #4CAF50;
    font-size: 14px;
    text-align: center;
    animation: slideIn 0.3s ease;
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style); 