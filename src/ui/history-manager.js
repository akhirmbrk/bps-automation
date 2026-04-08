/**
 * BPS Automation - History Manager
 * Handles scraping history rendering, countdowns, and export
 */

import { HistoryCache } from '../storage/history-cache.js';
import { ExporterService } from '../modules/exporter/index.js';
import { utils } from '../core/utils.js';
import { HISTORY_CONFIG } from '../constants.js';

/** Escape HTML to prevent XSS */
function esc(val) {
  if (val == null) return '-';
  return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class HistoryManager {
  /**
   * @param {App} app
   */
  constructor(app) {
    this.app = app;
    this.interval = null;
  }

  get elements() { return this.app.elements; }
  get log() { return this.app.log.bind(this.app); }
  get stats() { return this.app.updateStats.bind(this.app); }

  render() {
    const list = this.elements.historyList;
    if (!list) return;
    const allHistory = HistoryCache.getAll();
    if (allHistory.length === 0) {
      list.innerHTML = '<p class="text-center text-muted">Belum ada riwayat scraping.</p>';
      this.stopCountdown();
      return;
    }
    list.innerHTML = allHistory.map(h => {
      const isExpired = (Date.now() - h.timestamp) > HISTORY_CONFIG.TTL_MS;
      const sizeStr = h.fileSize ? utils.formatBytes(h.fileSize) : '-';
      return `
        <div class="history-item">
          <div class="history-info">
            <strong>${esc(h.survey)}</strong>
            <small>${esc(h.date)} | Mode: ${esc(h.mode)} | ${h.records} records | ${sizeStr}</small>
            <span class="history-countdown ${isExpired ? 'expired' : ''}" data-timestamp="${h.timestamp}">
              ${isExpired ? 'File kadaluwarsa' : 'File kadaluwarsa dalam ' + this.getRemainingTime(h.timestamp)}
            </span>
          </div>
          <div class="history-actions">
            <button class="btn btn-success btn-sm ${isExpired ? 'expired' : ''}" data-id="${esc(h.id)}" data-type="csv" ${isExpired ? 'disabled' : ''}>CSV</button>
            <button class="btn btn-info btn-sm ${isExpired ? 'expired' : ''}" data-id="${esc(h.id)}" data-type="excel" ${isExpired ? 'disabled' : ''}>Excel</button>
          </div>
        </div>
      `;
    }).join('');
    this.startCountdown();
    list.querySelectorAll('.history-actions .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        const cached = HistoryCache.get(id);
        if (cached?.data?.length > 0) {
          const exporter = type === 'csv' ? ExporterService.exportToCSV : ExporterService.exportToExcel;
          exporter(cached.data, cached.survey, cached.mode);
        }
      });
    });
  }

  getRemainingTime(timestamp) {
    const remaining = (timestamp + HISTORY_CONFIG.TTL_MS) - Date.now();
    if (remaining <= 0) return '00:00';
    return `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;
  }

  startCountdown() {
    this.stopCountdown();
    this.interval = setInterval(() => this.updateCountdowns(), 1000);
  }

  stopCountdown() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  updateCountdowns() {
    document.querySelectorAll('.history-countdown').forEach(el => {
      const ts = parseInt(el.getAttribute('data-timestamp'));
      const remaining = this.getRemainingTime(ts);
      const isExpired = remaining === '00:00';
      el.textContent = isExpired ? 'File kadaluwarsa' : 'File kadaluwarsa dalam ' + remaining;
      el.classList.toggle('expired', isExpired);
      const item = el.closest('.history-item');
      if (item) {
        item.querySelectorAll('.history-actions .btn').forEach(btn => {
          btn.disabled = isExpired;
          btn.classList.toggle('expired', isExpired);
        });
      }
    });
  }

  clear() {
    const count = HistoryCache.clearAll();
    this.render();
    this.stats();
    this.log(`🗑️ ${count} riwayat scraped dihapus`, 'success');
  }
}

export { HistoryManager };