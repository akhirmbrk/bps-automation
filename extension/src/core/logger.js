/**
 * FASIH SCRAPPER - Logger
 * Centralized logging with levels and UI integration
 */

import { LOG_LEVELS } from '../constants.js';

class Logger {
  static level = LOG_LEVELS.INFO;
  static uiCallback = null;

  /**
   * Set the minimum log level
   * @param {number} level - Log level from LOG_LEVELS
   */
  static setLevel(level) {
    this.level = level;
  }

  /**
   * Set a callback for UI logging
   * @param {Function} callback - Function to call for UI logs
   */
  static setUICallback(callback) {
    this.uiCallback = callback;
  }

  /**
   * Log a debug message
   * @param {...*} args - Arguments to log
   */
  static debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug('[DEBUG]', ...args);
    }
  }

  /**
   * Log an info message
   * @param {...*} args - Arguments to log
   */
  static info(...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.info('[INFO]', ...args);
    }
  }

  /**
   * Log a warning message
   * @param {...*} args - Arguments to log
   */
  static warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  /**
   * Log an error message
   * @param {...*} args - Arguments to log
   */
  static error(...args) {
    console.error('[ERROR]', ...args);
  }

  /**
   * Log a success message
   * @param {...*} args - Arguments to log
   */
  static success(...args) {
    if (this.level <= LOG_LEVELS.SUCCESS) {
      console.info('[SUCCESS]', ...args);
    }
  }

  /**
   * Log to UI (terminal)
   * @param {string} message - Message to display
   * @param {string} type - Log type (info, success, warning, error)
   */
  static logToUI(message, type = 'info') {
    if (this.uiCallback) {
      try {
        this.uiCallback(message, type);
      } catch (err) {
        console.error('[Logger] UI callback error:', err);
      }
    }
  }

  /**
   * Format a timestamp
   * @returns {string} Formatted timestamp
   */
  static getTimestamp() {
    return new Date().toLocaleTimeString('id-ID');
  }

  /**
   * Create a separator line
   * @param {string} char - Character to repeat
   * @param {number} length - Length of separator
   * @returns {string} Separator string
   */
  static separator(char = '=', length = 55) {
    return char.repeat(length);
  }
}

export { Logger, LOG_LEVELS };