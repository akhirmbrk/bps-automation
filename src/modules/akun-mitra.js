/**
 * BPS Automation v5.1.0 - Akun Mitra Standalone Page
 * Handles Akun Mitra page functionality (load, search, pagination, export)
 */

import { mitraService } from './mitra/mitra-service.js';
import { Logger } from '../core/logger.js';

class AkunMitraPage {
  constructor() {
    this.data = [];
    this.filteredData = [];
    this.page = 1;
    this.perPage = 50;
    this.searchQuery = '';
    this.totalPages = 1;
    this.totalData = 0;
    this.init();
  }

  async init() {
    Logger.info('[AkunMitra] Initializing page...');
    this.bindElements();
    this.bindEvents();
    this.loadTheme();
    this.updateStats();
  }

  bindElements() {
    this.loadBtn = document.getElementById('loadAkunMitraBtn');
    this.csvBtn = document.getElementById('downloadAkunCsvBtn');
    this.excelBtn = document.getElementById('downloadAkunExcelBtn');
    this.searchInput = document.getElementById('akunSearchInput');
    this.loading = document.getElementById('akunLoading');
    this.loadingStatus = document.getElementById('akunLoadingStatus');
    this.tableBody = document.getElementById('akunMitraTableBody');
    this.prevBtn = document.getElementById('prevPageBtn');
    this.nextBtn = document.getElementById('nextPageBtn');
    this.pageInfo = document.getElementById('pageInfo');
    this.themeToggle = document.getElementById('themeToggle');
  }

  bindEvents() {
    this.loadBtn.addEventListener('click', () => this.loadData());
    this.csvBtn.addEventListener('click', () => this.exportCSV());
    this.excelBtn.addEventListener('click', () => this.exportExcel());
    this.prevBtn.addEventListener('click', () => this.prevPage());
    this.nextBtn.addEventListener('click', () => this.nextPage());

    // Live search with debounce
    let searchTimeout;
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      this.searchQuery = e.target.value.toLowerCase();
      searchTimeout = setTimeout(() => {
        this.filterData();
        this.renderTable();
        this.updatePagination();
      }, 300);
    });

    // Theme toggle
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  loadTheme() {
    const saved = localStorage.getItem('bps-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      this.updateThemeIcon(true);
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bps-theme', isDark ? 'dark' : 'light');
    this.updateThemeIcon(isDark);
  }

  updateThemeIcon(isDark) {
    const sun = this.themeToggle?.querySelector('.icon-sun');
    const moon = this.themeToggle?.querySelector('.icon-moon');
    if (sun) sun.style.display = isDark ? 'none' : 'block';
    if (moon) moon.style.display = isDark ? 'block' : 'none';
  }

  async loadData() {
    this.setLoading(true);
    this.updateLoadingStatus('Memuat data...');

    try {
      const result = await mitraService.getAkunMitra(
        this.page,
        this.perPage,
        this.searchQuery,
        'username',
        'asc'
      );

      this.data = result || [];
      this.filteredData = [...this.data];

      // Estimate total from API response (if pagination info available)
      this.totalData = this.data.length;
      this.totalPages = Math.ceil(this.totalData / this.perPage) || 1;

      this.renderTable();
      this.updatePagination();
      this.updateExportButtons();
      this.updateStats();

      Logger.info(`[AkunMitra] Loaded ${this.data.length} records`);
    } catch (err) {
      Logger.error('[AkunMitra] Failed to load data:', err.message);
      this.tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Gagal memuat data: ${err.message}</td></tr>`;
    } finally {
      this.setLoading(false);
    }
  }

  filterData() {
    if (!this.searchQuery) {
      this.filteredData = [...this.data];
      return;
    }
    this.filteredData = this.data.filter(item => {
      const search = this.searchQuery;
      return (
        (item.username || '').toLowerCase().includes(search) ||
        (item.nama_lengkap || '').toLowerCase().includes(search) ||
        (item.email || '').toLowerCase().includes(search) ||
        (item.nik || '').toLowerCase().includes(search)
      );
    });
  }

  renderTable() {
    if (!this.filteredData || this.filteredData.length === 0) {
      this.tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada data ditemukan</td></tr>`;
      return;
    }

    this.tableBody.innerHTML = this.filteredData.map(item => `
      <tr>
        <td>${this.escapeHtml(item.username || '-')}</td>
        <td>${this.escapeHtml(item.email || '-')}</td>
        <td>${this.escapeHtml(item.nama_lengkap || '-')}</td>
        <td>${this.escapeHtml(item.nik || '-')}</td>
        <td>${item.status === '1' ? '<span style="color:var(--success);font-weight:600;">Aktif</span>' : '<span style="color:var(--danger);font-weight:600;">Nonaktif</span>'}</td>
        <td>${item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
      </tr>
    `).join('');
  }

  updatePagination() {
    const hasPrev = this.page > 1;
    const hasNext = this.page < this.totalPages;

    this.prevBtn.disabled = !hasPrev;
    this.nextBtn.disabled = !hasNext;
    this.pageInfo.textContent = `Page ${this.page} of ${this.totalPages}`;
  }

  prevPage() {
    if (this.page > 1) {
      this.page--;
      this.loadData();
    }
  }

  nextPage() {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadData();
    }
  }

  updateExportButtons() {
    const hasData = this.filteredData && this.filteredData.length > 0;
    this.csvBtn.disabled = !hasData;
    this.excelBtn.disabled = !hasData;
  }

  updateStats() {
    // Could update floating status if needed
  }

  setLoading(loading) {
    this.loadBtn.disabled = loading;
    this.loading.style.display = loading ? 'block' : 'none';
  }

  updateLoadingStatus(text) {
    if (this.loadingStatus) {
      this.loadingStatus.textContent = text;
    }
  }

  exportCSV() {
    if (!this.filteredData || this.filteredData.length === 0) return;
    mitraService.exportAkunToCSV(this.filteredData, 'akun_mitra');
  }

  exportExcel() {
    if (!this.filteredData || this.filteredData.length === 0) return;
    if (!window.XLSX) {
      Logger.error('[AkunMitra] XLSX library not loaded');
      return;
    }
    mitraService.exportAkunToExcel(this.filteredData, 'akun_mitra');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AkunMitraPage();
});