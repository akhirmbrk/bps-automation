// background.js - Service Worker untuk BPS Automation v5.0
// Fungsi: Membuka dashboard saat ikon ekstensi diklik
//         Menyimpan JWT token dari content script

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard.html"),
    active: true
  });
});

// Handle pesan dari dashboard dan content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // FASIH: Get XSRF Token
  if (request.action === "getAuthToken") {
    chrome.cookies.get({
      url: "https://fasih-sm.bps.go.id",
      name: "XSRF-TOKEN"
    }, (cookie) => {
      sendResponse({ token: cookie?.value || null });
    });
    return true; // Enable async response
  }

  // FASIH: Get all cookies
  if (request.action === "getAllCookies") {
    chrome.cookies.getAll({
      url: "https://fasih-sm.bps.go.id"
    }, (cookies) => {
      sendResponse({ cookies: cookies || [] });
    });
    return true;
  }

  // MITRA: Save JWT token from content script
  if (request.action === "saveJwtToken" && request.token) {
    console.log('[Background] Saving JWT token from content script');
    chrome.storage.local.set({
      mitraJwtToken: request.token,
      mitraJwtTimestamp: request.timestamp || Date.now()
    }, () => {
      console.log('[Background] JWT token saved to storage');
    });
    sendResponse({ success: true });
    return true;
  }

  // MITRA: Get JWT token
  if (request.action === "getJwtToken") {
    chrome.storage.local.get(['mitraJwtToken', 'mitraJwtTimestamp'], (data) => {
      // Check if token is expired (1 hour expiry)
      const isExpired = data.mitraJwtTimestamp && 
        (Date.now() - data.mitraJwtTimestamp) > (60 * 60 * 1000);
      
      if (isExpired) {
        console.log('[Background] JWT token expired, clearing');
        chrome.storage.local.remove('mitraJwtToken');
        sendResponse({ token: null, expired: true });
      } else {
        sendResponse({ token: data.mitraJwtToken || null });
      }
    });
    return true;
  }

  // MITRA: Clear JWT token
  if (request.action === "clearJwtToken") {
    chrome.storage.local.remove(['mitraJwtToken', 'mitraJwtTimestamp'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Log when service worker starts
console.log('[BPS Automation] Background service worker started');
