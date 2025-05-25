/**
 * Pinterest Downloader
 * Popup UI Controller
 */

// App state
const state = {
  activeTab: 'download',
  currentPins: [],
  isScanning: false,
  settings: {
    downloadFolder: 'PINTEREST DOWNLOADS',
    maxDownloads: 10,
    imageQuality: 'high',
    skipExisting: true,
    notifyComplete: true
  }
};

// DOM Elements
const elements = {
  // Tabs
  tabs: document.querySelectorAll('.tab'),
  sections: document.querySelectorAll('.section'),
  
  // Download section
  currentPageInfo: document.getElementById('current-page-info'),
  pinCount: document.getElementById('pin-count'),
  pinsLoadedIndicator: document.getElementById('pins-loaded-indicator'),
  scanBtn: document.getElementById('scan-btn'),
  loadMoreBtn: document.getElementById('load-more-btn'),
  downloadBtn: document.getElementById('download-btn'),
  downloadStatus: document.getElementById('download-status'),
  statusMessage: document.getElementById('status-message'),
  previewContainer: document.getElementById('preview-container'),
  noPreviewMessage: document.getElementById('no-preview-message'),
  
  // History section
  totalDownloaded: document.getElementById('total-downloaded'),
  historyList: document.getElementById('history-list'),
  noHistoryMessage: document.getElementById('no-history-message'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  
  // Settings section
  downloadFolder: document.getElementById('download-folder'),
  maxDownloads: document.getElementById('max-downloads'),
  imageQuality: document.getElementById('image-quality'),
  skipExisting: document.getElementById('skip-existing'),
  notifyComplete: document.getElementById('notify-complete'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  
  // About section
  socialLinks: document.querySelectorAll('.social-link')
};

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadSettings();
  checkCurrentPage();
  setupEventListeners();
  loadDownloadHistory();
  initSocialLinks();
  addTabHoverEffects();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      elements.tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active section
      elements.sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${tabName}-section`) {
          section.classList.add('active');
        }
      });
      
      // Update state
      state.activeTab = tabName;
    });
  });
}

/**
 * Initialize social links in the About tab
 */
function initSocialLinks() {
  elements.socialLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.getAttribute('href');
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });
}

/**
 * Add hover effects to tabs
 */
function addTabHoverEffects() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('mouseenter', () => {
      if (!tab.classList.contains('active')) {
        tab.querySelector('.material-symbols-rounded').style.transform = 'scale(1.2)';
      }
    });
    
    tab.addEventListener('mouseleave', () => {
      tab.querySelector('.material-symbols-rounded').style.transform = 'scale(1)';
    });
  });
}

/**
 * Load user settings from storage
 */
function loadSettings() {
  chrome.storage.local.get({
    downloadFolder: 'PINTEREST DOWNLOADS',
    maxDownloads: 10,
    imageQuality: 'high',
    skipExisting: true,
    notifyComplete: true
  }, (items) => {
    // Update state
    state.settings = items;
    
    // Update UI
    elements.downloadFolder.value = items.downloadFolder;
    elements.maxDownloads.value = items.maxDownloads;
    elements.imageQuality.value = items.imageQuality;
    elements.skipExisting.checked = items.skipExisting;
    elements.notifyComplete.checked = items.notifyComplete;
  });
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // Scan button
  elements.scanBtn.addEventListener('click', scanForPins);
  
  // Load more button
  elements.loadMoreBtn.addEventListener('click', loadMorePins);
  
  // Download button
  elements.downloadBtn.addEventListener('click', downloadPins);
  
  // Clear history button
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  
  // Save settings button
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Add animations to buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.98)';
    });
    
    btn.addEventListener('mouseup', () => {
      btn.style.transform = '';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

/**
 * Check current page to see if it's a Pinterest page
 */
function checkCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      elements.currentPageInfo.textContent = 'Not a Pinterest page';
      disableDownloadFeatures();
      return;
    }
    
    const url = new URL(currentTab.url);
    
    if (url.hostname.includes('pinterest')) {
      let pageType = 'Pinterest';
      let pageIcon = 'pin_invoke';
      
      if (url.pathname.includes('/pin/')) {
        pageType = 'Pin Detail';
        pageIcon = 'push_pin';
      } else if (url.pathname.match(/\/[^\/]+\/[^\/]+\/?$/)) {
        pageType = 'Board';
        pageIcon = 'dashboard';
      } else if (url.pathname.match(/\/[^\/]+\/?$/)) {
        pageType = 'Profile';
        pageIcon = 'person';
      } else if (url.pathname.includes('/search/')) {
        pageType = 'Search Results';
        pageIcon = 'search';
      }
      
      elements.currentPageInfo.innerHTML = `Current page: <strong>${pageType}</strong>`;
      
      // Enable scan button
      elements.scanBtn.disabled = false;
      elements.loadMoreBtn.disabled = false;
    } else {
      elements.currentPageInfo.textContent = 'Not a Pinterest page';
      disableDownloadFeatures();
    }
  });
}

/**
 * Disable download features when not on Pinterest
 */
function disableDownloadFeatures() {
  elements.scanBtn.disabled = true;
  elements.loadMoreBtn.disabled = true;
  elements.downloadBtn.disabled = true;
}

/**
 * Scan the current page for Pinterest pins
 */
function scanForPins() {
  state.isScanning = true;
  updateUIState();
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      showStatus('Could not access current tab', 'error');
      state.isScanning = false;
      updateUIState();
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getPins' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error communicating with page: ' + chrome.runtime.lastError.message, 'error');
        state.isScanning = false;
        updateUIState();
        return;
      }
      
      if (response && response.imageUrls) {
        state.currentPins = response.imageUrls;
        elements.pinCount.textContent = state.currentPins.length;
        
        // Update preview
        updatePinPreviews();
        
        if (state.currentPins.length > 0) {
          elements.downloadBtn.disabled = false;
          showStatus(`Found ${state.currentPins.length} pins!`, 'success');
        } else {
          elements.downloadBtn.disabled = true;
          showStatus('No pins found on this page', 'error');
        }
      } else {
        showStatus('No response from page. Try refreshing the page.', 'error');
      }
      
      state.isScanning = false;
      updateUIState();
    });
  });
}

/**
 * Load more pins by scrolling the page
 */
function loadMorePins() {
  state.isScanning = true;
  updateUIState();
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      state.isScanning = false;
      updateUIState();
      return;
    }
    
    // Send message to scroll page
    chrome.tabs.sendMessage(tabs[0].id, { action: 'scrollPage', amount: 5 }, (scrollResult) => {
      if (chrome.runtime.lastError) {
        showStatus('Error scrolling page', 'error');
        state.isScanning = false;
        updateUIState();
        return;
      }
      
      // Get pins after scrolling
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getPins' }, (response) => {
        if (response && response.imageUrls) {
          const previousCount = state.currentPins.length;
          state.currentPins = response.imageUrls;
          const newCount = state.currentPins.length;
          
          elements.pinCount.textContent = state.currentPins.length;
          
          // Update preview
          updatePinPreviews();
          
          if (newCount > previousCount) {
            showStatus(`Found ${newCount - previousCount} new pins!`, 'success');
          } else {
            elements.pinsLoadedIndicator.classList.remove('hidden');
            showStatus('No new pins found', 'error');
          }
          
          if (state.currentPins.length > 0) {
            elements.downloadBtn.disabled = false;
          }
        }
        
        state.isScanning = false;
        updateUIState();
      });
    });
  });
}

/**
 * Download the found pins
 */
function downloadPins() {
  if (state.currentPins.length === 0) {
    showStatus('No pins to download', 'error');
    return;
  }
  
  const options = {
    folderName: state.settings.downloadFolder,
    maxDownloads: parseInt(state.settings.maxDownloads, 10),
    skipExisting: state.settings.skipExisting
  };
  
  // Show downloading status
  showStatus('Downloading pins...', 'success');
  
  // Send message to background script to handle downloads
  chrome.runtime.sendMessage({
    action: 'downloadPins',
    pins: state.currentPins,
    options: options
  }, (result) => {
    if (chrome.runtime.lastError) {
      showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    if (result.success) {
      if (result.count > 0) {
        showStatus(`Successfully downloaded ${result.count} pins!`, 'success');
        
        // Add to history
        addToHistory(result.count);
        
        // Refresh history if on history tab
        if (state.activeTab === 'history') {
          loadDownloadHistory();
        }
      } else {
        showStatus(result.message || 'No new pins to download', 'error');
      }
    } else {
      showStatus('Error: ' + (result.error || 'Unknown error'), 'error');
    }
  });
}

/**
 * Update pin previews in the UI
 */
function updatePinPreviews() {
  // Clear existing previews
  elements.previewContainer.innerHTML = '';
  
  // If no pins, show message
  if (state.currentPins.length === 0) {
    elements.previewContainer.appendChild(elements.noPreviewMessage);
    return;
  }
  
  // Add up to 6 preview images
  const previewPins = state.currentPins.slice(0, 6);
  
  previewPins.forEach((pin, index) => {
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'mb-sm';
    
    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = pin;
    img.alt = `Pinterest pin ${index + 1}`;
    img.title = 'Click to view full size';
    img.loading = 'lazy';
    
    // Add subtle animation delay to create staggered loading effect
    img.style.animationDelay = `${index * 0.1}s`;
    
    img.addEventListener('click', () => {
      chrome.tabs.create({ url: pin });
    });
    
    img.addEventListener('error', () => {
      img.src = '../assets/icons/icon128.png';
      img.style.opacity = '0.5';
      img.title = 'Image could not be loaded';
    });
    
    previewWrapper.appendChild(img);
    elements.previewContainer.appendChild(previewWrapper);
  });
  
  // Add "more pins" indicator if needed
  if (state.currentPins.length > 6) {
    const moreInfo = document.createElement('p');
    moreInfo.textContent = `+ ${state.currentPins.length - 6} more pins`;
    moreInfo.className = 'text-secondary text-center';
    elements.previewContainer.appendChild(moreInfo);
  }
}

/**
 * Add download record to history
 * @param {number} count - Number of pins downloaded
 */
function addToHistory(count) {
  chrome.storage.local.get({ downloadHistory: [] }, (data) => {
    const history = data.downloadHistory || [];
    
    const downloadRecord = {
      date: new Date().toISOString(),
      count: count,
      source: document.title || 'Pinterest'
    };
    
    history.unshift(downloadRecord);
    
    // Keep only the last 50 records
    if (history.length > 50) {
      history.length = 50;
    }
    
    chrome.storage.local.set({ downloadHistory: history });
  });
}

/**
 * Load download history from storage
 */
function loadDownloadHistory() {
  chrome.storage.local.get({ downloadHistory: [], downloadedPins: [] }, (data) => {
    const history = data.downloadHistory || [];
    const totalPins = data.downloadedPins.length;
    
    elements.totalDownloaded.textContent = totalPins;
    
    // Clear existing history
    elements.historyList.innerHTML = '';
    
    if (history.length === 0) {
      elements.historyList.appendChild(elements.noHistoryMessage);
      return;
    }
    
    // Add history items
    history.forEach(record => {
      const date = new Date(record.date);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      const historyItem = document.createElement('div');
      historyItem.className = 'card';
      
      const historyContent = document.createElement('div');
      historyContent.className = 'flex justify-between items-center';
      
      const historyInfo = document.createElement('div');
      historyInfo.innerHTML = `
        <div>${record.source}</div>
        <div class="text-secondary">${formattedDate}</div>
      `;
      
      const pinCount = document.createElement('div');
      pinCount.className = 'badge';
      pinCount.textContent = record.count;
      
      historyContent.appendChild(historyInfo);
      historyContent.appendChild(pinCount);
      historyItem.appendChild(historyContent);
      
      elements.historyList.appendChild(historyItem);
    });
  });
}

/**
 * Clear download history
 */
function clearHistory() {
  if (confirm('Are you sure you want to clear your download history?')) {
    chrome.storage.local.set({ downloadHistory: [] }, () => {
      loadDownloadHistory();
      showStatus('History cleared', 'success');
    });
  }
}

/**
 * Save settings to storage
 */
function saveSettings() {
  const settings = {
    downloadFolder: elements.downloadFolder.value.trim() || 'PINTEREST DOWNLOADS',
    maxDownloads: parseInt(elements.maxDownloads.value, 10),
    imageQuality: elements.imageQuality.value,
    skipExisting: elements.skipExisting.checked,
    notifyComplete: elements.notifyComplete.checked
  };
  
  chrome.storage.local.set(settings, () => {
    state.settings = settings;
    showStatus('Settings saved', 'success');
    
    // Add visual feedback
    elements.saveSettingsBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Saved!';
    
    setTimeout(() => {
      elements.saveSettingsBtn.innerHTML = '<span class="material-symbols-rounded">save</span> Save Settings';
    }, 2000);
  });
}

/**
 * Show status message
 * @param {string} message - The message to display
 * @param {string} type - The message type (success/error)
 */
function showStatus(message, type = 'success') {
  elements.downloadStatus.className = `status status-${type}`;
  elements.statusMessage.textContent = message;
  elements.downloadStatus.classList.remove('hidden');
  
  // Add subtle animation
  elements.downloadStatus.style.animation = 'none';
  setTimeout(() => {
    elements.downloadStatus.style.animation = 'fadeIn 0.3s ease';
  }, 10);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.downloadStatus.classList.add('hidden');
  }, 5000);
}

/**
 * Update UI state based on current app state
 */
function updateUIState() {
  if (state.isScanning) {
    elements.scanBtn.disabled = true;
    elements.loadMoreBtn.disabled = true;
    elements.downloadBtn.disabled = true;
    
    elements.scanBtn.innerHTML = '<div class="spinner"></div>';
    elements.loadMoreBtn.innerHTML = '<div class="spinner"></div>';
  } else {
    elements.scanBtn.disabled = false;
    elements.loadMoreBtn.disabled = false;
    elements.downloadBtn.disabled = state.currentPins.length === 0;
    
    elements.scanBtn.innerHTML = '<span class="material-symbols-rounded">search</span> Scan for Pins';
    elements.loadMoreBtn.innerHTML = '<span class="material-symbols-rounded">expand_more</span> Load More Pins';
  }
} 