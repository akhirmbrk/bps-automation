/**
 * FASIH SCRAPPER - API Client
 * HTTP client with authentication, retry logic, and error handling
 */

import { config } from './config.js';
import { eventBus } from './event-bus.js';
import { Logger } from './logger.js';
import { sleep } from './utils.js';
import { XSRF_TOKEN_COOKIE, COOKIE_DOMAIN, RETRY_CONFIG } from '../constants.js';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(status, message, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

class ApiClient {
  constructor() {
    this.retryConfig = RETRY_CONFIG;
  }

  /**
   * Get XSRF token from cookies
   * @returns {Promise<string|null>} XSRF token or null
   */
  async getXsrfToken() {
    return new Promise((resolve) => {
      // Try multiple URL variations to find the cookie
      const urlsToTry = [
        'https://fasih-sm.bps.go.id',
        'https://fasih-sm.bps.go.id/',
        'https://manajemen-mitra.bps.go.id',
        'https://manajemen-mitra.bps.go.id/'
      ];
      
      let tryIndex = 0;
      const tryNext = () => {
        if (tryIndex >= urlsToTry.length) {
          resolve(null);
          return;
        }
        chrome.cookies.get(
          { url: urlsToTry[tryIndex], name: XSRF_TOKEN_COOKIE },
          (cookie) => {
            if (cookie && cookie.value) {
              resolve(cookie.value);
            } else {
              tryIndex++;
              tryNext();
            }
          }
        );
      };
      tryNext();
    });
  }

  /**
   * Get all cookies for the domain
   * @returns {Promise<Array>} Array of cookies
   */
  async getAllCookies() {
    return new Promise((resolve) => {
      chrome.cookies.getAll({ domain: COOKIE_DOMAIN }, (cookies) => {
        resolve(cookies || []);
      });
    });
  }

  /**
   * Get authentication headers
   * @returns {Promise<Object>} Headers object
   */
  async getAuthHeaders() {
    const xsrf = await this.getXsrfToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      ...(xsrf && { 'X-XSRF-TOKEN': xsrf })
    };
  }

  /**
   * Parse API response
   * @param {Object} response - API response
   * @param {string} [key='data'] - Key to extract data from
   * @returns {Array|Object} Parsed data
   */
  parseResponse(response, key = 'data') {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data?.content && Array.isArray(response.data.content)) return response.data.content;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response[key] && Array.isArray(response[key])) return response[key];
    return [response];
  }

  /**
   * Validate and parse an HTTP response
   * @param {Response} response - Fetch response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {string} label - Request label
   * @returns {Promise<Object>} Parsed JSON data
   */
  async #handleResponse(response, method, url, label) {
    const contentType = response.headers.get('content-type') || '';

    // Guard: Check redirect to login
    if (/oauth_login|login|oauth/.test(response.url)) {
      Logger.warn('[ApiClient] Redirected to login — session may be expired');
      throw new ApiError(401, 'Session expired - redirected to login', url);
    }

    // Guard: Check response is not HTML
    if (contentType.includes('text/html')) {
      Logger.warn('[ApiClient] Received HTML response instead of JSON');
      throw new ApiError(401, 'Invalid response format - HTML received', url);
    }

    // Guard: Check response status
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      eventBus.emit('api:error', { method, url, status: response.status, error: text });
      throw new ApiError(response.status, response.statusText, url);
    }

    // Guard: Validate content-type
    if (!contentType.includes('application/json')) {
      Logger.warn('[ApiClient] Response is not JSON, content-type:', contentType);
      throw new ApiError(400, 'Invalid response format', url);
    }

    return response.json();
  }

  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {string} [label=''] - Request label for logging
   * @returns {Promise<Object>} Response data
   */
  async get(url, label = '') {
    eventBus.emit('api:request', { method: 'GET', url, label });

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, { method: 'GET', credentials: 'include', headers, cache: 'no-store', redirect: 'follow' });
      const data = await this.#handleResponse(response, 'GET', url, label);
      eventBus.emit('api:success', { method: 'GET', url, label });
      return data;
    } catch (err) {
      eventBus.emit('api:error', { method: 'GET', url, error: err.message });
      throw err;
    }
  }

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {Object} payload - Request payload
   * @param {string} [label=''] - Request label for logging
   * @returns {Promise<Object>} Response data
   */
  async post(url, payload, label = '') {
    eventBus.emit('api:request', { method: 'POST', url, label, payload });

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
        redirect: 'follow'
      });
      const data = await this.#handleResponse(response, 'POST', url, label);
      eventBus.emit('api:success', { method: 'POST', url, label });
      return data;
    } catch (err) {
      eventBus.emit('api:error', { method: 'POST', url, error: err.message });
      throw err;
    }
  }

  /**
   * Make a request with retry logic
   * @param {Function} fn - Function to retry
   * @param {number} [maxRetries] - Maximum retry attempts
   * @param {number} [delay] - Base delay between retries
   * @returns {Promise<*>} Result of the function
   */
  async retry(fn, maxRetries = this.retryConfig.MAX_RETRIES, delay = this.retryConfig.BASE_DELAY) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i === maxRetries) throw e;
        eventBus.emit('api:retry', { attempt: i + 1, maxRetries, error: e.message });
        await sleep(delay * (i + 1));
      }
    }
  }

  /**
   * Build a URL from module and endpoint
   * @param {string} module - Module name
   * @param {string} endpoint - Endpoint path
   * @param {Object} [params] - Query parameters
   * @returns {string} Full URL
   */
  buildUrl(module, endpoint, params = {}) {
    return config.buildUrl(module, endpoint, params);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();