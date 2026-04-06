/**
 * FASIH SCRAPPER - Auth Service
 * Handles authentication, user info, and session management
 */

import { apiClient } from '../../core/api-client.js';
import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { API_ENDPOINTS, SESSION_COOKIE_PATTERNS } from '../../constants.js';

class AuthService {
  constructor() {
    this.userInfo = null;
    this.isLoggedIn = false;
  }

  /**
   * Check if user is logged in
   * @returns {Promise<boolean>} True if logged in
   */
  async checkLogin() {
    try {
      const url = apiClient.buildUrl('survey', API_ENDPOINTS.USER_INFO);
      const data = await apiClient.get(url, 'Check Login');
      
      if (data && data.data) {
        this.userInfo = data.data;
        // Fetch profile image from community.bps.go.id
        this.userInfo.avatarUrl = await this.getProfileImage();
        this.isLoggedIn = true;
        eventBus.emit('auth:status', { loggedIn: true, user: this.userInfo });
        return true;
      }

      // Fallback to cookie check
      const cookies = await apiClient.getAllCookies();
      const hasSession = cookies.some(c =>
        SESSION_COOKIE_PATTERNS.some(pattern => c.name.toLowerCase().includes(pattern))
      );
      
      this.isLoggedIn = hasSession;
      eventBus.emit('auth:status', {
        loggedIn: hasSession,
        reason: hasSession ? 'cookies_only' : 'no_session'
      });
      return hasSession;
    } catch (e) {
      Logger.warn('[Auth] API check failed:', e.message);
      
      try {
        const cookies = await apiClient.getAllCookies();
        const hasSession = cookies.some(c =>
          SESSION_COOKIE_PATTERNS.some(pattern => c.name.toLowerCase().includes(pattern))
        );
        
        this.isLoggedIn = hasSession;
        eventBus.emit('auth:status', {
          loggedIn: hasSession,
          reason: hasSession ? 'cookies_only' : 'no_session',
          error: e.message
        });
        return hasSession;
      } catch (cookieErr) {
        Logger.error('[Auth] Cookie check failed:', cookieErr);
        this.isLoggedIn = false;
        eventBus.emit('auth:status', {
          loggedIn: false,
          reason: 'check_failed',
          error: cookieErr.message
        });
        return false;
      }
    }
  }

  /**
   * Get profile image URL from SIMPEG BPS API
   * Uses niplama (NIPLama pegawai) from user info or cookie
   * @returns {Promise<string>} Profile image URL
   */
  async getProfileImage() {
    try {
      // Try to get niplama from user info first
      let niplama = this.userInfo?.niplama || this.userInfo?.nip || null;

      // If not in user info, try to extract from CommunityBPS cookie
      if (!niplama) {
        niplama = await this.getNiplamaFromCookie();
      }

      if (niplama) {
        // SIMPEG avatar URL: https://simpeg.bps.go.id/apis/pegawai/avatar/{niplama}
        return `https://simpeg.bps.go.id/apis/pegawai/avatar/${niplama}`;
      }
    } catch (e) {
      Logger.warn('[Auth] Failed to get profile image from SIMPEG:', e.message);
    }
    // Fallback to local icon
    return 'icons/profile.png';
  }

  /**
   * Extract niplama from CommunityBPS cookie
   * Cookie format: CommunityBPS 3400203602026040519342154228PFBLTMWRITQKHIVCHYNN3699...
   * First 9 digits are the niplama
   * @returns {Promise<string|null>} NIPLama or null
   */
  async getNiplamaFromCookie() {
    return new Promise((resolve) => {
      chrome.cookies.get(
        { url: 'https://community.bps.go.id', name: 'CommunityBPS' },
        (cookie) => {
          if (cookie && cookie.value && cookie.value.length >= 9) {
            // Extract first 9 digits as niplama
            const niplama = cookie.value.substring(0, 9);
            Logger.info('[Auth] Extracted niplama from cookie:', niplama);
            resolve(niplama);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Get user information
   * @param {string|null} surveyPeriodId - Optional survey period ID
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(surveyPeriodId = null) {
    try {
      const params = surveyPeriodId ? { surveyPeriodId } : {};
      const url = apiClient.buildUrl('survey', API_ENDPOINTS.USER_INFO, params);
      const data = await apiClient.get(url, 'Get User Info');
      this.userInfo = data.data;
      return this.userInfo;
    } catch (e) {
      Logger.warn('[Auth] getUserInfo failed:', e.message);
      eventBus.emit('auth:error', { message: e.message });
      return this.userInfo || {};
    }
  }

  /**
   * Get cached user info
   * @returns {Object|null} Cached user info
   */
  getCachedUser() {
    return this.userInfo;
  }

  /**
   * Get authentication status
   * @returns {Object} Authentication status
   */
  getStatus() {
    return { isLoggedIn: this.isLoggedIn, userInfo: this.userInfo };
  }
}

// Export singleton instance
export const authService = new AuthService();