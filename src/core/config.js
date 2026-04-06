/**
 * FASIH SCRAPPER - Configuration Manager
 * Handles loading, saving, and accessing application configuration
 */

import {
  STORAGE_KEYS,
  DEFAULT_API_CONFIG,
  DEFAULT_SCRAPER_CONFIG,
  DEFAULT_UI_CONFIG
} from '../constants.js';

import { Logger } from './logger.js';

class ConfigManager {
  constructor() {
    this.api = { ...DEFAULT_API_CONFIG };
    this.scraper = { ...DEFAULT_SCRAPER_CONFIG };
    this.ui = { ...DEFAULT_UI_CONFIG };
    this.load();
  }

  /**
   * Load configuration from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.api) {
          // Ensure modules always exists with defaults
          if (!parsed.api.modules) {
            parsed.api.modules = DEFAULT_API_CONFIG.modules;
          }
          Object.assign(this.api, parsed.api);
        }
        if (parsed.scraper) Object.assign(this.scraper, parsed.scraper);
        if (parsed.ui) Object.assign(this.ui, parsed.ui);
        Logger.debug('Configuration loaded from storage');
      }
    } catch (e) {
      Logger.warn('Failed to load configuration:', e.message);
    }
  }

  /**
   * Save configuration to localStorage
   */
  save() {
    try {
      const config = {
        api: this.api,
        scraper: this.scraper,
        ui: this.ui
      };
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      Logger.debug('Configuration saved to storage');
    } catch (e) {
      Logger.warn('Failed to save configuration:', e.message);
    }
  }

  /**
   * Get the full configuration object
   * @returns {Object} Configuration object
   */
  get() {
    return {
      api: { ...this.api },
      scraper: { ...this.scraper },
      ui: { ...this.ui }
    };
  }

  /**
   * Update configuration with new values
   * @param {Object} updates - Configuration updates
   */
  update(updates) {
    if (updates.api) Object.assign(this.api, updates.api);
    if (updates.scraper) Object.assign(this.scraper, updates.scraper);
    if (updates.ui) Object.assign(this.ui, updates.ui);
    this.save();
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    this.api = { ...DEFAULT_API_CONFIG };
    this.scraper = { ...DEFAULT_SCRAPER_CONFIG };
    this.ui = { ...DEFAULT_UI_CONFIG };
    this.save();
    Logger.info('Configuration reset to defaults');
  }

  /**
   * Get API configuration
   * @returns {Object} API configuration
   */
  getApi() {
    return { ...this.api };
  }

  /**
   * Get scraper configuration
   * @returns {Object} Scraper configuration
   */
  getScraper() {
    return { ...this.scraper };
  }

  /**
   * Get UI configuration
   * @returns {Object} UI configuration
   */
  getUI() {
    return { ...this.ui };
  }

  /**
   * Build a URL from module and endpoint
   * @param {string} module - Module name (survey, region, analytic, assignment)
   * @param {string} endpoint - Endpoint path
   * @param {Object} [params] - Query parameters
   * @returns {string} Full URL
   */
  buildUrl(module, endpoint, params = {}) {
    // Normalize module to uppercase for lookup
    const moduleKey = module.toUpperCase();
    const modulePath = this.api.modules[moduleKey];
    if (!modulePath) {
      throw new Error(`Unknown module: ${module}. Available modules: ${Object.keys(this.api.modules).join(', ')}`);
    }
    const base = `${this.api.baseUrl}${modulePath}${endpoint}`;
    const filtered = Object.entries(params)
      .filter(([_, v]) => v != null && v !== '')
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    return Object.keys(filtered).length === 0
      ? base
      : `${base}?${new URLSearchParams(filtered).toString()}`;
  }
}

// Export singleton instance
export const config = new ConfigManager();