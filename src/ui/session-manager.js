/**
 * BPS Automation - Session Manager
 * Handles session checks, JWT management, and toast notifications
 */

import { Logger } from '../core/logger.js';
import { authService } from '../modules/auth/index.js';
import { mitraService } from '../modules/mitra/index.js';

class SessionManager {
  /**
   * @param {App} app
   */
  constructor(app) {
    this.app = app;
  }

  get elements() { return this.app.elements; }
  get log() { return this.app.log.bind(this.app); }

  async checkAllSessions() {
    const checks = {
      fasih: {
        name: 'FASIH',
        url: 'https://fasih-sm.bps.go.id',
        icon: '📊',
        check: async () => {
          // Use cached login state from init() instead of re-calling API
          if (authService.isLoggedIn) return true;
          try { return await authService.checkLogin(); } catch { return false; }
        },
        statusText: (ok) => ok ? 'Login aktif' : 'Belum login',
        statusClass: (ok) => ok ? 'success' : 'error'
      },
      mitra: {
        name: 'Manajemen Mitra',
        url: 'https://manajemen-mitra.bps.go.id',
        icon: '👥',
        check: async () => {
          const jwt = await mitraService.getJwtToken();
          return !!jwt;
        },
        statusText: (ok) => ok ? 'JWT valid' : 'Belum login',
        statusClass: (ok) => ok ? 'success' : 'error'
      },
      community: {
        name: 'Community BPS',
        url: 'https://community.bps.go.id',
        icon: '🌐',
        check: async () => new Promise((resolve) => {
          chrome.cookies.get({ url: 'https://community.bps.go.id', name: 'CommunityBPS' }, (cookie) => {
            resolve(!!cookie && cookie.value && cookie.value.length > 10);
          });
        }),
        statusText: (ok) => ok ? 'Cookie valid' : 'Cookie tidak ditemukan',
        statusClass: (ok) => ok ? 'success' : 'warning'
      },
      simpeg: {
        name: 'SIMPEG Profile',
        url: 'https://simpeg.bps.go.id',
        icon: '🏢',
        check: async () => {
          const avatar = this.elements.userAvatarSidebar;
          return avatar && avatar.src && !avatar.src.includes('profile.png') && !avatar.src.includes('icon128');
        },
        statusText: (ok) => ok ? 'Foto terload' : 'Foto tidak terload',
        statusClass: (ok) => ok ? 'success' : 'warning'
      },
      niplama: {
        name: 'NIP/NIP Lama',
        url: null,
        icon: '🔢',
        check: async () => new Promise((resolve) => {
          chrome.cookies.get({ url: 'https://community.bps.go.id', name: 'CommunityBPS' }, (cookie) => {
            if (cookie && cookie.value) resolve(/^\d{9}$/.test(cookie.value.substring(0, 9)));
            else resolve(false);
          });
        }),
        statusText: (ok) => ok ? 'NIP ditemukan' : 'NIP tidak ditemukan',
        statusClass: (ok) => ok ? 'success' : 'warning'
      }
    };
    this.showLoadingToast();
    const results = {};
    await Promise.all(Object.entries(checks).map(async ([key, check]) => {
      try { results[key] = await check.check(); } catch { results[key] = false; }
    }));
    this.showResultsToast(checks, results);
  }

  showLoadingToast() {
    const toast = document.getElementById('sessionToast');
    const content = document.getElementById('sessionToastContent');
    const header = toast?.querySelector('.session-toast-header');
    if (!toast || !content || !header) return;
    header.className = 'session-toast-header';
    header.querySelector('span').textContent = '⏳ Memeriksa Session...';
    content.innerHTML = `
      <div class="session-toast-loading">
        <div class="session-toast-spinner"></div>
        <span class="session-toast-loading-text">Sedang memeriksa status login...</span>
      </div>
    `;
    toast.classList.add('active');
  }

