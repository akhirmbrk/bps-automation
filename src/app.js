/**
 * BPS Automation v5.1.0 - Main Application
 * Refactored with modular architecture and best practices
 */

import { config } from './core/config.js';
import { eventBus } from './core/event-bus.js';
import { Logger } from './core/logger.js';
import { utils } from './core/utils.js';
import { authService } from './modules/auth/index.js';
import { surveyService } from './modules/surveys/index.js';
import { scraperService } from './modules/scraper/index.js';
import { ExporterService } from './modules/exporter/index.js';
import { allocationService } from './modules/allocation/index.js';
import { mitraService } from './modules/mitra/index.js';
import { HistoryCache } from './storage/history-cache.js';
import { MitraManager } from './ui/mitra-manager.js';
import { HistoryManager } from './ui/history-manager.js';
import { SessionManager } from './ui/session-manager.js';
import { PAGES, PAGE_TITLES, STORAGE_KEYS, SURVEY_ROLES, ALLOCATION_TEMPLATE_DATA } from './constants.js';

class App {
  constructor() {
    this.currentPage = PAGES.DASHBOARD;
    this.isDarkMode = false;
    this.isLogVisible = true;
    this.elements = {};
    this.selectedMode = 'basic';
    this.scrapeStartTime = null;
    this.totalDesaCount = 0;
    this.processedDesaCount = 0;
    this.elapsedMs = 0;
    this.estimatedTotalMs = 0;
    this.estimatedInterval = null;
    this.historyInterval = null;
    // Managers (delegated)
    this.mitraManager = new MitraManager(this);
    this.historyManager = new HistoryManager(this);
    this.sessionManager = new SessionManager(this);
    // Shared state
    this.mitraKepkaData = [];
    this.mitraKepkaDetailData = [];
    this.mitraScrapData = [];
    this.seleksiData = [];
    this.akunMitraPage = 1;
    this.selectedMitraId = null;
    this.mitraSurveiList = [];
    this.mitraKegiatanList = [];
    this.seleksiSurveiList = [];
    this.seleksiKegiatanList = [];
    this.akunMitraAllData = [];
    this.searchDebounceTimer = null;
  }

