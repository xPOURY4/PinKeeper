/**
 * Pinterest Downloader
 * Content Script
 */

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPins') {
    const imageUrls = findPinterestImages();
    sendResponse({ imageUrls });
  }
  
  if (message.action === 'scrollPage') {
    scrollToLoadMore(message.amount || 5)
      .then(newImages => sendResponse({ success: true, newImagesCount: newImages }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  }
});

/**
 * Find all Pinterest images on the current page
 * @returns {Array} Array of image URLs
 */
function findPinterestImages() {
  // This array will store our filtered image URLs
  let imageUrls = [];
  
  // STEP 1: Find pins through multiple methods for better coverage
  
  // Method 1: Get images from standard pin containers
  const pinElements = Array.from(document.querySelectorAll([
    '[data-test-id="pin"]', 
    '[data-grid-item="true"]', 
    '.Pin',
    'div[role="list"] > div', // Pinterest board layout
    'div[data-test-id="pinWrapper"]',
    'div[data-test-id="pinCard"]'
  ].join(', ')));
  
  // Method 2: Find all large Pinterest images
  const allImages = Array.from(document.querySelectorAll('img[src*="pinimg.com"]'))
    .filter(img => {
      // Only include reasonably sized images (excludes icons, tiny thumbnails)
      return img.naturalWidth > 150 || img.width > 150 || img.offsetWidth > 150;
    });
  
  // STEP 2: Build a collection of ad-related selectors to check against
  const adIndicators = [
    // Ad container identifiers
    '[data-test-id="ad-container"]',
    '[data-test-id="promotedPin"]',
    '[aria-label*="promoted"]',
    '[aria-label*="Promoted"]',
    '[aria-label*="advertisement"]',
    '[aria-label*="Advertisement"]',
    '[aria-label*="Sponsored"]',
    '[aria-label*="sponsored"]',
    '.promotedPin',
    '.promoted-pin',
    '.ads-container',
    
    // Text-based indicators
    'div:has(span:contains("Promoted by"))',
    'div:has(span:contains("Sponsored"))',
    'div:has(span:contains("Ad by"))',
    'div:has(div:contains("Promoted"))'
  ];
  
  // Helper function to check if an element is ad-related
  function isAdRelated(element) {
    // Check the element against our selectors
    for (const selector of adIndicators) {
      try {
        if (element.matches?.(selector) || element.closest?.(selector)) {
          return true;
        }
      } catch (e) {
        continue; // Some advanced selectors might not be supported
      }
    }
    
    // Text-based checks
    const nearbyText = element.innerText || '';
    const adKeywords = ['promoted', 'sponsored', 'advertisement', 'ad by'];
    if (adKeywords.some(keyword => nearbyText.toLowerCase().includes(keyword))) {
      return true;
    }
    
    // URL-based checks
    if (element.src && (
        element.src.includes('/ad/') || 
        element.src.includes('promoted') || 
        element.src.includes('sponsored')
    )) {
      return true;
    }
    
    return false;
  }
  
  // STEP 3: Process pin elements and extract high-quality non-ad images
  pinElements.forEach(pin => {
    if (!isAdRelated(pin)) {
      const pinImg = pin.querySelector('img[src*="pinimg.com"]');
      if (pinImg && pinImg.src) {
        // Apply quality transformations to get highest resolution
        let highQualitySrc = enhanceImageQuality(pinImg.src);
        
        if (!imageUrls.includes(highQualitySrc)) {
          imageUrls.push(highQualitySrc);
        }
      }
    }
  });
  
  // STEP 4: If we didn't get enough pins from containers, use the filtered image approach
  if (imageUrls.length < 5 && allImages.length > 0) {
    allImages.forEach(img => {
      if (!isAdRelated(img)) {
        let highQualitySrc = enhanceImageQuality(img.src);
        
        if (!imageUrls.includes(highQualitySrc)) {
          imageUrls.push(highQualitySrc);
        }
      }
    });
  }
  
  // STEP 5: Filter out URLs with ad-related patterns
  imageUrls = imageUrls.filter(url => {
    return !(
      url.includes('/ad/') || 
      url.includes('promoted') || 
      url.includes('sponsored') ||
      url.includes('advertisement')
    );
  });
  
  return imageUrls;
}

/**
 * Enhance image quality by transforming Pinterest URLs
 * @param {string} url - Original Pinterest image URL
 * @returns {string} - Enhanced high-quality URL
 */
function enhanceImageQuality(url) {
  // Various transformations to try to get highest quality
  let enhancedUrl = url;
  
  // Replace size specifications with originals
  enhancedUrl = enhancedUrl.replace(/\/\d+x\//g, '/originals/');
  enhancedUrl = enhancedUrl.replace(/\/\d+x\d+\//g, '/originals/');
  
  // Replace various Pinterest image sizes with original
  enhancedUrl = enhancedUrl.replace(/\/236x\//g, '/originals/');
  enhancedUrl = enhancedUrl.replace(/\/474x\//g, '/originals/');
  enhancedUrl = enhancedUrl.replace(/\/736x\//g, '/originals/');
  
  // Handle image width parameters
  enhancedUrl = enhancedUrl.replace(/\?w=\d+/, '');
  
  return enhancedUrl;
}

/**
 * Scroll the page to load more pins
 * @param {number} scrollCount - Number of scroll operations to perform
 * @returns {Promise} - Promise resolving to the number of new images found
 */
async function scrollToLoadMore(scrollCount = 5) {
  const initialImages = findPinterestImages().length;
  
  for (let i = 0; i < scrollCount; i++) {
    // Scroll down
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  const newImages = findPinterestImages().length;
  return newImages - initialImages;
} 