  showResultsToast(checks, results) {
    const toast = document.getElementById('sessionToast');
    const content = document.getElementById('sessionToastContent');
    const header = toast?.querySelector('.session-toast-header');
    if (!toast || !content || !header) return;
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    const allActive = successCount === totalCount;
    header.className = 'session-toast-header ' + (allActive ? 'success' : 'warning');
    header.querySelector('span').textContent = allActive
      ? `✅ ${successCount}/${totalCount} Semua Session Aktif`
      : `⚠️ ${totalCount - successCount}/${totalCount} Session Perlu Perhatian`;
    content.innerHTML = `
      <div class="session-toast-message" style="max-height:250px; overflow-y:auto;">
        ${Object.entries(checks).map(([key, check]) => {
          const isOk = results[key];
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.1rem;">${check.icon}</span>
                <div>
                  <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${check.name}</div>
                  <div style="font-size:0.75rem; color:var(--text-secondary);">${check.statusText(isOk)}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.9rem; color:${isOk ? 'var(--success)' : 'var(--danger)'};">${isOk ? '✅' : '❌'}</span>
                ${!isOk && check.url ? `<a href="${check.url}" target="_blank" style="font-size:0.75rem; color:var(--primary); text-decoration:none; font-weight:500;">Buka →</a>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    const autoDismiss = setTimeout(() => toast.classList.remove('active'), 10000);
    document.getElementById('sessionToastClose')?.addEventListener('click', () => {
      clearTimeout(autoDismiss);
      toast.classList.remove('active');
    }, { once: true });
  }

  async saveJwtToken() {
    const tokenInput = this.elements.mitraJwtTokenInput?.value?.trim();
    if (!tokenInput) {
      this.log('⚠️ Token kosong, paste JWT token terlebih dahulu', 'warning');
      return;
    }
    if (!tokenInput.startsWith('eyJ')) {
      this.log('⚠️ Format token tidak valid (harus dimulai dengan eyJ)', 'warning');
      return;
    }
    try {
      const parts = tokenInput.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        this.log(`⚠️ Token sudah expired (exp: ${new Date(payload.exp * 1000).toLocaleString()})`, 'warning');
        return;
      }
      await mitraService.storeJwtManually(tokenInput);
      this.log(`✅ JWT token disimpan (exp: ${new Date(payload.exp * 1000).toLocaleString()})`, 'success');
      this.updateJwtStatus('✅ Token valid tersimpan', 'success');
    } catch (err) {
      this.log(`❌ Error: ${err.message}`, 'error');
      this.updateJwtStatus('❌ Token tidak valid', 'error');
    }
  }

  async clearJwtToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'clearJwtToken' }, () => {
        mitraService.cachedJwtToken = null;
        if (this.elements.mitraJwtTokenInput) this.elements.mitraJwtTokenInput.value = '';
        this.updateJwtStatus('🗑️ Token dihapus', 'info');
        this.log('🗑️ JWT token dihapus', 'info');
        resolve();
      });
    });
  }

  updateJwtStatus(message, type = 'info') {
    const el = this.elements.jwtStatus;
    if (!el) return;
    const colors = { success: 'var(--success-color, #4caf50)', error: 'var(--error-color, #f44336)', warning: 'var(--warning-color, #ff9800)', info: 'var(--text-secondary, #666)' };
    el.textContent = message;
    el.style.color = colors[type] || colors.info;
  }

  async checkJwtStatus() {
    const token = await mitraService.getJwtToken();
    if (token) {
      if (this.elements.mitraJwtTokenInput) this.elements.mitraJwtTokenInput.value = token;
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        const expDate = new Date(payload.exp * 1000);
        const isExpired = payload.exp && payload.exp < Math.floor(Date.now() / 1000);
        this.updateJwtStatus(
          isExpired ? `⚠️ Token expired (${expDate.toLocaleString()})` : `✅ Token valid (exp: ${expDate.toLocaleString()})`,
          isExpired ? 'warning' : 'success'
        );
      } catch { this.updateJwtStatus('✅ Token tersimpan', 'success'); }
    } else {
      this.updateJwtStatus('Belum ada token. Buka manajemen-mitra.bps.go.id atau paste manual.', 'info');
    }
  }
}

export { SessionManager };