// YouTube Vanced Plugin - Optimized Content Script

class YouTubeVancedPlugin {
  constructor() {
    this.isGeneralEnabled = true;
    this.isShortsEnabled = true;
    this.sponsorBlockEnabled = false;
    this.autoRepeatEnabled = false;
    this.adBlockerEnabled = false;
    this.hideEndScreenEnabled = false;
    this.hideInfoCardEnabled = false;
    this.hideWatermarkEnabled = false;
    this.hideStoriesEnabled = false;
    this.blockedCount = 0;
    
    // 性能优化：缓存和状态管理
    this.lastBlockTime = 0;
    this.blockedElements = new WeakSet(); // 使用WeakSet避免内存泄漏
    this.isBlocking = false;
    this.blockQueue = new Set();
    
    // SponsorBlock
    this.sponsorSegments = [];
    this.currentVideoId = null;
    this.lastFetchTime = 0;
    
    this.playerCheckInterval = null;
    
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
    
    this._sigTokens = null;
    this._nTokens   = null;
    this._decipherReady = false;
    // Kick-off token extraction in the background
    this.initDecipher();
    
    this.init();
  }

  init() {
    // Load settings from storage
    chrome.storage.sync.get([
      'shortsBlockerEnabled', 
      'shortsOnlyMode',
      'sponsorBlockEnabled',
      'autoRepeatEnabled',
      'adBlockerEnabled',
      'hideEndScreenEnabled',
      'hideInfoCardEnabled',
      'hideWatermarkEnabled',
      'hideStoriesEnabled',
      'blockedShortsCount'
    ], (result) => {
      if (!result || typeof result !== 'object') {
        console.warn('Storage result is undefined or not an object, using defaults');
        result = {};
      }

      this.isGeneralEnabled = result.shortsBlockerEnabled !== false;
      this.isShortsEnabled = result.shortsOnlyMode !== false;
      this.sponsorBlockEnabled = result.sponsorBlockEnabled !== false;
      this.autoRepeatEnabled = result.autoRepeatEnabled !== false;
      this.adBlockerEnabled = result.adBlockerEnabled !== false;
      this.hideEndScreenEnabled = result.hideEndScreenEnabled !== false;
      this.hideInfoCardEnabled = result.hideInfoCardEnabled !== false;
      this.hideWatermarkEnabled = result.hideWatermarkEnabled !== false;
      this.hideStoriesEnabled = result.hideStoriesEnabled !== false;
      this.blockedCount = result.blockedShortsCount || 0;
      
      if (this.isGeneralEnabled || this.isShortsEnabled) {
        this.blockContentOptimized();
        this.observeChangesOptimized();
      }

      if (this.sponsorBlockEnabled || this.autoRepeatEnabled) {
        this.setupVideoPlayerInterval();
      }

      if (this.hideEndScreenEnabled || this.hideInfoCardEnabled || this.hideWatermarkEnabled || this.hideStoriesEnabled) {
        this.hideLayoutElementsOptimized();
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
              this.sponsorBlockEnabled = message.settings.sponsorBlockEnabled !== false;
              this.autoRepeatEnabled = message.settings.autoRepeatEnabled !== false;
              this.adBlockerEnabled = message.settings.adBlockerEnabled !== false;
              this.hideEndScreenEnabled = message.settings.hideEndScreenEnabled !== false;
              this.hideInfoCardEnabled = message.settings.hideInfoCardEnabled !== false;
              this.hideWatermarkEnabled = message.settings.hideWatermarkEnabled !== false;
              this.hideStoriesEnabled = message.settings.hideStoriesEnabled !== false;
              
              if (this.isGeneralEnabled || this.isShortsEnabled) {
                this.blockContentOptimized();
              } else {
                this.unblockContent();
              }

              if (this.sponsorBlockEnabled || this.autoRepeatEnabled) {
                this.setupVideoPlayerInterval();
              }

              if (this.hideEndScreenEnabled || this.hideInfoCardEnabled || this.hideWatermarkEnabled || this.hideStoriesEnabled) {
                this.hideLayoutElementsOptimized();
              }
            }
            sendResponse({ success: true });
            break;
          case 'getVideoFormats':
            {
              const resp = this.getAvailableFormats('video');
              sendResponse(resp);
            }
            break;
          case 'getAudioFormats':
            {
              const resp = this.getAvailableFormats('audio');
              sendResponse(resp);
            }
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
        
        // Ad blocking
        if (this.adBlockerEnabled) {
          this.hideAdsOptimized();
        }
        
        // Layout hiding
        if (this.hideEndScreenEnabled || this.hideInfoCardEnabled || this.hideWatermarkEnabled || this.hideStoriesEnabled) {
          this.hideLayoutElementsOptimized();
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

  /* ================= Ad Blocking ================= */
  hideAdsOptimized() {
    // Improved ad removal logic: also collapse the surrounding layout container to avoid blank spaces
    const adSelectors = [
      // Individual ad renderers
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-text-search-renderer',
      'ytd-video-masthead-ad-v3-renderer',
      'ytd-carousel-ad-renderer',
      'ytd-ad-slot-renderer',
      'ytd-in-feed-ad-layout-renderer',
      'ytd-search-pyv-renderer',
      'ytd-companion-slot-renderer',
      'ytd-banner-promo-renderer',
      // Player & overlay ads
      '#player-ads',
      '.ytp-ad-progress-list',
      '.video-ads',
      '.ytp-ad-module',
      '.ytp-ad-overlay-container'
    ];

    // Collect unique containers that influence spacing so we can hide them in one pass
    const containers = new Set();

    adSelectors.forEach(sel => {
      document.querySelectorAll(sel + ':not([data-vanced-blocked])').forEach(el => {
        // Attempt to climb up to the feed/grid item that actually contributes height.
        const container =
          el.closest('ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-ad-slot-renderer, ytd-carousel-ad-renderer, ytd-search-pyv-renderer, ytd-in-feed-ad-layout-renderer') ||
          el;

        if (!this.blockedElements.has(container)) {
          containers.add(container);
        }
      });
    });

    if (containers.size > 0) {
      const blocked = this.hideElementsBatch(Array.from(containers));
      if (blocked > 0) {
        console.debug('Ad containers blocked:', blocked);
      }
    }
  }

  /* ================= Video Player Enhancements ================= */
  setupVideoPlayerInterval() {
    if (this.playerCheckInterval) return; // already running

    this.playerCheckInterval = setInterval(() => {
      if (!document.location.pathname.startsWith('/watch')) return;

      const videoId = this.extractVideoId();
      if (!videoId) return;

      if (this.currentVideoId !== videoId) {
        this.currentVideoId = videoId;
        this.sponsorSegments = [];

        if (this.sponsorBlockEnabled) {
          this.fetchSponsorSegments(videoId);
        }
      }

      const video = document.querySelector('video');
      if (video) {
        this.attachPlayerEvents(video);
      }

    }, 1000);
  }

  extractVideoId() {
    const url = new URL(location.href);
    if (url.pathname.startsWith('/watch')) {
      return url.searchParams.get('v');
    }
    return null;
  }

  fetchSponsorSegments(videoId) {
    const now = Date.now();
    if (now - this.lastFetchTime < 10000) return; // rate limit
    this.lastFetchTime = now;

    fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}`)
      .then(r => r.json())
      .then(data => {
        // data is array of objects with segment array [start,end]
        this.sponsorSegments = (data || []).map(d => d.segment).filter(Boolean);
        console.debug('Fetched sponsor segments:', this.sponsorSegments);
      })
      .catch(err => console.warn('SponsorBlock fetch error', err));
  }

  attachPlayerEvents(video) {
    if (!video._vancedEnhancementsAttached) {
      video.addEventListener('timeupdate', () => {
        if (this.sponsorBlockEnabled && this.sponsorSegments.length) {
          const t = video.currentTime;
          for (const seg of this.sponsorSegments) {
            if (t >= seg[0] && t < seg[1] - 0.3) {
              video.currentTime = seg[1] + 0.05;
              break;
            }
          }
        }

        // NEW: attempt to skip in-stream video ads
        this.skipVideoAds(video);
      });

      if (this.autoRepeatEnabled) {
        video.addEventListener('ended', () => {
          video.currentTime = 0;
          video.play().catch(()=>{});
        });
      }

      video._vancedEnhancementsAttached = true;
    }
  }

  /* ================= Ad Skipping (in-stream) ================= */
  skipVideoAds(video){
    try{
      const playerContainer = document.querySelector('.html5-video-player');
      if(!playerContainer) return;
      if(playerContainer.classList.contains('ad-showing') || playerContainer.querySelector('.ytp-ad-preview-text')){
        // Try click the skip button if visible
        const skipBtn = playerContainer.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if(skipBtn){
          skipBtn.click();
        }
        // Fallback: jump to end of ad video
        if(video.duration && video.currentTime < video.duration - 0.1){
          video.currentTime = video.duration;
        }
        // If still playing ad, accelerate playback to finish quickly
        if(video.playbackRate < 4){
          video.playbackRate = 4;
        }
      }else if(video.playbackRate !== 1){
        // Restore normal speed
        video.playbackRate = 1;
      }
    }catch(_){}
  }

  /* ================= Layout Hiding ================= */
  hideLayoutElementsOptimized() {
    const selectors = [];
    if (this.hideEndScreenEnabled) {
      selectors.push('.ytp-ce-element', '.ytp-ce-element-overlay');
    }
    if (this.hideInfoCardEnabled) {
      selectors.push('.ytp-cards-button', '.ytp-cards-button-icon');
    }
    if (this.hideWatermarkEnabled) {
      selectors.push('.ytp-watermark');
    }
    if (this.hideStoriesEnabled) {
      selectors.push('ytd-story-renderer', 'ytd-reel-player-renderer', '#stories');
    }

    let blocked = 0;
    if (selectors.length) {
      selectors.forEach(sel => {
        const els = document.querySelectorAll(sel + ':not([data-vanced-blocked])');
        if (els.length) {
          blocked += this.hideElementsBatch(Array.from(els));
        }
      });
    }
    if (blocked > 0) {
      console.debug('Layout elements hidden:', blocked);
    }
  }

  /* ================= Format Extraction ================= */
  getAvailableFormats(type){
    try{
      if(!location.pathname.startsWith('/watch')){
        return {success:false,message:'Not a watch page'};
      }

      const player = this.getPlayerResponse();
      if(!player || !player.streamingData) return {success:false};

      const adaptive = player.streamingData.adaptiveFormats || [];
      const formats = player.streamingData.formats || [];
      const list = [...adaptive, ...formats];

      const filtered = [];

      for(const f of list){
        let directUrl = f.url;

        // Handle signatureCipher/cipher fields
        if(!directUrl && (f.signatureCipher || f.cipher)){
          const sc = f.signatureCipher || f.cipher;
          const params = new URLSearchParams(sc);
          let urlFromCipher = params.get('url');
          if(urlFromCipher){
            // decipher sig if needed
            if(params.get('s')){
              if(this._decipherReady){
                const sig = this.execTokens(params.get('s'), this._sigTokens);
                const sp = params.get('sp') || 'signature';
                urlFromCipher += `&${sp}=`+sig;
              }else{
                urlFromCipher=null; // skip, cannot decipher yet
              }
            }else if(params.get('sig')){
              urlFromCipher += '&sig=' + params.get('sig');
            }else if(params.get('signature')){
              urlFromCipher += '&signature=' + params.get('signature');
            }
            directUrl = urlFromCipher;
          }
        }

        if(!directUrl) continue; // skip if no usable URL

        // Decipher n parameter if exists
        if(this._decipherReady && /[?&]n=/.test(directUrl)){
          directUrl = directUrl.replace(/([?&]n=)([^&]+)/, (match,p1,p2)=> p1 + this.execTokens(p2,this._nTokens||this._sigTokens));
        }

        const mime = f.mimeType ? f.mimeType.split(';')[0] : '';

        if(type==='video'){
          if(!f.qualityLabel || !mime.startsWith('video/')) continue;
        }else{
          if(!mime.startsWith('audio/')) continue;
        }

        filtered.push({
          url: directUrl,
          qualityLabel: f.qualityLabel || `${Math.round((f.bitrate||0)/1000)}kbps`,
          container: mime.split('/')[1] || 'mp4',
          bitrate: f.bitrate || 0
        });
      }

      if(type==='video') {
        return {success:true, formats: filtered};
      } else {
        return {success:true, audio: filtered};
      }
    }catch(e){
      console.warn('getAvailableFormats error', e);
      return {success:false};
    }
  }

  getPlayerResponse(){
    if(this._cachedPlayerResponse && this._cachedPlayerResponse.streamingData){
      return this._cachedPlayerResponse;
    }

    // Attempt direct access (may fail due to isolation)
    let pr = null;
    try{ pr = window.ytInitialPlayerResponse; }catch(_){}
    if(pr && pr.streamingData){
      this._cachedPlayerResponse = pr;
      return pr;
    }

    // Fallback: parse inline <script> JSON
    const scripts = document.querySelectorAll('script:not([src])');
    for(const s of scripts){
      const m = s.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
      if(m){
        try{
          pr = JSON.parse(m[1]);
          if(pr && pr.streamingData){
            this._cachedPlayerResponse = pr;
            return pr;
          }
        }catch(e){
          console.debug('PlayerResponse JSON parse fail', e);
        }
      }
    }
    return null;
  }

  /* =====================  Signature decipher  ===================== */
  async initDecipher(){
    try{
      // try to locate base.js url from page
      const baseScript = document.querySelector('script[src*="base.js"]');
      if(!baseScript) return;
      const jsUrl = baseScript.src.startsWith('https:')? baseScript.src : 'https://www.youtube.com'+baseScript.getAttribute('src');
      const txt = await (await fetch(jsUrl)).text();
      const {sigTokens,nTokens} = this.extractTokens(txt);
      if(sigTokens && sigTokens.length){
        this._sigTokens = sigTokens;
        this._nTokens   = nTokens;
        this._decipherReady = true;
        console.debug('Decipher tokens ready');
      }
    }catch(e){
      console.debug('initDecipher error',e);
    }
  }

  extractTokens(js){
    const objReg = /([\w$]{2})=\{((?:[\w$]{2}:function\(.*?\}.,?)+)\};/s;
    const fnReg  = /([\w$]{2})=function\(a\)\{a=a\.split\(""\);(.*?)return a\.join\(""\)\}/s;
    const objRes = js.match(objReg);
    const fnRes  = js.match(fnReg);
    if(!objRes||!fnRes) return {sigTokens:null,nTokens:null};
    const objName = objRes[1];
    const objBody = objRes[2];
    const fnBody  = fnRes[2];
    // Map operation key -> op type
    const ops = {};
    objBody.split('},').forEach(part=>{
      const m = part.match(/([\w$]{2}):function\(a,(b)?c?\){(.*?)}/s);
      if(!m) return;
      const name=m[1];
      const body=m[3];
      if(/\.reverse\(\)/.test(body)) ops[name]='reverse';
      else if(/\.splice/.test(body)) ops[name]='splice';
      else if(/var c=a\[0\];a\[0\]=a\[b%a\.length\];a\[b%a\.length\]=c/.test(body)) ops[name]='swap';
    });
    // build tokens
    const tokenReg = new RegExp(objName+"\.([\w$]{2})\\(a,(\d+)\)","g");
    const tokens=[];
    let m;
    while((m=tokenReg.exec(fnBody))!==null){
      tokens.push({type:ops[m[1]],arg:parseInt(m[2])});
    }
    // Attempt to grab n-transform as well
    let nTokens=null;
    const nFnMatch = js.match(/function\(a\)\{a=a\.split\(""\);(.*?)return a\.join/);
    if(nFnMatch){
      nTokens=this.parseSimpleTokens(nFnMatch[1]);
    }
    return {sigTokens:tokens,nTokens};
  }

  parseSimpleTokens(body){
    const tokens=[];
    body.split(';').forEach(part=>{
      if(/\.reverse\(\)/.test(part)) tokens.push({type:'reverse'});
      else if(/\.splice\(0,(\d+)\)/.test(part)) tokens.push({type:'splice',arg:parseInt(RegExp.$1)});
      else if(/var c=a\[0\];a\[0\]=a\[(\d+)%a\.length\];a\[\1%a\.length\]=c/.test(part)) tokens.push({type:'swap',arg:parseInt(RegExp.$1)});
    });
    return tokens;
  }

  execTokens(sig,tokens){
    if(!tokens) return sig;
    let a=sig.split('');
    for(const t of tokens){
      switch(t.type){
        case 'reverse': a.reverse(); break;
        case 'splice': a.splice(0,t.arg); break;
        case 'swap':
          const idx=t.arg%a.length;
          const c=a[0];a[0]=a[idx];a[idx]=c;break;
      }
    }
    return a.join('');
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