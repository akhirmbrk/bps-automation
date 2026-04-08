/**
 * BPS Automation - Mitra JWT Extractor v2
 * Content script yang dijalankan di halaman manajemen-mitra.bps.go.id
 * untuk mengekstrak JWT token dari Authorization header
 * 
 * Improved: More robust JWT capture with multiple methods
 */

(function() {
  'use strict';

  // Flag to prevent duplicate injection
  if (window.__mitraJwtInjectorInjected) return;
  window.__mitraJwtInjectorInjected = true;

  console.log('[BPS JWT Extractor v2] Initializing...');

  let lastCapturedToken = null;
  let captureCount = 0;

  /**
   * Validate if a string is a proper JWT token
   * Must have 3 parts, decodable payload, and typical JWT claims
   */
  function isValidJwt(token) {
    if (!token || typeof token !== 'string') return false;
    if (!token.startsWith('eyJ')) return false;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      if (parts.some(p => p.length < 4)) return false;
      
      // Try to decode payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Must have at least one typical JWT claim
      const hasJwtClaims = payload.exp || payload.iat || payload.sub || payload.un || payload.n || payload.role || payload.type;
      if (!hasJwtClaims) return false;
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send JWT token to extension
   */
  function sendMessageToExtension(token) {
    if (!token || token === lastCapturedToken) return;
    
    // Strict JWT validation
    if (!isValidJwt(token)) {
      return;
    }

    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      // Check expiry
      if (payload.exp && payload.exp < now) {
        console.log('[BPS JWT Extractor] Token expired, skipping');
        return;
      }

      captureCount++;
      lastCapturedToken = token;
      const expDate = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'no expiry';
      console.log(`[BPS JWT Extractor] Captured valid JWT #${captureCount} (exp: ${expDate})`);

      // Send via chrome.runtime messaging
      chrome.runtime.sendMessage({
        action: 'saveJwtToken',
        token: token,
        timestamp: Date.now()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[BPS JWT Extractor] Message failed:', chrome.runtime.lastError.message);
        } else {
          console.log('[BPS JWT Extractor] JWT saved to extension storage');
        }
      });
    } catch (e) {
      console.log('[BPS JWT Extractor] Error processing token:', e.message);
    }
  }

  /**
   * Method 1: Intercept XMLHttpRequest setRequestHeader
   * Uses Object.freeze via closure to prevent prototype pollution
   */
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  Object.defineProperty(XMLHttpRequest.prototype, 'setRequestHeader', {
    value: function(header, value) {
      if (header?.toLowerCase() === 'authorization' && typeof value === 'string' && value.startsWith('Bearer ')) {
        sendMessageToExtension(value.substring(7));
      }
      return originalXHRSetRequestHeader.apply(this, arguments);
    },
    configurable: false,
    writable: false
  });

  /**
   * Method 2: Intercept fetch with Authorization header
   * Wrapped in IIFE to prevent global pollution
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const options = args[1] || {};
    const headers = options.headers;

    if (headers) {
      const authValue = headers instanceof Headers
        ? headers.get('Authorization')
        : typeof headers === 'object'
          ? Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
          : null;

      if (typeof authValue === 'string' && authValue.startsWith('Bearer ')) {
        sendMessageToExtension(authValue.substring(7));
      }
    }

    return originalFetch.apply(this, args);
  };

  // Lock fetch to prevent override
  Object.defineProperty(window, 'fetch', { configurable: false, writable: false });

  /**
   * Method 3: Check localStorage/sessionStorage for JWT
   */
  function checkStorageForJwt() {
    const storageKeys = ['token', 'jwt', 'auth', 'access_token', 'bearer', 'mitra_token'];
    
    try {
      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (isValidJwt(value)) {
          console.log(`[BPS JWT Extractor] Found valid JWT in localStorage[${key}]`);
          sendMessageToExtension(value);
        }
      }
    } catch (e) {}

    try {
      // Check sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        if (isValidJwt(value)) {
          console.log(`[BPS JWT Extractor] Found valid JWT in sessionStorage[${key}]`);
          sendMessageToExtension(value);
        }
      }
    } catch (e) {}

    // Check common storage key patterns
    storageKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (isValidJwt(value)) {
          console.log(`[BPS JWT Extractor] Found valid JWT in localStorage[${key}]`);
          sendMessageToExtension(value);
        }
      } catch (e) {}
      try {
        const value = sessionStorage.getItem(key);
        if (isValidJwt(value)) {
          console.log(`[BPS JWT Extractor] Found valid JWT in sessionStorage[${key}]`);
          sendMessageToExtension(value);
        }
      } catch (e) {}
    });
  }

  /**
   * Method 4: Check window objects for auth state
   */
  function checkWindowObjects() {
    const paths = [
      ['__INITIAL_STATE__', 'auth', 'token'],
      ['__INITIAL_STATE__', 'user', 'token'],
      ['VUE_APP', '$data', 'token'],
      ['__NUXT__', 'state', 'auth', 'token'],
      ['__REDUX_STATE__', 'auth', 'token']
    ];

    paths.forEach(path => {
      try {
        let obj = window;
        for (const key of path) {
          obj = obj[key];
          if (!obj) break;
        }
        if (obj && typeof obj === 'string' && obj.startsWith('eyJ')) {
          console.log(`[BPS JWT Extractor] Found JWT in window.${path.join('.')}`);
          sendMessageToExtension(obj);
        }
      } catch (e) {}
    });
  }

  /**
   * Monitor for dynamic content loading (SPA navigation)
   */
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        setTimeout(() => {
          checkStorageForJwt();
          checkWindowObjects();
        }, 1000);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }

  /**
   * Listen for messages from extension
   * Only respond to messages from the expected origin
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.action === 'GET_JWT_TOKEN') {
      // Respond with last captured token if available
      if (lastCapturedToken) {
        event.source.postMessage({
          action: 'JWT_TOKEN_RESPONSE',
          token: lastCapturedToken
        }, window.location.origin);
      }
    }
  });

  // Run initial checks
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkStorageForJwt, 1000);
      setTimeout(checkWindowObjects, 2000);
      setupMutationObserver();
    });
  } else {
    setTimeout(checkStorageForJwt, 500);
    setTimeout(checkWindowObjects, 1500);
    setupMutationObserver();
  }

  // Periodic check every 3 seconds
  setInterval(() => {
    checkStorageForJwt();
    checkWindowObjects();
  }, 3000);

  console.log('[BPS JWT Extractor v2] Started monitoring for JWT tokens');
})();