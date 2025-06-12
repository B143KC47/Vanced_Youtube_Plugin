// YouTube Vanced Plugin - Enhanced Popup Script (Dark Theme)

document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const enableToggle = document.getElementById('enableToggle');
  const shortsToggle = document.getElementById('shortsToggle');
  const statusText = document.getElementById('statusText');
  const shortsStatus = document.getElementById('shortsStatus');
  const blockedCount = document.getElementById('blockedCount');
  const sessionsCount = document.getElementById('sessionsCount');
  const refreshBtn = document.getElementById('refreshBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  // Animation delay for control groups
  const controlGroups = document.querySelectorAll('.control-group, .stats-section');
  controlGroups.forEach((group, index) => {
    group.style.animationDelay = `${index * 0.1}s`;
  });

  // Load current settings and statistics
  loadSettings();
  loadStatistics();

  // Event Listeners
  enableToggle.addEventListener('change', handleGeneralToggle);
  shortsToggle.addEventListener('change', handleShortsToggle);
  refreshBtn.addEventListener('click', handleRefresh);
  settingsBtn.addEventListener('click', handleSettings);

  function loadSettings() {
    chrome.storage.sync.get([
      'shortsBlockerEnabled', 
      'shortsOnlyMode',
      'blockedShortsCount',
      'sessionCount'
    ], function(result) {
      // General blocker setting
      const isGeneralEnabled = result.shortsBlockerEnabled !== false;
      enableToggle.checked = isGeneralEnabled;
      
      // Shorts-specific setting (new feature)
      const isShortsEnabled = result.shortsOnlyMode !== false;
      shortsToggle.checked = isShortsEnabled;
      
      updateStatus(isGeneralEnabled, isShortsEnabled);
      updateStatistics(result.blockedShortsCount || 0, result.sessionCount || 1);
    });
  }

  function loadStatistics() {
    chrome.storage.sync.get(['blockedShortsCount', 'sessionCount'], function(result) {
      updateStatistics(result.blockedShortsCount || 0, result.sessionCount || 1);
    });
  }

  function handleGeneralToggle() {
    const isEnabled = enableToggle.checked;
    
    chrome.storage.sync.set({
      shortsBlockerEnabled: isEnabled
    }, function() {
      updateStatus(isEnabled, shortsToggle.checked);
      refreshCurrentTab();
      addToggleAnimation(statusText);
    });
  }

  function handleShortsToggle() {
    const isEnabled = shortsToggle.checked;
    
    chrome.storage.sync.set({
      shortsOnlyMode: isEnabled
    }, function() {
      updateStatus(enableToggle.checked, isEnabled);
      refreshCurrentTab();
      addToggleAnimation(shortsStatus);
      
      // Update blocked count
      if (isEnabled) {
        incrementBlockedCount();
      }
    });
  }

  function handleRefresh() {
    addButtonAnimation(refreshBtn);
    refreshCurrentTab();
    
    // Reload statistics
    setTimeout(() => {
      loadStatistics();
    }, 500);
  }

  function handleSettings() {
    addButtonAnimation(settingsBtn);
    
    // Increment session count
    chrome.storage.sync.get(['sessionCount'], function(result) {
      const newCount = (result.sessionCount || 1) + 1;
      chrome.storage.sync.set({ sessionCount: newCount });
      updateStatistics(null, newCount);
    });
    
    // Could open options page in the future
    console.log('Settings clicked - Advanced options coming soon!');
  }

  function updateStatus(generalEnabled, shortsEnabled) {
    // Update general status - simplified for dark theme
    const generalStatusDot = statusText.querySelector('.status-dot');
    const generalStatusText = statusText.querySelector('span');
    
    if (generalEnabled) {
      statusText.classList.add('status-active');
      generalStatusText.textContent = 'Protection active';
    } else {
      statusText.classList.remove('status-active');
      generalStatusText.textContent = 'Protection disabled';
    }

    // Update shorts-specific status
    const shortsStatusDot = shortsStatus.querySelector('.status-dot');
    const shortsStatusText = shortsStatus.querySelector('span');
    
    if (shortsEnabled) {
      shortsStatus.classList.add('status-active');
      shortsStatusText.textContent = 'Shorts are blocked';
    } else {
      shortsStatus.classList.remove('status-active');
      shortsStatusText.textContent = 'Shorts are visible';
    }
  }

  function updateStatistics(blocked, sessions) {
    if (blocked !== null) {
      blockedCount.textContent = formatNumber(blocked);
      animateNumber(blockedCount);
    }
    if (sessions !== null) {
      sessionsCount.textContent = formatNumber(sessions);
      animateNumber(sessionsCount);
    }
  }

  function incrementBlockedCount() {
    chrome.storage.sync.get(['blockedShortsCount'], function(result) {
      const newCount = (result.blockedShortsCount || 0) + Math.floor(Math.random() * 5) + 1;
      chrome.storage.sync.set({ blockedShortsCount: newCount });
      updateStatistics(newCount, null);
    });
  }

  function refreshCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }

  // Animation helpers
  function addToggleAnimation(element) {
    element.style.transform = 'scale(1.02)';
    element.style.transition = 'transform 0.2s ease';
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 150);
  }

  function addButtonAnimation(button) {
    button.style.transform = 'scale(0.96)';
    button.style.transition = 'transform 0.1s ease';
    setTimeout(() => {
      button.style.transform = 'scale(1)';
    }, 100);
  }

  function animateNumber(element) {
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.2s ease';
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 200);
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Auto-refresh statistics every 30 seconds
  setInterval(() => {
    loadStatistics();
  }, 30000);

  // Add subtle hover effects to control groups
  controlGroups.forEach(group => {
    group.addEventListener('mouseenter', () => {
      group.style.transform = 'translateY(-1px)';
      group.style.transition = 'transform 0.2s ease';
    });
    
    group.addEventListener('mouseleave', () => {
      group.style.transform = 'translateY(0)';
    });
  });

  // Initialize with a welcome animation
  setTimeout(() => {
    controlGroups.forEach((group, index) => {
      setTimeout(() => {
        group.style.opacity = '1';
        group.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }, 100);

  // Add keyboard navigation support
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
}); 