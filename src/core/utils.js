/**
 * FASIH SCRAPPER - Utilities
 * Common utility functions used across the application
 */

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean region name by removing code prefix
 * @param {string} name - Region name to clean
 * @returns {string} Cleaned region name
 */
export const cleanRegionName = (name) => {
  if (!name) return '';
  return String(name).replace(/^(\[?\d+\]?\s*)/, '').trim();
};

/**
 * Format number with Indonesian locale
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(num);

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted size string
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get current time as formatted string
 * @returns {string} Formatted time string
 */
export const getTimestamp = () => new Date().toLocaleTimeString('id-ID');

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (!inThrottle) {
      func.apply(null, lastArgs);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
};

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
};

/**
 * Deep clone an object using native structuredClone
 * @template T
 * @param {T} obj - Object to clone
 * @returns {T} Cloned object
 */
export const deepClone = (obj) => structuredClone(obj);

/**
 * Generate a random ID
 * @returns {string} Random ID
 */
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return '_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

/**
 * Check if a value is empty
 * @param {*} val - Value to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (val) => {
  if (val == null) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === 'object' && Object.keys(val).length === 0) return true;
  return false;
};

/**
 * Pad a string with a character
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @param {string} char - Character to pad with
 * @returns {string} Padded string
 */
export const pad = (str, length, char = ' ') => String(str).padStart(length, char);

/**
 * Get initials from a name
 * @param {string} name - Name to get initials from
 * @returns {string} Initials
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
};

/**
 * Format duration in seconds to MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Create a separator line
 * @param {string} char - Character to repeat
 * @param {number} length - Length of separator
 * @returns {string} Separator string
 */
export const separator = (char = '=', length = 55) => char.repeat(length);

/**
 * Safely parse JSON
 * @param {string} json - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
export const safeJsonParse = (json, defaultValue = null) => {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
};

/**
 * Wait for DOM to be ready
 * @returns {Promise<void>}
 */
export const waitForDOM = () => {
  if (document.readyState === 'loading') {
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  return Promise.resolve();
};

/**
 * Get element by ID with type safety
 * @param {string} id - Element ID
 * @param {string} [tag] - Expected tag name
 * @returns {HTMLElement|null}
 */
export const getElement = (id, tag = null) => {
  const el = document.getElementById(id);
  if (tag && el && el.tagName.toLowerCase() !== tag.toLowerCase()) {
    console.warn(`[Utils] Element #${id} is not a <${tag}>`);
  }
  return el;
};

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement} el - Element to add listener to
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function
 */
export const addEventListener = (el, event, handler) => {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
};

// Namespace export for convenience
const utils = {
  sleep, cleanRegionName, formatNumber, formatBytes, getTimestamp,
  debounce, throttle, escapeHtml, deepClone, generateId, isEmpty,
  pad, getInitials, formatDuration, separator, safeJsonParse,
  waitForDOM, getElement, addEventListener
};

export { utils };