  async init() {
    Logger.info('[App] Initializing BPS Automation v5.1.0...');
    this.showLoading();
    this.updateLoadingStep('init');
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.api && !parsed.api.modules) {
          Logger.info('[App] Clearing old config without modules...');
          localStorage.removeItem(STORAGE_KEYS.CONFIG);
          config.reset();
        }
      }
    } catch (e) { Logger.warn('[App] Migration check failed:', e.message); }
    await utils.waitForDOM();
    this.cacheElements();
    this.setupEventListeners();
    this.setupModuleEventListeners();
    this.loadPreferences();
    this.updateLoadingStep('auth');
    const loggedIn = await authService.checkLogin();
    if (loggedIn) {
      this.updateLoadingStep('surveys');
      await surveyService.loadSurveys();
    } else { Logger.warn('[App] Not logged in. Please login to FASIH first.'); }
    HistoryCache.clearExpired();
    this.renderHistory();
    this.updateStats();
    setTimeout(() => this.checkAllSessions(), 1500);
    this.hideLoading();
    Logger.info('[App] Initialization complete');
    setTimeout(() => this.loadAllProvinsiDropdowns(), 500);
    setTimeout(() => this.checkJwtStatus(), 1000);
  }

  async loadAllProvinsiDropdowns() {
    try {
      let regionId = authService.userInfo?.regionId?.[0] || null;
      if (regionId && regionId.length >= 4) {
        this.mitraManager.kdProv = regionId.substring(0, 2);
        this.mitraManager.kdKab = regionId.substring(2, 4);
        Logger.info(`[App] Wilayah extracted from myinfo regionId: ${regionId}`);
      }
      const provinsi = await mitraService.getProvinsi();
      if (provinsi.length === 0) return;
      if (!regionId && provinsi.length > 0) {
        this.mitraManager.kdProv = provinsi[0].kd_prov || provinsi[0].id || '64';
      }
      Logger.info(`[App] ${provinsi.length} provinsi loaded`);
    } catch (err) { Logger.warn('[App] Failed to load provinsi dropdowns:', err.message); }
  }

  showLoading() { if (this.elements.floatingStatusCard) this.elements.floatingStatusCard.style.display = 'block'; }
  hideLoading() { if (this.elements.floatingStatusCard) setTimeout(() => { this.elements.floatingStatusCard.style.display = 'none'; }, 3000); }

  updateLoadingStep(step) {
    const stepIcons = { init: '⚙️', auth: '🔐', surveys: '📊' };
    const stepNames = { init: 'Initializing...', auth: 'Checking Login...', surveys: 'Loading Data...' };
    const stepOrder = ['init', 'auth', 'surveys'];
    const idx = stepOrder.indexOf(step);
    stepOrder.forEach((s, i) => {
      const el = document.getElementById(`step-${s}`);
      if (!el) return;
      if (i < idx) { el.classList.add('success'); el.querySelector('.floating-status-icon').textContent = '✅'; }
      else if (i === idx) { el.classList.remove('success'); el.querySelector('.floating-status-icon').textContent = stepIcons[s] || '⏳'; el.querySelector('.floating-status-name').textContent = stepNames[s]; }
    });
    if (this.elements.floatingStatusTitle) this.elements.floatingStatusTitle.textContent = `${stepIcons[step] || '📡'} ${stepNames[step] || 'Loading...'}`;
  }

  cacheElements() {
    const ids = ['pageTitle','sidebar','sidebarToggle','sidebarOverlay','themeToggle','reloadSessionBtn','userFullnameSidebar','userRoleSidebar','userAvatarSidebar','surveySelect','startBtn','stopBtn','downloadCsvBtn','downloadExcelBtn','logTerminal','progressBar','progressText','progressStats','statSurveys','statRecords','statTime','statHistory','historyList','clearHistoryBtn','apiBaseUrl','rateLimit','detailRateLimit','batchSize','maxPagination','saveSettingsBtn','resetSettingsBtn','loadingModal','loadingModalTitle','loadingModalText','clearLogBtn','copyLogBtn','toggleLogBtn','uploadArea','allocationFileInput','allocationConfig','allocationSurveySelect','allocationPeriodSelect','allocationRoleSelect','allocationOverwrite','allocationDirectAssign','allocationRateLimit','previewTableBody','previewCount','allocateBtn','clearAllocationBtn','downloadTemplateBtn','allocationLog','allocationProgressBar','allocationProgressText','allocationTerminal','mitraTahunSelect','loadMitraKepkaBtn','downloadMitraCsvBtn','downloadMitraExcelBtn','mitraKepkaTableBody','mitraHistoryTableBody','statMitraTotal','statMitraDiterima','statMitraSurvei','statMitraTahun','mitraSurveySelect','mitraKegiatanSelect','mitraStatusKegiatanSelect','loadMitraDataBtn','downloadMitraScrapCsvBtn','downloadMitraScrapExcelBtn','mitraScrapTableBody','mitraScrapStats','seleksiSurveiSelect','seleksiKegiatanSelect','seleksiStatusKegiatanSelect','loadSeleksiBtn','seleksiTableBody','seleksiStats','akunMitraTableBody','prevPageBtn','nextPageBtn','pageInfo','akunSearchInput','akunLoading','akunLoadingStatus','downloadAllDetailCsvBtn','downloadAllDetailExcelBtn','detailProgress','detailProgressText','detailProgressPercent','detailProgressBar','detailProgressBarText','mitraApiBaseUrl','mitraPenggunaApiBaseUrl','mitraJwtTokenInput','jwtStatus','saveJwtBtn','clearJwtBtn','mitraDetailModal','mitraDetailBody','floatingStatusCard','floatingStatusItems','floatingStatusClose','floatingStatusTitle'];
    ids.forEach(id => { this.elements[id] = document.getElementById(id); });
    this.elements.navItems = document.querySelectorAll('.nav-item');
    this.elements.pages = document.querySelectorAll('.page');
    this.elements.modeBtns = document.querySelectorAll('.mode-btn');
    this.elements.mitraModeBtns = document.querySelectorAll('[data-mitra-mode]');
  }

  setupEventListeners() {
    this.elements.navItems?.forEach(item => { item.addEventListener('click', (e) => { e.preventDefault(); this.switchPage(item.dataset.page); }); });
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    this.elements.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
    this.elements.sidebarOverlay?.addEventListener('click', () => this.closeMobileSidebar());
    document.getElementById('checkSessionBtn')?.addEventListener('click', () => this.checkAllSessions());
    this.elements.reloadSessionBtn?.addEventListener('click', () => this.reloadSession());
    this.elements.modeBtns?.forEach(btn => { btn.addEventListener('click', () => { this.elements.modeBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); this.selectedMode = btn.dataset.mode; }); });
    this.elements.startBtn?.addEventListener('click', () => this.startScraping());
    this.elements.stopBtn?.addEventListener('click', () => this.stopScraping());
    this.elements.downloadCsvBtn?.addEventListener('click', () => this.downloadCSV());
    this.elements.downloadExcelBtn?.addEventListener('click', () => this.downloadExcel());
    this.elements.clearLogBtn?.addEventListener('click', () => this.clearLog());
    this.elements.copyLogBtn?.addEventListener('click', () => this.copyLog());
    this.elements.toggleLogBtn?.addEventListener('click', () => this.toggleLog());
    this.elements.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    this.elements.resetSettingsBtn?.addEventListener('click', () => this.resetSettings());
    this.elements.saveJwtBtn?.addEventListener('click', () => this.saveJwtToken());
    this.elements.clearJwtBtn?.addEventListener('click', () => this.clearJwtToken());
    this.elements.clearHistoryBtn?.addEventListener('click', () => this.clearHistory());
    this.elements.downloadTemplateBtn?.addEventListener('click', () => this.downloadTemplate());
    if (this.elements.uploadArea) {
      this.elements.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); this.elements.uploadArea.classList.add('drag-over'); });
      this.elements.uploadArea.addEventListener('dragleave', () => { this.elements.uploadArea.classList.remove('drag-over'); });
      this.elements.uploadArea.addEventListener('drop', async (e) => { e.preventDefault(); this.elements.uploadArea.classList.remove('drag-over'); if (e.dataTransfer.files[0]) await this.handleAllocationFile(e.dataTransfer.files[0]); });
    }
    this.elements.allocationFileInput?.addEventListener('change', async (e) => { if (e.target.files[0]) await this.handleAllocationFile(e.target.files[0]); });
    this.elements.clearAllocationBtn?.addEventListener('click', () => this.clearAllocation());
    this.elements.allocateBtn?.addEventListener('click', () => this.startAllocation());
    this.elements.allocationSurveySelect?.addEventListener('change', async (e) => { if (e.target.value) await this.loadAllocationPeriods(e.target.value); });
    this.elements.loadMitraKepkaBtn?.addEventListener('click', () => this.loadMitraKepka());
    this.elements.downloadMitraCsvBtn?.addEventListener('click', () => this.downloadMitraKepkaCSV());
    this.elements.downloadMitraExcelBtn?.addEventListener('click', () => this.downloadMitraKepkaExcel());
    this.elements.downloadAllDetailCsvBtn?.addEventListener('click', () => this.downloadAllMitraDetailCSV());
    this.elements.downloadAllDetailExcelBtn?.addEventListener('click', () => this.downloadAllMitraDetailExcel());
    this.elements.loadMitraDataBtn?.addEventListener('click', () => this.loadMitraScrapData());
    this.elements.downloadMitraScrapCsvBtn?.addEventListener('click', () => this.downloadMitraScrapCSV());
    this.elements.downloadMitraScrapExcelBtn?.addEventListener('click', () => this.downloadMitraScrapExcel());
    this.elements.mitraSurveySelect?.addEventListener('change', async (e) => { if (e.target.value) await this.loadMitraKegiatan(e.target.value); });
    this.elements.loadSeleksiBtn?.addEventListener('click', () => this.loadSeleksiData());
    this.elements.seleksiSurveiSelect?.addEventListener('change', async (e) => { if (e.target.value) await this.loadSeleksiKegiatan(e.target.value); });
    this.elements.seleksiStatusKegiatanSelect?.addEventListener('change', async (e) => { const v = this.elements.seleksiSurveiSelect?.value; if (v) await this.loadSeleksiKegiatan(v); });
    this.elements.prevPageBtn?.addEventListener('click', () => this.prevAkunMitraPage());
    this.elements.nextPageBtn?.addEventListener('click', () => this.nextAkunMitraPage());
    this.elements.downloadAkunCsvBtn?.addEventListener('click', () => this.downloadAkunMitraCSV());
    this.elements.downloadAkunExcelBtn?.addEventListener('click', () => this.downloadAkunMitraExcel());
    this.elements.akunSearchInput?.addEventListener('input', (e) => { clearTimeout(this.searchDebounceTimer); this.searchDebounceTimer = setTimeout(() => this.filterAkunMitra(e.target.value), 300); });
    document.getElementById('mitraKepkaSearch')?.addEventListener('input', (e) => this.filterMitraKepka(e.target.value));
    this.elements.floatingStatusClose?.addEventListener('click', () => this.closeFloatingStatusCard());
    document.querySelector('.detail-modal-close')?.addEventListener('click', () => this.closeMitraDetailModal());
    document.getElementById('mitraDetailModal')?.addEventListener('click', (e) => { if (e.target.id === 'mitraDetailModal') this.closeMitraDetailModal(); });
  }

  setupModuleEventListeners() {
    eventBus.on('auth:status', (d) => this.handleAuthStatus(d));
    eventBus.on('surveys:loaded', (d) => this.handleSurveysLoaded(d));
    eventBus.on('scraper:start', () => this.handleScraperStart());
    eventBus.on('scraper:progress', (d) => this.handleScraperProgress(d));
    eventBus.on('scraper:timer', (d) => this.handleScraperTimer(d));
    eventBus.on('scraper:kecamatan', (d) => this.handleScraperKecamatan(d));
    eventBus.on('scraper:desa', (d) => this.handleScraperDesa(d));
    eventBus.on('scraper:complete', (d) => this.handleScraperComplete(d));
    eventBus.on('scraper:error', (d) => this.handleScraperError(d));
    eventBus.on('exporter:success', (d) => this.log(`✅ Tersimpan: ${d.filename}`, 'success'));
    eventBus.on('allocation:progress', (d) => this.handleAllocationProgress(d));
    eventBus.on('allocation:row_success', (d) => this.handleAllocationRowSuccess(d));
    eventBus.on('allocation:row_error', (d) => this.handleAllocationRowError(d));
    eventBus.on('allocation:complete', (d) => this.handleAllocationComplete(d));
    eventBus.on('allocation:error', (d) => this.handleAllocationError(d));
    eventBus.on('mitra:kepka_loaded', (d) => this.handleMitraKepkaLoaded(d));
    eventBus.on('mitra:scrap_loaded', (d) => this.handleMitraScrapLoaded(d));
    eventBus.on('mitra:akun_loaded', (d) => this.handleAkunMitraLoaded(d));
    eventBus.on('mitra:error', (d) => this.handleMitraError(d));
  }

  switchPage(pageName) {
    this.elements.pages?.forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageName}`)?.classList.add('active');
    this.elements.navItems?.forEach(item => { item.classList.toggle('active', item.dataset.page === pageName); });
    if (this.elements.pageTitle) this.elements.pageTitle.textContent = PAGE_TITLES[pageName] || pageName;
    this.currentPage = pageName;
    if (pageName === 'settings') this.checkJwtStatus();
    if (pageName === 'akun-mitra') this.loadAllAkunMitraAuto();
    if (pageName === 'scrapping-mitra' || pageName === 'seleksi-mitra') { if (this.elements.mitraSurveySelect?.options.length <= 1) this.loadMitraSurveiList(); }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem(STORAGE_KEYS.THEME, this.isDarkMode ? 'dark' : 'light');
    const sun = this.elements.themeToggle?.querySelector('.icon-sun');
    const moon = this.elements.themeToggle?.querySelector('.icon-moon');
    if (sun && moon) { sun.style.display = this.isDarkMode ? 'none' : 'block'; moon.style.display = this.isDarkMode ? 'block' : 'none'; }
  }

  toggleSidebar() {
    if (!this.elements.sidebar) return;
    if (window.innerWidth <= 768) { this.elements.sidebar.classList.toggle('mobile-open'); this.elements.sidebarOverlay?.classList.toggle('active', this.elements.sidebar.classList.contains('mobile-open')); }
    else { this.elements.sidebar.classList.toggle('collapsed'); localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, this.elements.sidebar.classList.contains('collapsed')); }
  }

  closeMobileSidebar() { this.elements.sidebar?.classList.remove('mobile-open'); this.elements.sidebarOverlay?.classList.remove('active'); }

  async reloadSession() {
    this.log('🔄 Reloading session...', 'info');
    this.showLoadingModal('Reloading Session...', 'Memeriksa status login');
    const loggedIn = await authService.checkLogin();
    this.hideLoadingModal();
    if (loggedIn) { await surveyService.loadSurveys(); this.log('✅ Session reloaded successfully', 'success'); }
    else this.log('⚠️ Still not logged in. Please login to FASIH first', 'warning');
  }

  handleAuthStatus(data) {
    if (data.loggedIn && data.user) {
      const fullname = data.user.fullname || 'Pengguna';
      const role = data.user.surveyRole?.description || (data.user.roleRealm && data.user.roleRealm[0]) || 'Pegawai';
      const avatarUrl = data.user.avatarUrl || 'icons/icon128.png';
      if (this.elements.userFullnameSidebar) this.elements.userFullnameSidebar.textContent = fullname;
      if (this.elements.userRoleSidebar) this.elements.userRoleSidebar.textContent = role;
      if (this.elements.userAvatarSidebar) this.elements.userAvatarSidebar.src = avatarUrl;
    }
  }

  handleSurveysLoaded(data) { this.populateSurveySelect(data.surveys); this.hideLoadingModal(); this.updateStats(); this.log(`✅ ${data.count} survei dimuat`, 'success'); }

  populateSurveySelect(surveys, targetSelect = null) {
    const select = targetSelect || this.elements.surveySelect;
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Survei --</option>';
    surveys.forEach(s => { const opt = document.createElement('option'); opt.value = JSON.stringify({ id: s.id, name: s.name || s.nama || s.judul, regionGroupId: s.regionGroupId }); opt.textContent = s.name || s.nama || s.judul; select.appendChild(opt); });
  }

  async loadAllocationPeriods(surveyJson) {
    try {
      const survey = JSON.parse(surveyJson);
      const periods = await surveyService.getPeriods(survey.id);
      if (this.elements.allocationPeriodSelect) { this.elements.allocationPeriodSelect.innerHTML = '<option value="">-- Pilih Periode --</option>'; periods.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name || p.periode; this.elements.allocationPeriodSelect.appendChild(opt); }); }
      if (this.elements.allocationRoleSelect) { this.elements.allocationRoleSelect.innerHTML = '<option value="">-- Pilih Role --</option>'; SURVEY_ROLES.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = r.name; this.elements.allocationRoleSelect.appendChild(opt); }); }
    } catch (err) { this.log('❌ Error loading periods: ' + err.message, 'error'); }
  }

  updateStats() {
    const surveysCount = surveyService.getAll().length;
    const recordsCount = scraperService.getTotalRecords();
    const historyCount = HistoryCache.getAll().length;
    if (this.elements.statSurveys) this.elements.statSurveys.textContent = surveysCount;
    if (this.elements.statRecords) this.elements.statRecords.textContent = recordsCount.toLocaleString('id-ID');
    if (this.elements.statHistory) this.elements.statHistory.textContent = historyCount;
  }

  async startScraping() {
    const surveySelect = this.elements.surveySelect?.value;
    if (!surveySelect) { this.log('⚠️ Pilih survei terlebih dahulu!', 'warning'); return; }
    const survey = JSON.parse(surveySelect);
    this.totalDesaCount = 0; this.processedDesaCount = 0; this.elapsedMs = 0; this.estimatedTotalMs = 0;
    if (this.estimatedInterval) clearInterval(this.estimatedInterval);
    if (this.elements.statTime) this.elements.statTime.textContent = '--:--';
    await scraperService.scrape(survey, this.selectedMode);
  }

  stopScraping() { scraperService.stop(); }

  handleScraperStart() { this.log('═══════════════════════════════════════════'); this.log('🚀 Memulai ekstraksi data...'); this.elements.stopBtn.disabled = false; this.elements.startBtn.disabled = true; this.elements.downloadCsvBtn.disabled = true; this.elements.downloadExcelBtn.disabled = true; }
  handleScraperProgress(data) {
    if (data.percent != null) { this.elements.progressBar.style.width = `${data.percent}%`; this.elements.progressText.textContent = `${data.percent}%`; }
    if (data.totalRecords != null) { this.elements.progressStats.textContent = `${data.totalRecords.toLocaleString('id-ID')} baris terkumpul`; this.elements.statRecords.textContent = data.totalRecords.toLocaleString('id-ID'); }
    if (data.totalDesa != null) this.totalDesaCount = data.totalDesa;
    if (data.processedDesa != null) this.processedDesaCount = data.processedDesa;
    if (this.totalDesaCount > 0 && this.processedDesaCount > 0 && this.elapsedMs > 0) this.estimatedTotalMs = this.totalDesaCount * (this.elapsedMs / this.processedDesaCount);
  }
  handleScraperTimer(data) {
    this.elapsedMs = data.elapsed * 1000;
    if (this.totalDesaCount > 0 && this.processedDesaCount > 0 && this.elapsedMs > 0) this.estimatedTotalMs = this.totalDesaCount * (this.elapsedMs / this.processedDesaCount);
    if (this.elements.statTime) { if (this.estimatedTotalMs > 0) { const remainingSec = Math.ceil(Math.max(0, this.estimatedTotalMs - this.elapsedMs) / 1000); this.elements.statTime.textContent = remainingSec > 0 ? utils.formatDuration(remainingSec) : '00:00'; } else this.elements.statTime.textContent = '--:--'; }
  }
  handleScraperKecamatan(data) { this.log('═══════════════════════════════════════════════════════════════════'); this.log(`🗺️ Kecamatan (${data.index}/${data.total}): ${data.name} (${data.desaCount} Desa)`); this.log('═══════════════════════════════════════════════════════════════════'); }
  handleScraperDesa(data) { this.log(`   ➤ ${data.label} (${utils.pad(data.current, 2, ' ')}/${utils.pad(data.total, 2, ' ')}) : Terkumpul ${utils.pad(data.count, 3, ' ')} baris. (ID: ${data.id.substring(0, 8)}...)`, data.count > 0 ? 'success' : 'warning'); }
  handleScraperComplete(data) { const survey = JSON.parse(this.elements.surveySelect?.value || '{}'); this.log('═══════════════════════════════════════════════════════════════════'); this.log(`✅ Selesai: ${data.totalRecords} records terkumpul`, 'success'); this.elements.stopBtn.disabled = true; this.elements.startBtn.disabled = false; this.elements.downloadCsvBtn.disabled = false; this.elements.downloadExcelBtn.disabled = false; if (survey.name) this.addToHistory(survey.name, this.selectedMode, data.totalRecords, data.duration || 0); }
  handleScraperError(data) { this.log(`❌ Error: ${data.message || data}`, 'error'); this.elements.stopBtn.disabled = true; this.elements.startBtn.disabled = false; }
  downloadCSV() { const results = scraperService.getResults(); const survey = JSON.parse(this.elements.surveySelect?.value || '{}'); if (results.length > 0 && survey.name) ExporterService.exportToCSV(results, survey.name, this.selectedMode); }
  downloadExcel() { const results = scraperService.getResults(); const survey = JSON.parse(this.elements.surveySelect?.value || '{}'); if (results.length > 0 && survey.name) ExporterService.exportToExcel(results, survey.name, this.selectedMode); }
  async handleAllocationFile(file) { try { this.log(`📂 Membaca file: ${file.name}`, 'info'); const data = await allocationService.parseExcelFile(file); allocationService.setUploadedData(data); if (this.elements.allocationConfig) this.elements.allocationConfig.style.display = 'block'; if (this.elements.uploadArea) this.elements.uploadArea.style.display = 'none'; if (this.elements.previewCount) this.elements.previewCount.textContent = data.length; if (this.elements.previewTableBody) this.elements.previewTableBody.innerHTML = data.slice(0, 50).map(r => `<tr><td>${r.provinsi}</td><td>${r.kabupaten}</td><td>${r.kecamatan}</td><td>${r.desa}</td><td>${r.sls}</td><td>${r.subsls}</td><td>${r.email}</td></tr>`).join(''); if (this.elements.allocationSurveySelect) this.populateSurveySelect(surveyService.getAll(), this.elements.allocationSurveySelect); if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false; this.log(`✅ ${data.length} baris data berhasil dibaca`, 'success'); } catch (err) { this.log('❌ Error membaca file: ' + err.message, 'error'); } }
  async startAllocation() { const p = this.elements.allocationPeriodSelect?.value; const r = this.elements.allocationRoleSelect?.value; if (!p || !r) { this.log('⚠️ Pilih periode dan role terlebih dahulu', 'warning'); return; } await allocationService.allocateUsers(p, r, { overwrite: this.elements.allocationOverwrite?.checked || false, directAssign: this.elements.allocationDirectAssign?.checked !== false, rateLimit: parseInt(this.elements.allocationRateLimit?.value || 500) }); }
  handleAllocationProgress(data) { if (this.elements.allocationProgressBar) this.elements.allocationProgressBar.style.width = `${data.percent}%`; if (this.elements.allocationProgressText) this.elements.allocationProgressText.textContent = `${data.percent}%`; }
  handleAllocationRowSuccess(data) { this.allocationLog(`✅ [${data.current}/${data.total}] ${data.email} → ${data.region}`, 'success'); }
  handleAllocationRowError(data) { this.allocationLog(`❌ ${data.email} → ${data.error}`, 'error'); }
  handleAllocationComplete(data) { this.allocationLog('═══════════════════════════════════════════', 'info'); this.allocationLog(`✅ Selesai: ${data.success} berhasil, ${data.failed} gagal dari ${data.total} total`, data.failed === 0 ? 'success' : 'warning'); if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false; }
  handleAllocationError(data) { this.allocationLog(`❌ Error: ${data.message}`, 'error'); if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false; }
  downloadTemplate() { const ws = window.XLSX.utils.json_to_sheet(ALLOCATION_TEMPLATE_DATA); const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Template'); window.XLSX.writeFile(wb, 'User_Allocation_Template.xlsx'); this.log('📥 Template downloaded', 'success'); }
  clearAllocation() { allocationService.clearCache(); if (this.elements.allocationConfig) this.elements.allocationConfig.style.display = 'none'; if (this.elements.allocationLog) this.elements.allocationLog.style.display = 'none'; if (this.elements.uploadArea) this.elements.uploadArea.style.display = 'flex'; if (this.elements.allocationFileInput) this.elements.allocationFileInput.value = ''; this.log('🗑️ Allocation data cleared', 'success'); }
  allocationLog(msg, type = 'info') { if (!this.elements.allocationTerminal) return; const ts = new Date().toLocaleTimeString('id-ID'); const cls = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info'; this.elements.allocationTerminal.innerHTML += `<div class="log-line ${cls}"><span class="timestamp">[${ts}]</span> ${msg}</div>`; this.elements.allocationTerminal.scrollTop = this.elements.allocationTerminal.scrollHeight; }

  log(msg, type = 'info') { if (!this.elements.logTerminal) return; const ts = new Date().toLocaleTimeString('id-ID'); const cls = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : type === 'warning' ? 'log-warning' : type === 'request' ? 'log-request' : 'log-info'; this.elements.logTerminal.innerHTML += `<div class="log-line ${cls}"><span class="timestamp">[${ts}]</span> ${msg}</div>`; this.elements.logTerminal.scrollTop = this.elements.logTerminal.scrollHeight; }
  clearLog() { if (this.elements.logTerminal) this.elements.logTerminal.innerHTML = ''; this.log('🗑️ Log cleared', 'info'); }
  async copyLog() { if (this.elements.logTerminal) { try { await navigator.clipboard.writeText(this.elements.logTerminal.innerText); this.log('📋 Log copied to clipboard', 'success'); } catch { this.log('❌ Failed to copy log', 'error'); } } }
  toggleLog() { this.isLogVisible = !this.isLogVisible; this.elements.logTerminal?.classList.toggle('hidden', !this.isLogVisible); if (this.elements.toggleLogBtn) this.elements.toggleLogBtn.textContent = this.isLogVisible ? 'Hide' : 'Show'; }
  showLoadingModal(title = 'Memuat...', text = 'Mohon tunggu sebentar') { if (this.elements.loadingModalTitle) this.elements.loadingModalTitle.textContent = title; if (this.elements.loadingModalText) this.elements.loadingModalText.textContent = text; if (this.elements.loadingModal) this.elements.loadingModal.classList.add('active'); }
  hideLoadingModal() { this.elements.loadingModal?.classList.remove('active'); }
  saveSettings() { config.update({ api: { baseUrl: this.elements.apiBaseUrl?.value || 'https://fasih-sm.bps.go.id' }, scraper: { rateLimitMs: parseInt(this.elements.rateLimit?.value || 300), detailRateLimitMs: parseInt(this.elements.detailRateLimit?.value || 100), batchSize: parseInt(this.elements.batchSize?.value || 100), maxPaginationPages: parseInt(this.elements.maxPagination?.value || 50) } }); this.log('✅ Pengaturan disimpan', 'success'); }
  resetSettings() { config.reset(); this.loadSettings(); this.log('✅ Pengaturan direset ke default', 'success'); }
  loadSettings() { const cfg = config.get(); if (this.elements.apiBaseUrl) this.elements.apiBaseUrl.value = cfg.api.baseUrl; if (this.elements.rateLimit) this.elements.rateLimit.value = cfg.scraper.rateLimitMs; if (this.elements.detailRateLimit) this.elements.detailRateLimit.value = cfg.scraper.detailRateLimitMs; if (this.elements.batchSize) this.elements.batchSize.value = cfg.scraper.batchSize; if (this.elements.maxPagination) this.elements.maxPagination.value = cfg.scraper.maxPaginationPages; }

  addToHistory(surveyName, mode, records, duration) { const id = utils.generateId(); const results = scraperService.getResults(); const jsonStr = JSON.stringify(results); const fileSize = new Blob([jsonStr]).size; const now = new Date(); const date = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`; HistoryCache.save(id, { surveyName, mode, records, fileSize, date, data: results }); this.renderHistory(); this.updateStats(); }

  // ===== Delegate to Managers =====
  renderHistory() { this.historyManager.render(); }
  clearHistory() { this.historyManager.clear(); }
  loadMitraKepka() { this.mitraManager.loadMitraKepka(); }
  renderMitraKepkaTable() { this.mitraManager.renderMitraKepkaTable(); }
  async showMitraDetail(idMitra) { this.mitraManager.showMitraDetail(idMitra); }
  async loadMitraHistory(idMitra) { this.mitraManager.loadMitraHistory(idMitra); }
  downloadMitraKepkaCSV() { this.mitraManager.downloadMitraKepkaCSV(); }
  downloadMitraKepkaExcel() { this.mitraManager.downloadMitraKepkaExcel(); }
  async loadMitraScrapData() { this.mitraManager.loadMitraScrapData(); }
  renderMitraScrapTable() { this.mitraManager.renderMitraScrapTable(); }
  downloadMitraScrapCSV() { this.mitraManager.downloadMitraScrapCSV(); }
  downloadMitraScrapExcel() { this.mitraManager.downloadMitraScrapExcel(); }
  async loadMitraKegiatan(kdSurvei) { this.mitraManager.loadMitraKegiatan(kdSurvei); }
  async loadSeleksiData() { this.mitraManager.loadSeleksiData(); }
  renderSeleksiTable() { this.mitraManager.renderSeleksiTable(); }
  async loadSeleksiKegiatan(kdSurvei) { this.mitraManager.loadSeleksiKegiatan(kdSurvei); }
  async loadAkunMitra() { this.mitraManager.loadAkunMitra(); }
  renderAkunMitraTable() { this.mitraManager.renderAkunMitraTable(); }
  prevAkunMitraPage() { this.mitraManager.prevAkunMitraPage(); }
  nextAkunMitraPage() { this.mitraManager.nextAkunMitraPage(); }
  downloadAkunMitraCSV() { this.mitraManager.downloadAkunMitraCSV(); }
  downloadAkunMitraExcel() { this.mitraManager.downloadAkunMitraExcel(); }
  closeMitraDetailModal() { this.mitraManager.closeMitraDetailModal(); }
  async loadAllAkunMitraAuto() { this.mitraManager.loadAllAkunMitraAuto(); }
  filterAkunMitra(query) { this.mitraManager.filterAkunMitra(query); }
  async downloadAllMitraDetailCSV() { this.mitraManager.downloadAllMitraDetailCSV(); }
  async downloadAllMitraDetailExcel() { this.mitraManager.downloadAllMitraDetailExcel(); }
  async loadMitraSurveiList() { this.mitraManager.loadMitraSurveiList(); }
  updateMitraStats() { this.mitraManager.updateMitraStats(); }
  handleMitraKepkaLoaded(data) { this.mitraManager.handleMitraKepkaLoaded(data); }
  handleMitraScrapLoaded(data) { this.mitraManager.handleMitraScrapLoaded(data); }
  handleAkunMitraLoaded(data) { this.mitraManager.handleAkunMitraLoaded(data); }
  handleMitraError(data) { this.mitraManager.handleMitraError(data); }
  filterMitraKepka(query) { this.mitraManager.filterMitraKepka(query); }
  async checkAllSessions() { this.sessionManager.checkAllSessions(); }
  showSessionLoadingToast() { this.sessionManager.showLoadingToast(); }
  showSessionResultsToast(checks, results) { this.sessionManager.showResultsToast(checks, results); }
  async saveJwtToken() { this.sessionManager.saveJwtToken(); }
  async clearJwtToken() { this.sessionManager.clearJwtToken(); }
  async updateJwtStatus(message, type) { this.sessionManager.updateJwtStatus(message, type); }
  async checkJwtStatus() { this.sessionManager.checkJwtStatus(); }

  closeFloatingStatusCard() { if (this.elements.floatingStatusCard) this.elements.floatingStatusCard.style.display = 'none'; }

  loadPreferences() { const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME); if (savedTheme === 'dark') { this.isDarkMode = true; document.documentElement.classList.add('dark'); const s = this.elements.themeToggle?.querySelector('.icon-sun'); const m = this.elements.themeToggle?.querySelector('.icon-moon'); if (s && m) { s.style.display = 'none'; m.style.display = 'block'; } } const sc = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true'; if (sc && this.elements.sidebar) this.elements.sidebar.classList.add('collapsed'); this.loadSettings(); }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => { Logger.info('[App] DOMContentLoaded fired, initializing app...'); app.init().catch(err => { Logger.error('[App] Initialization error:', err); }); });
export { app };