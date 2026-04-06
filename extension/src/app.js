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
import {
  PAGES,
  PAGE_TITLES,
  STORAGE_KEYS,
  SURVEY_ROLES,
  ALLOCATION_TEMPLATE_DATA
} from './constants.js';

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
    // Mitra state
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
    
    // Show loading overlay
    this.showLoading();
    this.updateLoadingStep('init');
    
    // One-time migration: clear old config that might not have modules
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
    } catch (e) {
      Logger.warn('[App] Migration check failed:', e.message);
    }
    
    await utils.waitForDOM();
    this.cacheElements();
    this.setupEventListeners();
    this.setupModuleEventListeners();
    this.loadPreferences();
    
    // Update step to auth
    this.updateLoadingStep('auth');
    
    const loggedIn = await authService.checkLogin();
    if (loggedIn) {
      // Update step to surveys
      this.updateLoadingStep('surveys');
      await surveyService.loadSurveys();
    } else {
      Logger.warn('[App] Not logged in. Please login to FASIH first.');
    }
    
    HistoryCache.clearExpired();
    this.renderHistory();
    this.updateStats();
    
    // Check sessions and show modern toast
    setTimeout(() => this.checkAllSessions(), 1500);
    
    // Hide loading overlay
    this.hideLoading();
    Logger.info('[App] Initialization complete');
    
    // Load Provinsi dropdowns for all pages that need them
    setTimeout(() => this.loadAllProvinsiDropdowns(), 500);
    
    // Check JWT status after initialization (with slight delay for token to be available)
    setTimeout(() => this.checkJwtStatus(), 1000);
  }

  /**
   * Load provinsi dropdowns and set dynamic wilayah from myinfo API regionId
   * regionId format: "1808" -> prov="18", kab="08"
   */
  async loadAllProvinsiDropdowns() {
    try {
      // Try to extract wilayah from FASIH myinfo API response (authService.userInfo)
      let regionId = authService.userInfo?.regionId?.[0] || null;
      
      if (regionId && regionId.length >= 4) {
        // regionId format: "1808" -> prov="18", kab="08"
        mitraService.kdProv = regionId.substring(0, 2);
        mitraService.kdKab = regionId.substring(2, 4);
        Logger.info(`[App] Wilayah extracted from myinfo regionId: ${regionId} -> kdProv=${mitraService.kdProv}, kdKab=${mitraService.kdKab}`);
      }
      
      // Load provinsi list for dropdown population
      const provinsi = await mitraService.getProvinsi();
      if (provinsi.length === 0) return;
      
      // If no regionId from myinfo, use first provinsi as fallback
      if (!regionId && provinsi.length > 0) {
        mitraService.kdProv = provinsi[0].kd_prov || provinsi[0].id || '64';
        Logger.info(`[App] No regionId found, using default provinsi: kdProv=${mitraService.kdProv}`);
      }
      
      Logger.info(`[App] ${provinsi.length} provinsi loaded, wilayah: ${mitraService.kdProv}/${mitraService.kdKab}`);
    } catch (err) {
      Logger.warn('[App] Failed to load provinsi dropdowns:', err.message);
    }
  }

  /**
   * Show compact floating status card
   */
  showLoading() {
    if (this.elements.floatingStatusCard) {
      this.elements.floatingStatusCard.style.display = 'block';
    }
  }

  /**
   * Hide floating status card after init complete
   */
  hideLoading() {
    if (this.elements.floatingStatusCard) {
      setTimeout(() => {
        this.elements.floatingStatusCard.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Update loading step in floating card
   * @param {string} step - Step name (init, auth, surveys)
   */
  updateLoadingStep(step) {
    const stepIcons = { init: '⚙️', auth: '🔐', surveys: '📊' };
    const stepNames = { init: 'Initializing...', auth: 'Checking Login...', surveys: 'Loading Data...' };
    const stepOrder = ['init', 'auth', 'surveys'];
    const idx = stepOrder.indexOf(step);

    stepOrder.forEach((s, i) => {
      const el = document.getElementById(`step-${s}`);
      if (!el) return;
      if (i < idx) {
        el.classList.add('success');
        el.querySelector('.floating-status-icon').textContent = '✅';
      } else if (i === idx) {
        el.classList.remove('success');
        el.querySelector('.floating-status-icon').textContent = stepIcons[s] || '⏳';
        el.querySelector('.floating-status-name').textContent = stepNames[s];
      }
    });

    if (this.elements.floatingStatusTitle) {
      this.elements.floatingStatusTitle.textContent = `${stepIcons[step] || '📡'} ${stepNames[step] || 'Loading...'}`;
    }
  }

  cacheElements() {
    const ids = [
      'pageTitle', 'sidebar', 'sidebarToggle', 'sidebarOverlay',
      'themeToggle', 'reloadSessionBtn', 'userFullnameSidebar', 'userRoleSidebar',
      'userAvatarSidebar', 'surveySelect', 'startBtn', 'stopBtn',
      'downloadCsvBtn', 'downloadExcelBtn', 'logTerminal', 'progressBar',
      'progressText', 'progressStats', 'statSurveys', 'statRecords',
      'statTime', 'statHistory', 'historyList', 'clearHistoryBtn',
      'apiBaseUrl', 'rateLimit', 'detailRateLimit', 'batchSize',
      'maxPagination', 'saveSettingsBtn', 'resetSettingsBtn',
      'loadingModal', 'loadingModalTitle', 'loadingModalText',
      'clearLogBtn', 'copyLogBtn', 'toggleLogBtn',
      'uploadArea', 'allocationFileInput', 'allocationConfig',
      'allocationSurveySelect', 'allocationPeriodSelect', 'allocationRoleSelect',
      'allocationOverwrite', 'allocationDirectAssign', 'allocationRateLimit',
      'previewTableBody', 'previewCount', 'allocateBtn', 'clearAllocationBtn',
      'downloadTemplateBtn', 'allocationLog', 'allocationProgressBar',
      'allocationProgressText', 'allocationTerminal',
      // Mitra elements
      'userAvatarSidebar',
      'mitraTahunSelect', 'loadMitraKepkaBtn', 'downloadMitraCsvBtn', 'downloadMitraExcelBtn',
      'mitraKepkaTableBody', 'mitraHistoryTableBody',
      'statMitraTotal', 'statMitraDiterima', 'statMitraSurvei', 'statMitraTahun',
      'mitraSurveySelect', 'mitraKegiatanSelect', 'mitraStatusKegiatanSelect',
      'loadMitraDataBtn',
      'downloadMitraScrapCsvBtn', 'downloadMitraScrapExcelBtn', 'mitraScrapTableBody', 'mitraScrapStats',
      'seleksiSurveiSelect', 'seleksiKegiatanSelect', 'seleksiStatusKegiatanSelect',
      'loadSeleksiBtn', 'seleksiTableBody', 'seleksiStats',
      'akunMitraTableBody', 'prevPageBtn', 'nextPageBtn', 'pageInfo',
      'akunSearchInput', 'akunLoading', 'akunLoadingStatus',
      'downloadAllDetailCsvBtn', 'downloadAllDetailExcelBtn', 'detailProgress', 'detailProgressText', 'detailProgressPercent', 'detailProgressBar', 'detailProgressBarText',
      'mitraApiBaseUrl', 'mitraPenggunaApiBaseUrl', 'mitraJwtTokenInput', 'jwtStatus', 'saveJwtBtn', 'clearJwtBtn',
      // Detail modal
      'mitraDetailModal', 'mitraDetailBody',
      // Floating status card
      'floatingStatusCard', 'floatingStatusItems', 'floatingStatusClose', 'floatingStatusTitle'
    ];
    
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    
    this.elements.navItems = document.querySelectorAll('.nav-item');
    this.elements.pages = document.querySelectorAll('.page');
    this.elements.modeBtns = document.querySelectorAll('.mode-btn');
    this.elements.mitraModeBtns = document.querySelectorAll('[data-mitra-mode]');
  }

  setupEventListeners() {
    // Navigation
    this.elements.navItems?.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchPage(item.dataset.page);
      });
    });

    // Theme toggle
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());

    // Sidebar toggle
    this.elements.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
    this.elements.sidebarOverlay?.addEventListener('click', () => this.closeMobileSidebar());

    // Check session button
    document.getElementById('checkSessionBtn')?.addEventListener('click', () => this.checkAllSessions());

    // Reload session
    this.elements.reloadSessionBtn?.addEventListener('click', () => this.reloadSession());

    // Mode buttons
    this.elements.modeBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.dataset.mode;
      });
    });

    // Dashboard actions
    this.elements.startBtn?.addEventListener('click', () => this.startScraping());
    this.elements.stopBtn?.addEventListener('click', () => this.stopScraping());
    this.elements.downloadCsvBtn?.addEventListener('click', () => this.downloadCSV());
    this.elements.downloadExcelBtn?.addEventListener('click', () => this.downloadExcel());

    // Terminal toolbar
    this.elements.clearLogBtn?.addEventListener('click', () => this.clearLog());
    this.elements.copyLogBtn?.addEventListener('click', () => this.copyLog());
    this.elements.toggleLogBtn?.addEventListener('click', () => this.toggleLog());

    // Settings
    this.elements.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    this.elements.resetSettingsBtn?.addEventListener('click', () => this.resetSettings());

    // JWT Token management
    this.elements.saveJwtBtn?.addEventListener('click', () => this.saveJwtToken());
    this.elements.clearJwtBtn?.addEventListener('click', () => this.clearJwtToken());

    // History
    this.elements.clearHistoryBtn?.addEventListener('click', () => this.clearHistory());

    // Allocation
    this.elements.downloadTemplateBtn?.addEventListener('click', () => this.downloadTemplate());
    
    if (this.elements.uploadArea) {
      this.elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.elements.uploadArea.classList.add('drag-over');
      });
      this.elements.uploadArea.addEventListener('dragleave', () => {
        this.elements.uploadArea.classList.remove('drag-over');
      });
      this.elements.uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        this.elements.uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) await this.handleAllocationFile(e.dataTransfer.files[0]);
      });
    }

    this.elements.allocationFileInput?.addEventListener('change', async (e) => {
      if (e.target.files[0]) await this.handleAllocationFile(e.target.files[0]);
    });

    this.elements.clearAllocationBtn?.addEventListener('click', () => this.clearAllocation());
    this.elements.allocateBtn?.addEventListener('click', () => this.startAllocation());

    this.elements.allocationSurveySelect?.addEventListener('change', async (e) => {
      if (e.target.value) await this.loadAllocationPeriods(e.target.value);
    });

    // ===== MITRA EVENT LISTENERS =====
    
    // Dashboard Mitra
    this.elements.loadMitraKepkaBtn?.addEventListener('click', () => this.loadMitraKepka());
    this.elements.downloadMitraCsvBtn?.addEventListener('click', () => this.downloadMitraKepkaCSV());
    this.elements.downloadMitraExcelBtn?.addEventListener('click', () => this.downloadMitraKepkaExcel());
    this.elements.downloadAllDetailCsvBtn?.addEventListener('click', () => this.downloadAllMitraDetailCSV());
    this.elements.downloadAllDetailExcelBtn?.addEventListener('click', () => this.downloadAllMitraDetailExcel());

    // Scrapping Mitra
    this.elements.loadMitraDataBtn?.addEventListener('click', () => this.loadMitraScrapData());
    this.elements.downloadMitraScrapCsvBtn?.addEventListener('click', () => this.downloadMitraScrapCSV());
    this.elements.downloadMitraScrapExcelBtn?.addEventListener('click', () => this.downloadMitraScrapExcel());
    this.elements.mitraSurveySelect?.addEventListener('change', async (e) => {
      if (e.target.value) await this.loadMitraKegiatan(e.target.value);
    });

    // Seleksi Mitra
    this.elements.loadSeleksiBtn?.addEventListener('click', () => this.loadSeleksiData());
    this.elements.seleksiSurveiSelect?.addEventListener('change', async (e) => {
      if (e.target.value) await this.loadSeleksiKegiatan(e.target.value);
    });
    this.elements.seleksiStatusKegiatanSelect?.addEventListener('change', async (e) => {
      const surveiVal = this.elements.seleksiSurveiSelect?.value;
      if (surveiVal) await this.loadSeleksiKegiatan(surveiVal);
    });

    // Akun Mitra
    this.elements.prevPageBtn?.addEventListener('click', () => this.prevAkunMitraPage());
    this.elements.nextPageBtn?.addEventListener('click', () => this.nextAkunMitraPage());
    this.elements.downloadAkunCsvBtn?.addEventListener('click', () => this.downloadAkunMitraCSV());
    this.elements.downloadAkunExcelBtn?.addEventListener('click', () => this.downloadAkunMitraExcel());
    
    // Live search with debounce (300ms)
    this.elements.akunSearchInput?.addEventListener('input', (e) => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => this.filterAkunMitra(e.target.value), 300);
    });

    // Mitra KEPKA search
    document.getElementById('mitraKepkaSearch')?.addEventListener('input', (e) => this.filterMitraKepka(e.target.value));

    // Floating status card close
    this.elements.floatingStatusClose?.addEventListener('click', () => this.closeFloatingStatusCard());

    // Detail modal close
    document.querySelector('.detail-modal-close')?.addEventListener('click', () => this.closeMitraDetailModal());
    document.getElementById('mitraDetailModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'mitraDetailModal') this.closeMitraDetailModal();
    });
  }

  setupModuleEventListeners() {
    // Auth events
    eventBus.on('auth:status', (data) => this.handleAuthStatus(data));

    // Survey events
    eventBus.on('surveys:loaded', (data) => this.handleSurveysLoaded(data));

    // Scraper events
    eventBus.on('scraper:start', () => this.handleScraperStart());
    eventBus.on('scraper:progress', (data) => this.handleScraperProgress(data));
    eventBus.on('scraper:timer', (data) => this.handleScraperTimer(data));
    eventBus.on('scraper:kecamatan', (data) => this.handleScraperKecamatan(data));
    eventBus.on('scraper:desa', (data) => this.handleScraperDesa(data));
    eventBus.on('scraper:complete', (data) => this.handleScraperComplete(data));
    eventBus.on('scraper:error', (data) => this.handleScraperError(data));

    // Exporter events
    eventBus.on('exporter:success', (data) => this.log(`✅ Tersimpan: ${data.filename}`, 'success'));

    // Allocation events
    eventBus.on('allocation:progress', (data) => this.handleAllocationProgress(data));
    eventBus.on('allocation:row_success', (data) => this.handleAllocationRowSuccess(data));
    eventBus.on('allocation:row_error', (data) => this.handleAllocationRowError(data));
    eventBus.on('allocation:complete', (data) => this.handleAllocationComplete(data));
    eventBus.on('allocation:error', (data) => this.handleAllocationError(data));

    // Mitra events
    eventBus.on('mitra:kepka_loaded', (data) => this.handleMitraKepkaLoaded(data));
    eventBus.on('mitra:scrap_loaded', (data) => this.handleMitraScrapLoaded(data));
    eventBus.on('mitra:akun_loaded', (data) => this.handleAkunMitraLoaded(data));
    eventBus.on('mitra:error', (data) => this.handleMitraError(data));
  }

  switchPage(pageName) {
    this.elements.pages?.forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageName}`)?.classList.add('active');
    this.elements.navItems?.forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });
    if (this.elements.pageTitle) {
      this.elements.pageTitle.textContent = PAGE_TITLES[pageName] || pageName;
    }
    this.currentPage = pageName;
    
    // Check JWT status when switching to settings page
    if (pageName === 'settings') {
      this.checkJwtStatus();
    }
    
    // Auto-load Akun Mitra when switching to akun-mitra page
    if (pageName === 'akun-mitra') {
      this.loadAllAkunMitraAuto();
    }
    
    // Load survei list when switching to scrapping or seleksi pages
    if (pageName === 'scrapping-mitra' || pageName === 'seleksi-mitra') {
      if (this.elements.mitraSurveySelect?.options.length <= 1) {
        this.loadMitraSurveiList();
      }
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem(STORAGE_KEYS.THEME, this.isDarkMode ? 'dark' : 'light');
    const sunIcon = this.elements.themeToggle?.querySelector('.icon-sun');
    const moonIcon = this.elements.themeToggle?.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = this.isDarkMode ? 'none' : 'block';
      moonIcon.style.display = this.isDarkMode ? 'block' : 'none';
    }
  }

  toggleSidebar() {
    if (!this.elements.sidebar) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      this.elements.sidebar.classList.toggle('mobile-open');
      this.elements.sidebarOverlay?.classList.toggle('active', this.elements.sidebar.classList.contains('mobile-open'));
    } else {
      this.elements.sidebar.classList.toggle('collapsed');
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, this.elements.sidebar.classList.contains('collapsed'));
    }
  }

  closeMobileSidebar() {
    this.elements.sidebar?.classList.remove('mobile-open');
    this.elements.sidebarOverlay?.classList.remove('active');
  }

  async reloadSession() {
    this.log('🔄 Reloading session...', 'info');
    this.showLoadingModal('Reloading Session...', 'Memeriksa status login');
    const loggedIn = await authService.checkLogin();
    this.hideLoadingModal();
    if (loggedIn) {
      await surveyService.loadSurveys();
      this.log('✅ Session reloaded successfully', 'success');
    } else {
      this.log('⚠️ Still not logged in. Please login to FASIH first', 'warning');
    }
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

  handleSurveysLoaded(data) {
    this.populateSurveySelect(data.surveys);
    this.hideLoadingModal();
    this.updateStats();
    this.log(`✅ ${data.count} survei dimuat`, 'success');
  }

  populateSurveySelect(surveys, targetSelect = null) {
    const select = targetSelect || this.elements.surveySelect;
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Survei --</option>';
    surveys.forEach(s => {
      const opt = document.createElement('option');
      const name = s.name || s.nama || s.judul;
      opt.value = JSON.stringify({ id: s.id, name, regionGroupId: s.regionGroupId });
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  async loadAllocationPeriods(surveyJson) {
    try {
      const survey = JSON.parse(surveyJson);
      const periods = await surveyService.getPeriods(survey.id);
      
      if (this.elements.allocationPeriodSelect) {
        this.elements.allocationPeriodSelect.innerHTML = '<option value="">-- Pilih Periode --</option>';
        periods.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name || p.periode;
          this.elements.allocationPeriodSelect.appendChild(opt);
        });
      }

      if (this.elements.allocationRoleSelect) {
        this.elements.allocationRoleSelect.innerHTML = '<option value="">-- Pilih Role --</option>';
        SURVEY_ROLES.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = r.name;
          this.elements.allocationRoleSelect.appendChild(opt);
        });
      }
    } catch (err) {
      this.log('❌ Error loading periods: ' + err.message, 'error');
    }
  }

  updateStats() {
    const surveysCount = surveyService.getAll().length;
    const recordsCount = scraperService.getTotalRecords();
    const historyCount = HistoryCache.getAll().length;
    if (this.elements.statSurveys) this.elements.statSurveys.textContent = surveysCount;
    if (this.elements.statRecords) this.elements.statRecords.textContent = recordsCount.toLocaleString('id-ID');
    if (this.elements.statHistory) this.elements.statHistory.textContent = historyCount;
  }

  // ===== SCRAPER METHODS =====

  async startScraping() {
    const surveySelect = this.elements.surveySelect?.value;
    if (!surveySelect) {
      this.log('⚠️ Pilih survei terlebih dahulu!', 'warning');
      return;
    }
    const survey = JSON.parse(surveySelect);
    this.totalDesaCount = 0;
    this.processedDesaCount = 0;
    this.elapsedMs = 0;
    this.estimatedTotalMs = 0;
    if (this.estimatedInterval) clearInterval(this.estimatedInterval);
    if (this.elements.statTime) this.elements.statTime.textContent = '--:--';
    await scraperService.scrape(survey, this.selectedMode);
  }

  stopScraping() {
    scraperService.stop();
  }

  handleScraperStart() {
    this.log('═══════════════════════════════════════════');
    this.log('🚀 Memulai ekstraksi data...');
    this.log('═══════════════════════════════════════════');
    this.elements.stopBtn.disabled = false;
    this.elements.startBtn.disabled = true;
    this.elements.downloadCsvBtn.disabled = true;
    this.elements.downloadExcelBtn.disabled = true;
  }

  handleScraperProgress(data) {
    if (data.percent != null) {
      this.elements.progressBar.style.width = `${data.percent}%`;
      this.elements.progressText.textContent = `${data.percent}%`;
    }
    if (data.totalRecords != null) {
      this.elements.progressStats.textContent = `${data.totalRecords.toLocaleString('id-ID')} baris terkumpul`;
      this.elements.statRecords.textContent = data.totalRecords.toLocaleString('id-ID');
    }
    if (data.totalDesa != null) this.totalDesaCount = data.totalDesa;
    if (data.processedDesa != null) this.processedDesaCount = data.processedDesa;
    if (this.totalDesaCount > 0 && this.processedDesaCount > 0 && this.elapsedMs > 0) {
      const avgMsPerDesa = this.elapsedMs / this.processedDesaCount;
      this.estimatedTotalMs = this.totalDesaCount * avgMsPerDesa;
    }
  }

  handleScraperTimer(data) {
    this.elapsedMs = data.elapsed * 1000;
    if (this.totalDesaCount > 0 && this.processedDesaCount > 0 && this.elapsedMs > 0) {
      const avgMsPerDesa = this.elapsedMs / this.processedDesaCount;
      this.estimatedTotalMs = this.totalDesaCount * avgMsPerDesa;
    }
    if (this.elements.statTime) {
      if (this.estimatedTotalMs > 0 && this.elapsedMs > 0) {
        const remainingMs = Math.max(0, this.estimatedTotalMs - this.elapsedMs);
        const remainingSec = Math.ceil(remainingMs / 1000);
        this.elements.statTime.textContent = remainingSec > 0 ? utils.formatDuration(remainingSec) : '00:00';
      } else {
        this.elements.statTime.textContent = '--:--';
      }
    }
  }

  handleScraperKecamatan(data) {
    this.log('═══════════════════════════════════════════════════════════════════');
    this.log(`🗺️ Kecamatan (${data.index}/${data.total}): ${data.name} (${data.desaCount} Desa)`);
    this.log('═══════════════════════════════════════════════════════════════════');
  }

  handleScraperDesa(data) {
    this.log(`   ➤ ${data.label} (${utils.pad(data.current, 2, ' ')}/${utils.pad(data.total, 2, ' ')}) : Terkumpul ${utils.pad(data.count, 3, ' ')} baris. (ID: ${data.id.substring(0, 8)}...)`, data.count > 0 ? 'success' : 'warning');
  }

  handleScraperComplete(data) {
    const survey = JSON.parse(this.elements.surveySelect?.value || '{}');
    this.log('═══════════════════════════════════════════════════════════════════');
    this.log(`✅ Selesai: ${data.totalRecords} records terkumpul`, 'success');
    this.elements.stopBtn.disabled = true;
    this.elements.startBtn.disabled = false;
    this.elements.downloadCsvBtn.disabled = false;
    this.elements.downloadExcelBtn.disabled = false;
    
    if (survey.name) {
      this.addToHistory(survey.name, this.selectedMode, data.totalRecords, data.duration || 0);
    }
  }

  handleScraperError(data) {
    this.log(`❌ Error: ${data.message || data}`, 'error');
    this.elements.stopBtn.disabled = true;
    this.elements.startBtn.disabled = false;
  }

  downloadCSV() {
    const results = scraperService.getResults();
    const survey = JSON.parse(this.elements.surveySelect?.value || '{}');
    if (results.length > 0 && survey.name) {
      ExporterService.exportToCSV(results, survey.name, this.selectedMode);
    }
  }

  downloadExcel() {
    const results = scraperService.getResults();
    const survey = JSON.parse(this.elements.surveySelect?.value || '{}');
    if (results.length > 0 && survey.name) {
      ExporterService.exportToExcel(results, survey.name, this.selectedMode);
    }
  }

  // ===== ALLOCATION METHODS =====

  async handleAllocationFile(file) {
    try {
      this.log(`📂 Membaca file: ${file.name}`, 'info');
      const data = await allocationService.parseExcelFile(file);
      allocationService.setUploadedData(data);
      
      if (this.elements.allocationConfig) this.elements.allocationConfig.style.display = 'block';
      if (this.elements.uploadArea) this.elements.uploadArea.style.display = 'none';
      if (this.elements.previewCount) this.elements.previewCount.textContent = data.length;
      
      if (this.elements.previewTableBody) {
        this.elements.previewTableBody.innerHTML = data.slice(0, 50).map(row => `
          <tr>
            <td>${row.provinsi}</td><td>${row.kabupaten}</td><td>${row.kecamatan}</td>
            <td>${row.desa}</td><td>${row.sls}</td><td>${row.subsls}</td><td>${row.email}</td>
          </tr>
        `).join('');
      }
      
      const surveys = surveyService.getAll();
      if (this.elements.allocationSurveySelect) {
        this.populateSurveySelect(surveys, this.elements.allocationSurveySelect);
      }
      
      if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false;
      this.log(`✅ ${data.length} baris data berhasil dibaca`, 'success');
    } catch (err) {
      this.log('❌ Error membaca file: ' + err.message, 'error');
    }
  }

  async startAllocation() {
    const periodVal = this.elements.allocationPeriodSelect?.value;
    const roleVal = this.elements.allocationRoleSelect?.value;
    if (!periodVal || !roleVal) {
      this.log('⚠️ Pilih periode dan role terlebih dahulu', 'warning');
      return;
    }
    const options = {
      overwrite: this.elements.allocationOverwrite?.checked || false,
      directAssign: this.elements.allocationDirectAssign?.checked !== false,
      rateLimit: parseInt(this.elements.allocationRateLimit?.value || 500)
    };
    await allocationService.allocateUsers(periodVal, roleVal, options);
  }

  handleAllocationProgress(data) {
    if (this.elements.allocationProgressBar) this.elements.allocationProgressBar.style.width = `${data.percent}%`;
    if (this.elements.allocationProgressText) this.elements.allocationProgressText.textContent = `${data.percent}%`;
  }

  handleAllocationRowSuccess(data) {
    this.allocationLog(`✅ [${data.current}/${data.total}] ${data.email} → ${data.region}`, 'success');
  }

  handleAllocationRowError(data) {
    this.allocationLog(`❌ ${data.email} → ${data.error}`, 'error');
  }

  handleAllocationComplete(data) {
    this.allocationLog('═══════════════════════════════════════════', 'info');
    const msgType = data.failed === 0 ? 'success' : 'warning';
    this.allocationLog(`✅ Selesai: ${data.success} berhasil, ${data.failed} gagal dari ${data.total} total`, msgType);
    if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false;
  }

  handleAllocationError(data) {
    this.allocationLog(`❌ Error: ${data.message}`, 'error');
    if (this.elements.allocateBtn) this.elements.allocateBtn.disabled = false;
  }

  downloadTemplate() {
    const ws = window.XLSX.utils.json_to_sheet(ALLOCATION_TEMPLATE_DATA);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Template');
    window.XLSX.writeFile(wb, 'User_Allocation_Template.xlsx');
    this.log('📥 Template downloaded', 'success');
  }

  clearAllocation() {
    allocationService.clearCache();
    if (this.elements.allocationConfig) this.elements.allocationConfig.style.display = 'none';
    if (this.elements.allocationLog) this.elements.allocationLog.style.display = 'none';
    if (this.elements.uploadArea) this.elements.uploadArea.style.display = 'flex';
    if (this.elements.allocationFileInput) this.elements.allocationFileInput.value = '';
    this.log('🗑️ Allocation data cleared', 'success');
  }

  allocationLog(message, type = 'info') {
    if (!this.elements.allocationTerminal) return;
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const cls = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
    this.elements.allocationTerminal.innerHTML += `<div class="log-line ${cls}"><span class="timestamp">[${timestamp}]</span> ${message}</div>`;
    this.elements.allocationTerminal.scrollTop = this.elements.allocationTerminal.scrollHeight;
  }

  // ===== UI METHODS =====

  log(message, type = 'info') {
    if (!this.elements.logTerminal) return;
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const cls = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : type === 'warning' ? 'log-warning' : type === 'request' ? 'log-request' : 'log-info';
    this.elements.logTerminal.innerHTML += `<div class="log-line ${cls}"><span class="timestamp">[${timestamp}]</span> ${message}</div>`;
    this.elements.logTerminal.scrollTop = this.elements.logTerminal.scrollHeight;
  }

  clearLog() {
    if (this.elements.logTerminal) this.elements.logTerminal.innerHTML = '';
    this.log('🗑️ Log cleared', 'info');
  }

  async copyLog() {
    if (this.elements.logTerminal) {
      const text = this.elements.logTerminal.innerText;
      try {
        await navigator.clipboard.writeText(text);
        this.log('📋 Log copied to clipboard', 'success');
      } catch (e) {
        this.log('❌ Failed to copy log', 'error');
      }
    }
  }

  toggleLog() {
    this.isLogVisible = !this.isLogVisible;
    this.elements.logTerminal?.classList.toggle('hidden', !this.isLogVisible);
    if (this.elements.toggleLogBtn) {
      this.elements.toggleLogBtn.textContent = this.isLogVisible ? 'Hide' : 'Show';
    }
  }

  showLoadingModal(title = 'Memuat...', text = 'Mohon tunggu sebentar') {
    if (this.elements.loadingModalTitle) this.elements.loadingModalTitle.textContent = title;
    if (this.elements.loadingModalText) this.elements.loadingModalText.textContent = text;
    if (this.elements.loadingModal) this.elements.loadingModal.classList.add('active');
  }

  hideLoadingModal() {
    this.elements.loadingModal?.classList.remove('active');
  }

  // ===== SETTINGS =====

  saveSettings() {
    config.update({
      api: { baseUrl: this.elements.apiBaseUrl?.value || 'https://fasih-sm.bps.go.id' },
      scraper: {
        rateLimitMs: parseInt(this.elements.rateLimit?.value || 300),
        detailRateLimitMs: parseInt(this.elements.detailRateLimit?.value || 100),
        batchSize: parseInt(this.elements.batchSize?.value || 100),
        maxPaginationPages: parseInt(this.elements.maxPagination?.value || 50)
      }
    });
    this.log('✅ Pengaturan disimpan', 'success');
  }

  resetSettings() {
    config.reset();
    this.loadSettings();
    this.log('✅ Pengaturan direset ke default', 'success');
  }

  loadSettings() {
    const cfg = config.get();
    if (this.elements.apiBaseUrl) this.elements.apiBaseUrl.value = cfg.api.baseUrl;
    if (this.elements.rateLimit) this.elements.rateLimit.value = cfg.scraper.rateLimitMs;
    if (this.elements.detailRateLimit) this.elements.detailRateLimit.value = cfg.scraper.detailRateLimitMs;
    if (this.elements.batchSize) this.elements.batchSize.value = cfg.scraper.batchSize;
    if (this.elements.maxPagination) this.elements.maxPagination.value = cfg.scraper.maxPaginationPages;
  }

  // ===== HISTORY =====

  addToHistory(surveyName, mode, records, duration) {
    const id = utils.generateId();
    const results = scraperService.getResults();
    const jsonStr = JSON.stringify(results);
    const fileSize = new Blob([jsonStr]).size;
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    
    HistoryCache.save(id, { surveyName, mode, records, fileSize, date, data: results });
    this.renderHistory();
    this.updateStats();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  renderHistory() {
    if (!this.elements.historyList) return;
    const allHistory = HistoryCache.getAll();
    
    if (allHistory.length === 0) {
      this.elements.historyList.innerHTML = '<p class="text-center text-muted">Belum ada riwayat scraping.</p>';
      if (this.historyInterval) { clearInterval(this.historyInterval); this.historyInterval = null; }
      return;
    }
    
    this.elements.historyList.innerHTML = allHistory.map(h => {
      const isExpired = (Date.now() - h.timestamp) > (10 * 60 * 1000);
      const sizeStr = h.fileSize ? this.formatFileSize(h.fileSize) : '-';
      return `
        <div class="history-item">
          <div class="history-info">
            <strong>${h.survey}</strong>
            <small>${h.date} | Mode: ${h.mode} | ${h.records} records | ${sizeStr}</small>
            <span class="history-countdown ${isExpired ? 'expired' : ''}" data-timestamp="${h.timestamp}">
              ${isExpired ? 'File kadaluwarsa' : 'File kadaluwarsa dalam ' + this.getRemainingTime(h.timestamp)}
            </span>
          </div>
          <div class="history-actions">
            <button class="btn btn-success btn-sm ${isExpired ? 'expired' : ''}" data-id="${h.id}" data-type="csv" ${isExpired ? 'disabled' : ''}>CSV</button>
            <button class="btn btn-info btn-sm ${isExpired ? 'expired' : ''}" data-id="${h.id}" data-type="excel" ${isExpired ? 'disabled' : ''}>Excel</button>
          </div>
        </div>
      `;
    }).join('');
    
    if (this.historyInterval) clearInterval(this.historyInterval);
    this.historyInterval = setInterval(() => this.updateHistoryCountdowns(), 1000);
    
    this.elements.historyList.querySelectorAll('.history-actions .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        const cached = HistoryCache.get(id);
        if (cached && cached.data && cached.data.length > 0) {
          if (type === 'csv') ExporterService.exportToCSV(cached.data, cached.survey, cached.mode);
          else ExporterService.exportToExcel(cached.data, cached.survey, cached.mode);
        }
      });
    });
  }

  getRemainingTime(timestamp) {
    const remaining = (timestamp + 10 * 60 * 1000) - Date.now();
    if (remaining <= 0) return '00:00';
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateHistoryCountdowns() {
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

  clearHistory() {
    const count = HistoryCache.clearAll();
    this.renderHistory();
    this.updateStats();
    this.log(`🗑️ ${count} riwayat scraped dihapus`, 'success');
  }

  // ===== MITRA METHODS =====

  async loadMitraKepka() {
    const tahun = this.elements.mitraTahunSelect?.value || '2026';
    this.log(`📊 Memuat data Mitra KEPKA tahun ${tahun}...`, 'info');
    this.mitraKepkaData = await mitraService.getMitraKepka(tahun, mitraService.kdProv, mitraService.kdKab);
    if (this.mitraKepkaData.length > 0) {
      this.renderMitraKepkaTable();
      this.updateMitraStats();
      if (this.elements.downloadMitraCsvBtn) this.elements.downloadMitraCsvBtn.disabled = false;
      if (this.elements.downloadMitraExcelBtn) this.elements.downloadMitraExcelBtn.disabled = false;
    }
  }

  renderMitraKepkaTable() {
    if (!this.elements.mitraKepkaTableBody) return;
    if (this.mitraKepkaData.length === 0) {
      this.elements.mitraKepkaTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    this.elements.mitraKepkaTableBody.innerHTML = this.mitraKepkaData.slice(0, 100).map(m => `
      <tr>
        <td>${m.mitra_detail?.nik || '-'}</td>
        <td>${m.mitra_detail?.nama_lengkap || '-'}</td>
        <td>${m.mitra_detail?.email || '-'}</td>
        <td>${m.nama_pos || '-'}</td>
        <td>${m.ket_status || '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary mitra-detail-btn" data-id="${m.id_mitra}">Detail</button>
        </td>
      </tr>
    `).join('');

    // Add event listeners for detail buttons
    this.elements.mitraKepkaTableBody.querySelectorAll('.mitra-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showMitraDetail(btn.dataset.id));
    });
  }

  async showMitraDetail(idMitra) {
    if (!idMitra) {
      this.log('⚠️ ID Mitra tidak valid', 'warning');
      return;
    }
    this.selectedMitraId = idMitra;
    this.log(`📋 Memuat detail mitra ID: ${idMitra}...`, 'info');
    
    const detail = await mitraService.getMitraDetail(idMitra);
    if (!detail) {
      this.log('⚠️ Detail mitra tidak ditemukan', 'warning');
      return;
    }
    
    // Show modal
    if (this.elements.mitraDetailModal) {
      this.elements.mitraDetailModal.classList.add('active');
    }
    
    // Render detail content
    if (this.elements.mitraDetailBody) {
      this.elements.mitraDetailBody.innerHTML = `
        <div class="detail-row"><span class="detail-label">ID Mitra</span><span class="detail-value">${detail.idmitra || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">NIK</span><span class="detail-value">${detail.nik || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Lengkap</span><span class="detail-value">${detail.nama_lengkap || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value">${detail.username || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${detail.email || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">No. Telepon</span><span class="detail-value">${detail.no_telp || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${detail.status || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">NPWP</span><span class="detail-value">${detail.npwp || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Alamat</span><span class="detail-value">${detail.alamat_detail || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Provinsi</span><span class="detail-value">${detail.alamat_prov || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Kabupaten</span><span class="detail-value">${detail.alamat_kab || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Kecamatan</span><span class="detail-value">${detail.alamat_kec || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Desa</span><span class="detail-value">${detail.alamat_desa || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Tanggal Lahir</span><span class="detail-value">${detail.tgl_lahir || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Jenis Kelamin</span><span class="detail-value">${detail.jns_kelamin === '1' ? 'Laki-laki' : detail.jns_kelamin === '2' ? 'Perempuan' : '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Agama</span><span class="detail-value">${detail.agama || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Status Kawin</span><span class="detail-value">${detail.status_kawin || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Pendidikan</span><span class="detail-value">${detail.pendidikan || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Pekerjaan</span><span class="detail-value">${detail.pekerjaan || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Bank</span><span class="detail-value">${detail.kd_bank || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">No. Rekening</span><span class="detail-value">${detail.rekening || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Rekening</span><span class="detail-value">${detail.rekening_nama || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Merk HP</span><span class="detail-value">${detail.merk_hp || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Tipe HP</span><span class="detail-value">${detail.tipe_hp || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">RAM HP</span><span class="detail-value">${detail.ram_hp || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Catatan</span><span class="detail-value">${detail.catatan || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Sobat ID</span><span class="detail-value">${detail.sobat_id || '-'}</span></div>
      `;
    }
    
    // Load history for this mitra
    this.log(`📊 Memuat riwayat survei mitra...`, 'info');
    await this.loadMitraHistory(idMitra);
  }

  async loadMitraHistory(idMitra) {
    const tahun = this.elements.mitraTahunSelect?.value || '2026';
    const history = await mitraService.getMitraHistory(idMitra, tahun);
    if (this.elements.mitraHistoryTableBody) {
      if (history.length === 0) {
        this.elements.mitraHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada riwayat survei</td></tr>';
      } else {
        this.elements.mitraHistoryTableBody.innerHTML = history.map(h => `
          <tr>
            <td>${h.kd_survei || '-'}</td>
            <td>${h.nama_survei || '-'}</td>
            <td>${h.nama_keg || '-'}</td>
            <td>${h.nama_pos || '-'}</td>
            <td>${h.nama_status || '-'}</td>
            <td>${h.nama_kab ? `${h.nama_kab}, ${h.nama_prov}` : '-'}</td>
          </tr>
        `).join('');
      }
    }
  }

  downloadMitraKepkaCSV() {
    if (this.mitraKepkaData.length === 0) return;
    mitraService.exportKepkaToCSV(this.mitraKepkaData, 'mitra_kepka');
    this.log('📥 Mitra KEPKA CSV downloaded', 'success');
  }

  downloadMitraKepkaExcel() {
    if (this.mitraKepkaData.length === 0) return;
    mitraService.exportKepkaToExcel(this.mitraKepkaData, 'mitra_kepka');
    this.log('📥 Mitra KEPKA Excel downloaded', 'success');
  }

  async loadMitraScrapData() {
    const surveyVal = this.elements.mitraSurveySelect?.value;
    const kegiatanVal = this.elements.mitraKegiatanSelect?.value;
    if (!surveyVal || !kegiatanVal) {
      this.log('⚠️ Pilih survei dan kegiatan terlebih dahulu', 'warning');
      return;
    }
    this.log('📊 Memuat data Mitra Scrapping...', 'info');
    this.mitraScrapData = await mitraService.getMitraList(surveyVal, kegiatanVal);
    if (this.mitraScrapData.length > 0) {
      this.renderMitraScrapTable();
      if (this.elements.downloadMitraScrapCsvBtn) this.elements.downloadMitraScrapCsvBtn.disabled = false;
      if (this.elements.downloadMitraScrapExcelBtn) this.elements.downloadMitraScrapExcelBtn.disabled = false;
    }
  }

  renderMitraScrapTable() {
    if (!this.elements.mitraScrapTableBody) return;
    if (this.mitraScrapData.length === 0) {
      this.elements.mitraScrapTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    this.elements.mitraScrapTableBody.innerHTML = this.mitraScrapData.slice(0, 100).map(m => `
      <tr>
        <td>${m.nik || '-'}</td>
        <td>${m.nama_lengkap || '-'}</td>
        <td>${m.email || '-'}</td>
        <td>${m.posisi || '-'}</td>
        <td>${m.status || '-'}</td>
        <td>${m.alamat || '-'}</td>
      </tr>
    `).join('');
    if (this.elements.mitraScrapStats) {
      this.elements.mitraScrapStats.textContent = `${this.mitraScrapData.length} records`;
    }
  }

  downloadMitraScrapCSV() {
    if (this.mitraScrapData.length === 0) return;
    mitraService.exportKepkaToCSV(this.mitraScrapData, 'mitra_scrap');
    this.log('📥 Mitra Scrap CSV downloaded', 'success');
  }

  downloadMitraScrapExcel() {
    if (this.mitraScrapData.length === 0) return;
    mitraService.exportKepkaToExcel(this.mitraScrapData, 'mitra_scrap');
    this.log('📥 Mitra Scrap Excel downloaded', 'success');
  }

  async loadMitraKegiatan(kdSurvei) {
    if (!this.elements.mitraKegiatanSelect) return;
    this.elements.mitraKegiatanSelect.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const status = this.elements.mitraStatusKegiatanSelect?.value || '1';
    const kegiatan = await mitraService.getKegiatanList(kdSurvei, 2, 0, status);
    kegiatan.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id_keg;
      opt.textContent = k.nama_keg || '-';
      this.elements.mitraKegiatanSelect.appendChild(opt);
    });
    this.log(`✅ ${kegiatan.length} kegiatan dimuat (status: ${status})`, 'success');
  }

  async loadSeleksiData() {
    const surveiVal = this.elements.seleksiSurveiSelect?.value;
    const kegiatanVal = this.elements.seleksiKegiatanSelect?.value;
    if (!surveiVal || !kegiatanVal) {
      this.log('⚠️ Pilih survei dan kegiatan terlebih dahulu', 'warning');
      return;
    }
    this.log('📊 Memuat data Seleksi Mitra...', 'info');
    this.seleksiData = await mitraService.getMitraList(surveiVal, kegiatanVal);
    if (this.seleksiData.length > 0) {
      this.renderSeleksiTable();
    }
  }

  renderSeleksiTable() {
    if (!this.elements.seleksiTableBody) return;
    if (this.seleksiData.length === 0) {
      this.elements.seleksiTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    this.elements.seleksiTableBody.innerHTML = this.seleksiData.slice(0, 100).map(m => `
      <tr>
        <td>${m.nik || '-'}</td>
        <td>${m.nama_lengkap || '-'}</td>
        <td>${m.email || '-'}</td>
        <td>${m.posisi || '-'}</td>
        <td>${m.ket_status || '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary seleksi-detail-btn" data-id="${m.id}">Detail</button>
        </td>
      </tr>
    `).join('');
    if (this.elements.seleksiStats) {
      this.elements.seleksiStats.textContent = `${this.seleksiData.length} records`;
    }
  }

  async loadSeleksiKegiatan(kdSurvei) {
    if (!this.elements.seleksiKegiatanSelect) return;
    this.elements.seleksiKegiatanSelect.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const status = this.elements.seleksiStatusKegiatanSelect?.value || '1';
    const kegiatan = await mitraService.getKegiatanList(kdSurvei, 2, 0, status);
    kegiatan.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id_keg;
      opt.textContent = k.nama_keg || '-';
      this.elements.seleksiKegiatanSelect.appendChild(opt);
    });
    this.log(`✅ ${kegiatan.length} kegiatan seleksi dimuat (status: ${status})`, 'success');
  }

  async loadAkunMitra() {
    this.log('📊 Memuat data Akun Mitra...', 'info');
    const data = await mitraService.getAkunMitra(this.akunMitraPage);
    if (data.length > 0) {
      this.renderAkunMitraTable();
    }
  }

  renderAkunMitraTable() {
    if (!this.elements.akunMitraTableBody) return;
    if (mitraService.akunMitraData.length === 0) {
      this.elements.akunMitraTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    this.elements.akunMitraTableBody.innerHTML = mitraService.akunMitraData.map(m => `
      <tr>
        <td>${m.username || '-'}</td>
        <td>${m.email || '-'}</td>
        <td>${m.nama_lengkap || '-'}</td>
        <td>${m.nik || '-'}</td>
        <td>${m.status === '1' ? 'Aktif' : 'Nonaktif'}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}</td>
      </tr>
    `).join('');
    if (this.elements.pageInfo) {
      this.elements.pageInfo.textContent = `Page ${this.akunMitraPage}`;
    }
    if (this.elements.prevPageBtn) this.elements.prevPageBtn.disabled = this.akunMitraPage <= 1;
    if (this.elements.nextPageBtn) this.elements.nextPageBtn.disabled = mitraService.akunMitraData.length < mitraService.akunMitraPerPage;
  }

  prevAkunMitraPage() {
    if (this.akunMitraPage > 1) {
      this.akunMitraPage--;
      this.loadAkunMitra();
    }
  }

  nextAkunMitraPage() {
    this.akunMitraPage++;
    this.loadAkunMitra();
  }

  downloadAkunMitraCSV() {
    if (mitraService.akunMitraData.length === 0) return;
    mitraService.exportAkunToCSV(mitraService.akunMitraData, 'akun_mitra');
    this.log('📥 Akun Mitra CSV downloaded', 'success');
  }

  downloadAkunMitraExcel() {
    if (mitraService.akunMitraData.length === 0) return;
    mitraService.exportAkunToExcel(mitraService.akunMitraData, 'akun_mitra');
    this.log('📥 Akun Mitra Excel downloaded', 'success');
  }

  /**
   * Close Mitra Detail Modal
   */
  closeMitraDetailModal() {
    if (this.elements.mitraDetailModal) {
      this.elements.mitraDetailModal.classList.remove('active');
    }
  }

  /**
   * Filter select options based on search input
   */
  filterSelect(input) {
    const targetId = input.dataset.target;
    const select = document.getElementById(targetId);
    if (!select) return;
    const query = input.value.toLowerCase();
    const options = select.querySelectorAll('option');
    let visibleCount = 0;
    options.forEach(opt => {
      const text = opt.textContent.toLowerCase();
      const match = text.includes(query);
      opt.style.display = match ? '' : 'none';
      if (match && opt.value) visibleCount++;
    });
  }

  /**
   * Load kabupaten for a given provinsi into a select element
   */
  async loadKabupatenForSelect(selectId, kdProv) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
    try {
      const kabupaten = await mitraService.getKabupaten(kdProv);
      kabupaten.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.kd_kab || k.id;
        opt.textContent = k.nama || k.kabupaten;
        select.appendChild(opt);
      });
      this.log(`✅ ${kabupaten.length} kabupaten dimuat`, 'success');
    } catch (err) {
      this.log(`❌ Error loading kabupaten: ${err.message}`, 'error');
    }
  }

  /**
   * Auto-load all Akun Mitra data when switching to page
   * Shows loading UI and fetches all data at once
   */
  async loadAllAkunMitraAuto() {
    if (this.akunMitraAllData.length > 0) return; // Already loaded
    
    const loadingEl = this.elements.akunLoading;
    const tableBody = this.elements.akunMitraTableBody;
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (tableBody) tableBody.innerHTML = '';
    
    try {
      const allData = await mitraService.getAkunMitra(1, 9999);
      this.akunMitraAllData = allData;
      
      if (loadingEl) loadingEl.style.display = 'none';
      
      if (allData.length > 0) {
        this.renderAkunMitraTableWithAllData(allData);
        if (this.elements.downloadAkunCsvBtn) this.elements.downloadAkunCsvBtn.disabled = false;
        if (this.elements.downloadAkunExcelBtn) this.elements.downloadAkunExcelBtn.disabled = false;
        Logger.info(`[App] ${allData.length} akun mitra loaded`);
      } else {
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error: ${err.message}</td></tr>`;
      Logger.error('[App] Failed to load akun mitra:', err.message);
    }
  }

  /**
   * Render Akun Mitra table with all data
   */
  renderAkunMitraTableWithAllData(data) {
    if (!this.elements.akunMitraTableBody) return;
    if (!data || data.length === 0) {
      this.elements.akunMitraTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    this.elements.akunMitraTableBody.innerHTML = data.map(m => `
      <tr>
        <td>${m.username || '-'}</td>
        <td>${m.email || '-'}</td>
        <td>${m.nama_lengkap || '-'}</td>
        <td>${m.nik || '-'}</td>
        <td>${m.status === '1' ? 'Aktif' : 'Nonaktif'}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}</td>
      </tr>
    `).join('');
    if (this.elements.pageInfo) {
      this.elements.pageInfo.textContent = `Menampilkan semua ${data.length} data`;
    }
    // Hide pagination since we show all data
    if (this.elements.prevPageBtn) this.elements.prevPageBtn.style.display = 'none';
    if (this.elements.nextPageBtn) this.elements.nextPageBtn.style.display = 'none';
  }

  /**
   * Filter Akun Mitra from cached data (live search)
   */
  filterAkunMitra(query) {
    const lowerQuery = (query || '').toLowerCase();
    const allData = this.akunMitraAllData;
    if (!allData || allData.length === 0) return;
    
    const filtered = lowerQuery ? allData.filter(m => {
      return (m.username || '').toLowerCase().includes(lowerQuery) ||
             (m.nama_lengkap || '').toLowerCase().includes(lowerQuery) ||
             (m.email || '').toLowerCase().includes(lowerQuery) ||
             (m.nik || '').toLowerCase().includes(lowerQuery);
    }) : allData;
    
    this.renderAkunMitraTableWithAllData(filtered);
  }

  /**
   * Download All Mitra KEPKA Detail as CSV
   * Fetches detailed data for each mitra one by one
   */
  async downloadAllMitraDetailCSV() {
    if (this.mitraKepkaData.length === 0) {
      this.log('⚠️ Tidak ada data Mitra KEPKA', 'warning');
      return;
    }
    await this._downloadAllMitraDetail('csv');
  }

  /**
   * Download All Mitra KEPKA Detail as Excel
   */
  async downloadAllMitraDetailExcel() {
    if (this.mitraKepkaData.length === 0) {
      this.log('⚠️ Tidak ada data Mitra KEPKA', 'warning');
      return;
    }
    await this._downloadAllMitraDetail('excel');
  }

  /**
   * Internal: Download all detail with progress
   */
  async _downloadAllMitraDetail(format) {
    const progressDiv = this.elements.detailProgress;
    const progressText = this.elements.detailProgressText;
    const progressPercent = this.elements.detailProgressPercent;
    const progressBar = this.elements.detailProgressBar;
    const progressBarText = this.elements.detailProgressBarText;
    
    if (progressDiv) progressDiv.style.display = 'block';
    
    const total = this.mitraKepkaData.length;
    const allDetail = [];
    
    for (let i = 0; i < total; i++) {
      const m = this.mitraKepkaData[i];
      const idMitra = m.id_mitra;
      
      if (progressText) progressText.textContent = `Mengambil detail ${i + 1}/${total}: ${m.mitra_detail?.nama_lengkap || '...'}`;
      const percent = Math.round(((i + 1) / total) * 100);
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressBarText) progressBarText.textContent = `${percent}%`;
      
      try {
        const detail = await mitraService.getMitraDetail(idMitra);
        if (detail) {
          allDetail.push(detail);
        }
        // Rate limit: 1 second between requests
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        this.log(`⚠️ Gagal mengambil detail ID ${idMitra}: ${err.message}`, 'warning');
      }
    }
    
    if (progressText) progressText.textContent = `✅ Selesai! ${allDetail.length} detail berhasil diambil`;
    
    if (allDetail.length === 0) {
      this.log('❌ Tidak ada detail yang berhasil diambil', 'error');
      if (progressDiv) progressDiv.style.display = 'none';
      return;
    }
    
    if (format === 'csv') {
      this._exportDetailToCSV(allDetail);
    } else {
      this._exportDetailToExcel(allDetail);
    }
    
    // Hide progress after 3 seconds
    setTimeout(() => {
      if (progressDiv) progressDiv.style.display = 'none';
    }, 3000);
  }

  /**
   * Export detail data to CSV
   */
  _exportDetailToCSV(data) {
    const headers = ['ID Mitra', 'NIK', 'Nama Lengkap', 'Email', 'Username', 'Status', 'No Telp', 'NPWP', 'Alamat', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Desa', 'Tgl Lahir', 'Jenis Kelamin', 'Agama', 'Status Kawin', 'Pendidikan', 'Pekerjaan', 'Bank', 'No Rekening', 'Nama Rekening', 'Merk HP', 'Tipe HP', 'RAM HP', 'Sobat ID', 'Foto URL', 'Foto KTP URL'];
    const rows = data.map(d => [
      d.idmitra || '-',
      `"${(d.nik || '-').replace(/"/g, '""')}"`,
      `"${(d.nama_lengkap || '-').replace(/"/g, '""')}"`,
      d.email || '-',
      d.username || '-',
      d.status || '-',
      d.no_telp || '-',
      d.npwp || '-',
      `"${(d.alamat_detail || '-').replace(/"/g, '""')}"`,
      d.alamat_prov || '-',
      d.alamat_kab || '-',
      d.alamat_kec || '-',
      d.alamat_desa || '-',
      d.tgl_lahir || '-',
      d.jns_kelamin === '1' ? 'Laki-laki' : d.jns_kelamin === '2' ? 'Perempuan' : '-',
      d.agama || '-',
      d.status_kawin || '-',
      d.pendidikan || '-',
      d.pekerjaan || '-',
      d.kd_bank || '-',
      d.rekening || '-',
      `"${(d.rekening_nama || '-').replace(/"/g, '""')}"`,
      d.merk_hp || '-',
      d.tipe_hp || '-',
      d.ram_hp || '-',
      d.sobat_id || '-',
      d.foto || '-',
      d.foto_ktp || '-'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mitra_kepka_detail_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.log(`📥 Downloaded ${data.length} detail records as CSV`, 'success');
  }

  /**
   * Export detail data to Excel
   */
  _exportDetailToExcel(data) {
    if (!window.XLSX) {
      this.log('❌ Library XLSX tidak tersedia', 'error');
      return;
    }
    const rows = data.map(d => ({
      'ID Mitra': d.idmitra || '-',
      'NIK': d.nik || '-',
      'Nama Lengkap': d.nama_lengkap || '-',
      'Email': d.email || '-',
      'Username': d.username || '-',
      'Status': d.status || '-',
      'No Telp': d.no_telp || '-',
      'NPWP': d.npwp || '-',
      'Alamat': d.alamat_detail || '-',
      'Provinsi': d.alamat_prov || '-',
      'Kabupaten': d.alamat_kab || '-',
      'Kecamatan': d.alamat_kec || '-',
      'Desa': d.alamat_desa || '-',
      'Tgl Lahir': d.tgl_lahir || '-',
      'Jenis Kelamin': d.jns_kelamin === '1' ? 'Laki-laki' : d.jns_kelamin === '2' ? 'Perempuan' : '-',
      'Agama': d.agama || '-',
      'Status Kawin': d.status_kawin || '-',
      'Pendidikan': d.pendidikan || '-',
      'Pekerjaan': d.pekerjaan || '-',
      'Bank': d.kd_bank || '-',
      'No Rekening': d.rekening || '-',
      'Nama Rekening': d.rekening_nama || '-',
      'Merk HP': d.merk_hp || '-',
      'Tipe HP': d.tipe_hp || '-',
      'RAM HP': d.ram_hp || '-',
      'Sobat ID': d.sobat_id || '-',
      'Foto URL': d.foto || '-',
      'Foto KTP URL': d.foto_ktp || '-'
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Mitra KEPKA Detail');
    window.XLSX.writeFile(wb, `mitra_kepka_detail_${new Date().toISOString().slice(0,10)}.xlsx`);
    this.log(`📥 Downloaded ${data.length} detail records as Excel`, 'success');
  }

  /**
   * Load survei list for Scrapping and Seleksi pages
   * Uses RE list to get idKeg, then loads survei list
   */
  async loadMitraSurveiList() {
    try {
      this.log('📊 Memuat daftar survei Mitra...', 'info');
      // Step 1: Get RE list to find idKeg
      const reList = await mitraService.getReList(mitraService.kdProv, mitraService.kdKab);
      if (reList.length === 0) {
        this.log('⚠️ Tidak ada data RE ditemukan', 'warning');
        return;
      }
      // Use first available idKeg
      const idKeg = reList[0].idKeg || '1';
      
      // Step 2: Get survei list using idKeg
      const surveys = await mitraService.getSurveiList(idKeg);
      this.mitraSurveiList = surveys;
      
      // Populate both scrapping and seleksi survey selects
      if (this.elements.mitraSurveySelect) {
        this.elements.mitraSurveySelect.innerHTML = '<option value="">-- Pilih Survei --</option>';
        surveys.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.kd_survei;
          opt.textContent = s.nama;
          this.elements.mitraSurveySelect.appendChild(opt);
        });
      }
      
      if (this.elements.seleksiSurveiSelect) {
        this.elements.seleksiSurveiSelect.innerHTML = '<option value="">-- Pilih Survei --</option>';
        surveys.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.kd_survei;
          opt.textContent = s.nama;
          this.elements.seleksiSurveiSelect.appendChild(opt);
        });
      }
      
      this.log(`✅ ${surveys.length} survei dimuat`, 'success');
    } catch (err) {
      this.log(`❌ Error loading survei list: ${err.message}`, 'error');
    }
  }

  updateMitraStats() {
    if (this.elements.statMitraTotal) {
      this.elements.statMitraTotal.textContent = this.mitraKepkaData.length;
    }
    if (this.elements.statMitraDiterima) {
      const diterima = this.mitraKepkaData.filter(m => m.ket_status?.toLowerCase().includes('diterima')).length;
      this.elements.statMitraDiterima.textContent = diterima;
    }
    if (this.elements.statMitraSurvei) {
      const survei = new Set(this.mitraKepkaData.map(m => m.nama_pos)).size;
      this.elements.statMitraSurvei.textContent = survei;
    }
  }

  // ===== MITRA EVENT HANDLERS =====

  handleMitraKepkaLoaded(data) {
    this.log(`✅ ${data.count} data Mitra KEPKA dimuat`, 'success');
  }

  handleMitraScrapLoaded(data) {
    this.log(`✅ ${data.count} data Mitra Scrap dimuat`, 'success');
  }

  handleAkunMitraLoaded(data) {
    this.log(`✅ ${data.count} data Akun Mitra dimuat (Page ${data.page})`, 'success');
  }

  handleMitraError(data) {
    this.log(`❌ Mitra Error: ${data.message}`, 'error');
  }

  // ===== JWT TOKEN MANAGEMENT =====

  /**
   * Save JWT token manually from settings input
   */
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
      // Validate JWT format
      const parts = tokenInput.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      // Check expiry
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        const expDate = new Date(payload.exp * 1000);
        this.log(`⚠️ Token sudah expired (exp: ${expDate.toLocaleString()})`, 'warning');
        return;
      }
      // Save token
      await mitraService.storeJwtManually(tokenInput);
      this.log(`✅ JWT token disimpan (exp: ${new Date(payload.exp * 1000).toLocaleString()})`, 'success');
      this.updateJwtStatus('✅ Token valid tersimpan', 'success');
    } catch (err) {
      this.log(`❌ Error: ${err.message}`, 'error');
      this.updateJwtStatus('❌ Token tidak valid', 'error');
    }
  }

  /**
   * Clear JWT token
   */
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

  /**
   * Update JWT status display
   */
  async updateJwtStatus(message, type = 'info') {
    if (!this.elements.jwtStatus) return;
    const colors = {
      success: 'var(--success-color, #4caf50)',
      error: 'var(--error-color, #f44336)',
      warning: 'var(--warning-color, #ff9800)',
      info: 'var(--text-secondary, #666)'
    };
    this.elements.jwtStatus.textContent = message;
    this.elements.jwtStatus.style.color = colors[type] || colors.info;
  }

  /**
   * Check and display current JWT status, show token in textarea
   */
  async checkJwtStatus() {
    const token = await mitraService.getJwtToken();
    if (token) {
      // Display token in textarea
      if (this.elements.mitraJwtTokenInput) {
        this.elements.mitraJwtTokenInput.value = token;
      }
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        const expDate = new Date(payload.exp * 1000);
        const isExpired = payload.exp && payload.exp < Math.floor(Date.now() / 1000);
        if (isExpired) {
          this.updateJwtStatus(`⚠️ Token expired (${expDate.toLocaleString()})`, 'warning');
        } else {
          this.updateJwtStatus(`✅ Token valid (exp: ${expDate.toLocaleString()})`, 'success');
        }
      } catch {
        this.updateJwtStatus('✅ Token tersimpan', 'success');
      }
    } else {
      this.updateJwtStatus('Belum ada token. Buka manajemen-mitra.bps.go.id atau paste manual.', 'info');
    }
  }

  /**
   * Check all sessions and show toast with loading then results
   */
   async checkAllSessions() {
    const checks = {
      fasih: {
        name: 'FASIH',
        url: 'https://fasih-sm.bps.go.id',
        icon: '📊',
        check: async () => {
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
        check: async () => {
          return new Promise((resolve) => {
            chrome.cookies.get({ url: 'https://community.bps.go.id', name: 'CommunityBPS' }, (cookie) => {
              resolve(!!cookie && cookie.value && cookie.value.length > 10);
            });
          });
        },
        statusText: (ok) => ok ? 'Cookie valid' : 'Cookie tidak ditemukan',
        statusClass: (ok) => ok ? 'success' : 'warning'
      },
      simpeg: {
        name: 'SIMPEG Profile',
        url: 'https://simpeg.bps.go.id',
        icon: '🏢',
        check: async () => {
          const avatar = document.getElementById('userAvatarSidebar');
          return avatar && avatar.src && !avatar.src.includes('profile.png') && !avatar.src.includes('icon128');
        },
        statusText: (ok) => ok ? 'Foto terload' : 'Foto tidak terload',
        statusClass: (ok) => ok ? 'success' : 'warning'
      },
      niplama: {
        name: 'NIP/NIP Lama',
        url: null,
        icon: '🔢',
        check: async () => {
          return new Promise((resolve) => {
            chrome.cookies.get({ url: 'https://community.bps.go.id', name: 'CommunityBPS' }, (cookie) => {
              if (cookie && cookie.value) {
                const niplama = cookie.value.substring(0, 9);
                resolve(/^\d{9}$/.test(niplama));
              } else { resolve(false); }
            });
          });
        },
        statusText: (ok) => ok ? 'NIP ditemukan' : 'NIP tidak ditemukan',
        statusClass: (ok) => ok ? 'success' : 'warning'
      }
    };

    // Show loading toast first
    this.showSessionLoadingToast();

    // Run all checks in parallel
    const results = {};
    const checkPromises = Object.entries(checks).map(async ([key, check]) => {
      try {
        results[key] = await check.check();
      } catch {
        results[key] = false;
      }
    });
    await Promise.all(checkPromises);

    // Show results toast (always, even if all active)
    this.showSessionResultsToast(checks, results);
  }

  /**
   * Show loading state in session toast
   */
  showSessionLoadingToast() {
    const toast = document.getElementById('sessionToast');
    const content = document.getElementById('sessionToastContent');
    const header = toast?.querySelector('.session-toast-header');
    if (!toast || !content || !header) return;

    // Set header to info/loading state
    header.className = 'session-toast-header';
    header.querySelector('span').textContent = '⏳ Memeriksa Session...';

    // Show loading spinner
    content.innerHTML = `
      <div class="session-toast-loading">
        <div class="session-toast-spinner"></div>
        <span class="session-toast-loading-text">Sedang memeriksa status login...</span>
      </div>
    `;

    toast.classList.add('active');
  }

  /**
   * Show session results toast (always shown)
   */
  showSessionResultsToast(checks, results) {
    const toast = document.getElementById('sessionToast');
    const content = document.getElementById('sessionToastContent');
    const header = toast?.querySelector('.session-toast-header');
    if (!toast || !content || !header) return;

    const successCount = Object.values(results).filter(r => r).length;
    const totalCount = Object.keys(results).length;
    const allActive = successCount === totalCount;

    // Update header
    header.className = 'session-toast-header ' + (allActive ? 'success' : 'warning');
    header.querySelector('span').textContent = allActive
      ? `✅ ${successCount}/${totalCount} Semua Session Aktif`
      : `⚠️ ${totalCount - successCount}/${totalCount} Session Perlu Perhatian`;

    // Build results HTML
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

    // Auto-dismiss after 10 seconds
    const autoDismiss = setTimeout(() => {
      toast.classList.remove('active');
    }, 10000);

    // Close button
    const closeBtn = document.getElementById('sessionToastClose');
    closeBtn?.addEventListener('click', () => {
      clearTimeout(autoDismiss);
      toast.classList.remove('active');
    }, { once: true });
  }

  /**
   * Show session warning toast (compact, top-right)
   */
  showSessionWarningToast(checks, results) {
    const toast = document.getElementById('sessionToast');
    if (!toast) return;

    const content = document.getElementById('sessionToastContent');
    if (!content) return;

    content.innerHTML = '';

    for (const [key, check] of Object.entries(checks)) {
      const isOk = results[key];
      const statusClass = check.statusClass(isOk);
      
      const item = document.createElement('div');
      item.className = `session-toast-item ${statusClass}`;
      item.innerHTML = `
        <div class="session-toast-item-left">
          <span class="session-toast-item-icon">${isOk ? '✅' : statusClass === 'error' ? '❌' : '⚠️'}</span>
          <div>
            <div class="session-toast-item-name">${check.icon} ${check.name}</div>
            <div class="session-toast-item-status">${check.statusText(isOk)}</div>
          </div>
        </div>
        ${!isOk && check.url ? `
          <div class="session-toast-item-action">
            <a href="${check.url}" target="_blank">Buka →</a>
          </div>
        ` : ''}
      `;
      content.appendChild(item);
    }

    toast.classList.add('active');

    // Auto-dismiss after 15 seconds
    const autoDismiss = setTimeout(() => {
      toast.classList.remove('active');
    }, 15000);

    // Event listeners
    const closeBtn = document.getElementById('sessionToastClose');
    const openAllBtn = document.getElementById('sessionToastOpenAll');

    const dismissToast = () => {
      clearTimeout(autoDismiss);
      toast.classList.remove('active');
    };
    
    closeBtn?.addEventListener('click', dismissToast, { once: true });
    
    openAllBtn?.addEventListener('click', () => {
      for (const [key, check] of Object.entries(checks)) {
        if (!results[key] && check.url) {
          window.open(check.url, '_blank');
        }
      }
    }, { once: true });
  }

  // ===== FLOATING STATUS CARD =====

  /**
   * Show floating status card with status checks
   */
  async showFloatingStatusCard() {
    const card = this.elements.floatingStatusCard;
    if (!card) return;

    const checks = [
      {
        id: 'cookies',
        name: 'Cookies',
        check: async () => {
          return new Promise((resolve) => {
            chrome.cookies.get({ url: 'https://fasih-sm.bps.go.id', name: 'XSRF-TOKEN' }, (cookie) => {
              resolve(!!cookie && cookie.value);
            });
          });
        },
        successMsg: 'OK',
        failMsg: 'No cookies'
      },
      {
        id: 'jwt',
        name: 'JWT Token',
        check: async () => {
          const jwt = await mitraService.getJwtToken();
          return !!jwt;
        },
        successMsg: 'OK',
        failMsg: 'No JWT'
      },
      {
        id: 'niplama',
        name: 'NIP Lama',
        check: async () => {
          return new Promise((resolve) => {
            chrome.cookies.get({ url: 'https://community.bps.go.id', name: 'CommunityBPS' }, (cookie) => {
              if (cookie && cookie.value) {
                const niplama = cookie.value.substring(0, 9);
                resolve(/^\d{9}$/.test(niplama));
              } else {
                resolve(false);
              }
            });
          });
        },
        successMsg: 'OK',
        failMsg: 'Invalid'
      },
      {
        id: 'avatar',
        name: 'Avatar',
        check: async () => {
          const avatar = document.getElementById('userAvatarSidebar');
          return avatar && avatar.src && !avatar.src.includes('profile.png') && !avatar.src.includes('icon128');
        },
        successMsg: 'OK',
        failMsg: 'Default'
      },
      {
        id: 'session',
        name: 'FASIH Session',
        check: async () => {
          try {
            return await authService.checkLogin();
          } catch {
            return false;
          }
        },
        successMsg: 'Active',
        failMsg: 'Offline'
      }
    ];

    const items = await Promise.all(checks.map(async (c) => ({
      ...c,
      ok: await c.check()
    })));

    const container = document.getElementById('floatingStatusItems');
    if (container) {
      container.innerHTML = items.map(i => `
        <div class="floating-status-item ${i.ok ? 'success' : 'warning'}">
          <div class="floating-status-item-left">
            <span class="floating-status-icon">${i.ok ? '✅' : '⚠️'}</span>
            <span class="floating-status-name">${i.name}</span>
          </div>
          <span class="floating-status-msg">${i.ok ? i.successMsg : i.failMsg}</span>
        </div>
      `).join('');
    }

    const hasFailures = items.some(i => !i.ok);
    if (hasFailures) {
      card.style.display = 'block';
      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (card) card.style.display = 'none';
      }, 10000);
    }
  }

  /**
   * Close floating status card
   */
  closeFloatingStatusCard() {
    if (this.elements.floatingStatusCard) {
      this.elements.floatingStatusCard.style.display = 'none';
    }
  }

  // ===== MITRA KEPKA SEARCH =====

  /**
   * Filter Mitra KEPKA table based on search input
   */
  filterMitraKepka(query) {
    const lowerQuery = (query || '').toLowerCase();
    if (this.mitraKepkaData.length === 0) return;

    const filtered = this.mitraKepkaData.filter(m => {
      const nik = m.mitra_detail?.nik || '';
      const nama = m.mitra_detail?.nama_lengkap || '';
      const email = m.mitra_detail?.email || '';
      const posisi = m.nama_pos || '';
      return nik.toLowerCase().includes(lowerQuery) ||
             nama.toLowerCase().includes(lowerQuery) ||
             email.toLowerCase().includes(lowerQuery) ||
             posisi.toLowerCase().includes(lowerQuery);
    });

    const isDetail = this.selectedMitraMode === 'detail';
    if (this.elements.mitraKepkaTableBody) {
      if (filtered.length === 0) {
        this.elements.mitraKepkaTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada hasil pencarian</td></tr>';
        return;
      }
      this.elements.mitraKepkaTableBody.innerHTML = filtered.slice(0, 100).map(m => `
        <tr>
          <td>${m.mitra_detail?.nik || '-'}</td>
          <td>${m.mitra_detail?.nama_lengkap || '-'}</td>
          <td>${m.mitra_detail?.email || '-'}</td>
          <td>${m.nama_pos || '-'}</td>
          <td>${m.ket_status || '-'}</td>
          <td>
            <button class="btn btn-sm btn-primary mitra-detail-btn" data-id="${m.id_mitra}">Detail</button>
          </td>
        </tr>
      `).join('');

      this.elements.mitraKepkaTableBody.querySelectorAll('.mitra-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => this.showMitraDetail(btn.dataset.id));
      });
    }
  }

  // ===== PREFERENCES =====

  loadPreferences() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.documentElement.classList.add('dark');
      const sunIcon = this.elements.themeToggle?.querySelector('.icon-sun');
      const moonIcon = this.elements.themeToggle?.querySelector('.icon-moon');
      if (sunIcon && moonIcon) { sunIcon.style.display = 'none'; moonIcon.style.display = 'block'; }
    }
    
    const sidebarCollapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    if (sidebarCollapsed && this.elements.sidebar) this.elements.sidebar.classList.add('collapsed');
    this.loadSettings();
  }
}

// Initialize app
const app = new App();

// Start the app after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('[App] DOMContentLoaded fired, initializing app...');
  app.init().catch(err => {
    Logger.error('[App] Initialization error:', err);
  });
});

export { app };
