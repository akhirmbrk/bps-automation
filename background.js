/**
 * BPS Automation v5.1.0 - Background Service Worker
 * Handles Chrome extension lifecycle, messaging, and JWT token storage
 */

/**
 * Validate JWT token expiry from the token's exp claim
 * @param {string} token - JWT token string
 * @returns {boolean} True if token is not expired
 */
function isJwtTokenExpired(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return !payload.exp || payload.exp > now;
  } catch {
    return false;
  }
}

// Open dashboard when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html'),
    active: true
  });
});

// Handle messages from dashboard and content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // FASIH: Get XSRF Token
  if (request.action === 'getAuthToken') {
    chrome.cookies.get(
      { url: 'https://fasih-sm.bps.go.id', name: 'XSRF-TOKEN' },
      (cookie) => sendResponse({ token: cookie?.value || null })
    );
    return true;
  }

  // FASIH: Get all cookies for domain
  if (request.action === 'getAllCookies') {
    chrome.cookies.getAll(
      { url: 'https://fasih-sm.bps.go.id' },
      (cookies) => sendResponse({ cookies: cookies || [] })
    );
    return true;
  }

  // MITRA: Save JWT token from content script
  if (request.action === 'saveJwtToken' && request.token) {
    chrome.storage.local.set({
      mitraJwtToken: request.token,
      mitraJwtTimestamp: request.timestamp || Date.now()
    }, () => {
      // Token stored successfully
    });
    sendResponse({ success: true });
    return true;
  }

  // MITRA: Get JWT token with expiry check
  if (request.action === 'getJwtToken') {
    chrome.storage.local.get(['mitraJwtToken', 'mitraJwtTimestamp'], (data) => {
      // Primary check: JWT exp claim in token
      if (data.mitraJwtToken && !isJwtTokenExpired(data.mitraJwtToken)) {
        sendResponse({ token: data.mitraJwtToken });
        return;
      }

      // Fallback: timestamp-based expiry
      const isTimestampExpired = data.mitraJwtTimestamp &&
        (Date.now() - data.mitraJwtTimestamp) > (60 * 60 * 1000);

      if (isTimestampExpired || !data.mitraJwtToken) {
        chrome.storage.local.remove(['mitraJwtToken', 'mitraJwtTimestamp']);
        sendResponse({ token: null, expired: true });
      } else {
        sendResponse({ token: data.mitraJwtToken });
      }
    });
    return true;
  }

  // MITRA: Clear JWT token
  if (request.action === 'clearJwtToken') {
    chrome.storage.local.remove(['mitraJwtToken', 'mitraJwtTimestamp'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Lifecycle: Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.clear();
  }
});
