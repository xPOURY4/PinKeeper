/**
 * Pinterest Downloader
 * Background Service Worker
 */

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Pinterest Downloader extension installed');
  
  // Initialize storage with default settings
  chrome.storage.local.get({ 
    downloadedPins: [],
    downloadLocation: 'PINTEREST DOWNLOADS',
    imageQuality: 'high',
    maxConcurrentDownloads: 5,
    notifyOnComplete: true
  }, (result) => {
    chrome.storage.local.set(result);
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadPins') {
    downloadPins(message.pins, message.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  }
});

/**
 * Download multiple Pinterest images
 * @param {Array} imageUrls - Array of image URLs to download
 * @param {Object} options - Download options
 * @returns {Promise} - Promise resolving to download results
 */
async function downloadPins(imageUrls, options = {}) {
  // Default options
  const defaultOptions = {
    folderName: 'PINTEREST DOWNLOADS',
    maxDownloads: 10,
    skipExisting: true
  };
  
  const downloadOptions = { ...defaultOptions, ...options };
  
  // Get already downloaded pins
  const { downloadedPins } = await chrome.storage.local.get({ downloadedPins: [] });
  
  // Filter pins if skipExisting is true
  let pinsToDownload = downloadOptions.skipExisting 
    ? imageUrls.filter(url => !downloadedPins.includes(url))
    : imageUrls;
    
  // Limit downloads to specified number
  pinsToDownload = pinsToDownload.slice(0, downloadOptions.maxDownloads);
  
  if (pinsToDownload.length === 0) {
    return { success: true, message: 'No new pins to download', count: 0 };
  }
  
  // Generate timestamp for filenames
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('Z')[0];
  
  // Process downloads in batches to avoid overwhelming the browser
  const batchSize = 5;
  const results = { success: true, count: 0, failed: 0 };
  
  for (let i = 0; i < pinsToDownload.length; i += batchSize) {
    const batch = pinsToDownload.slice(i, i + batchSize);
    
    // Create download promises for the batch
    const downloadPromises = batch.map((url, index) => {
      return new Promise((resolve) => {
        const filename = `${downloadOptions.folderName}/pin_${timestamp}_${i + index + 1}.jpg`;
        
        chrome.downloads.download({
          url: url,
          filename: filename
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            results.failed++;
            resolve(false);
          } else {
            results.count++;
            resolve(true);
          }
        });
      });
    });
    
    // Wait for batch to complete
    await Promise.all(downloadPromises);
  }
  
  // Update storage with downloaded pins
  if (results.count > 0 && downloadOptions.skipExisting) {
    chrome.storage.local.set({ 
      downloadedPins: [...downloadedPins, ...pinsToDownload]
    });
  }
  
  return results;
} 