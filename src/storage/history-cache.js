/**
 * FASIH SCRAPPER - History Cache
 * Handles caching of scraping history with TTL (10-minute expiration)
 */

import { STORAGE_KEYS, HISTORY_CONFIG } from '../constants.js';
import { Logger } from '../core/logger.js';

class HistoryCache {
  /**
   * Save data to cache
   * @param {string} id - Cache ID
   * @param {Object} data - Data to cache
   * @returns {boolean} True if saved successfully
   */
  static save(id, data) {
    try {
      const cacheData = {
        data: data.data || [],
        timestamp: Date.now(),
        date: data.date || '',
        survey: data.surveyName || '',
        mode: data.mode || 'biasa',
        records: data.records || 0,
        fileSize: data.fileSize || 0
      };
      localStorage.setItem(STORAGE_KEYS.HISTORY_PREFIX + id, JSON.stringify(cacheData));
      return true;
    } catch (e) {
      Logger.warn('[HistoryCache] Save failed:', e);
      return false;
    }
  }

  /**
   * Get data from cache
   * @param {string} id - Cache ID
   * @returns {Object|null} Cached data or null if expired/not found
   */
  static get(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY_PREFIX + id);
      if (!raw) return null;
      
      const cached = JSON.parse(raw);
      const age = Date.now() - cached.timestamp;
      
      if (age > HISTORY_CONFIG.TTL_MS) {
        localStorage.removeItem(STORAGE_KEYS.HISTORY_PREFIX + id);
        return null; // Expired
      }
      
      return cached;
    } catch (e) {
      Logger.warn('[HistoryCache] Get failed:', e);
      return null;
    }
  }

  /**
   * Remove data from cache
   * @param {string} id - Cache ID
   */
  static remove(id) {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY_PREFIX + id);
    } catch (e) {
      Logger.warn('[HistoryCache] Remove failed:', e);
    }
  }

  /**
   * Get all cached items
   * @returns {Array} Array of cached items
   */
  static getAll() {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.HISTORY_PREFIX)) {
        const id = key.replace(STORAGE_KEYS.HISTORY_PREFIX, '');
        const cached = this.get(id);
        if (cached) {
          items.push({ id, ...cached });
        }
      }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear all cached items
   * @returns {number} Number of items cleared
   */
  static clearAll() {
    const all = this.getAll();
    all.forEach(item => {
      localStorage.removeItem(STORAGE_KEYS.HISTORY_PREFIX + item.id);
    });
    return all.length;
  }

  /**
   * Clear expired items
   */
  static clearExpired() {
    const all = this.getAll();
    all.forEach(item => {
      if (Date.now() - item.timestamp > HISTORY_CONFIG.TTL_MS) {
        localStorage.removeItem(STORAGE_KEYS.HISTORY_PREFIX + item.id);
      }
    });
  }
}

export { HistoryCache };