/**
 * FASIH SCRAPPER - Constants
 * Centralized configuration values and magic strings
 */

// API Endpoints
export const API_ENDPOINTS = {
  SURVEYS: '/surveys/datatable',
  SURVEY_PERIODS: '/survey-periods',
  USER_INFO: '/users/myinfo',
  REGION_LEVEL3: '/region/level3',
  REGION_LEVEL4: '/region/level4',
  EXTRACT: '/assignment/datatable-all-user-survey-periode',
  ASSIGNMENT_BY_ID: '/assignment/get-by-assignment-id',
  ASSIGNMENT_FOR_SCM: '/assignment/get-by-id-with-data-for-scm'
};

// API Modules
export const API_MODULES = {
  SURVEY: '/survey/api/v1',
  REGION: '/region/api/v1',
  ANALYTIC: '/analytic/api/v2',
  ASSIGNMENT: '/assignment-general/api'
};

// Scraper Configuration
export const SCRAPER_CONFIG = {
  DEFAULT_RATE_LIMIT: 300,
  DEFAULT_DETAIL_RATE_LIMIT: 100,
  DEFAULT_BATCH_SIZE: 100,
  MAX_PAGINATION_PAGES: 50,
  DEFAULT_GROUP_ID: '7381fdcf-255d-47a7-b791-cebe05689e60',
  LEVEL1_FULL_CODE: '64'
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 4000,
  TOAST_MAX_VISIBLE: 3,
  TOAST_POSITION: 'top-right',
  DEFAULT_THEME: 'light',
  ENABLE_ANIMATIONS: true
};

// Storage Keys
export const STORAGE_KEYS = {
  CONFIG: 'fasih_config',
  THEME: 'fasih_theme',
  SIDEBAR_COLLAPSED: 'fasih_sidebar_collapsed',
  HISTORY_PREFIX: 'fasih_history_'
};

// History Configuration
export const HISTORY_CONFIG = {
  TTL_MS: 10 * 60 * 1000, // 10 minutes
  MAX_ITEMS: 50
};

// Export Column Definitions
export const EXPORT_COLUMNS = {
  BASIC: [
    'Kode_Identitas',
    'Nama_Kepala_Keluarga',
    'Nama_Anggota_Keluarga_Lain',
    'Alamat',
    'Keberadaan_Keluarga',
    'Status_Alias',
    'User_Saat_Ini',
    'Mode'
  ],
  ADDITIONAL: [
    'Assignment_ID',
    'Kecamatan',
    'Desa',
    'SLS',
    'SUBSLS',
    'Strata',
    'Sample_Type',
    'Date_Created',
    'Date_Modified'
  ]
};

// Survey Types
export const SURVEY_TYPES = ['Pencacahan', 'Pendataan'];

// Survey Roles
export const SURVEY_ROLES = [
  { id: '6d392af0-fa8b-4d5e-8dff-cef279304e0a', name: 'Pencacah' },
  { id: 'b4f6b841-7a33-48a1-be2b-042d866e1938', name: 'Pengawas' }
];

// Cookie Names to Check for Session
export const SESSION_COOKIE_PATTERNS = ['session', 'token', 'xsrf', 'laravel'];

// XSRF Token Cookie Name
export const XSRF_TOKEN_COOKIE = 'XSRF-TOKEN';

// Domain for Cookies
export const COOKIE_DOMAIN = '.bps.go.id';

// Log Levels
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 4
};

// Page Definitions
export const PAGES = {
  DASHBOARD: 'dashboard',
  HISTORY: 'history',
  ALLOCATION: 'allocation',
  SETTINGS: 'settings'
};

// Page Titles
export const PAGE_TITLES = {
  [PAGES.DASHBOARD]: 'Dashboard',
  [PAGES.HISTORY]: 'Scraping History',
  [PAGES.ALLOCATION]: 'User Allocation',
  [PAGES.SETTINGS]: 'API Settings'
};

// Allocation Template Columns
export const ALLOCATION_TEMPLATE_COLUMNS = [
  'PROVINSI',
  'KABUPATEN/KOTA',
  'KECAMATAN',
  'DESA/KELURAHAN',
  'SLS',
  'SUBSLS',
  'Email Pencacah'
];

// Default Allocation Template Data
export const ALLOCATION_TEMPLATE_DATA = [
  {
    'PROVINSI': '64',
    'KABUPATEN/KOTA': '03',
    'KECAMATAN': '081',
    'DESA/KELURAHAN': '003',
    'SLS': '0000',
    'SUBSLS': '00',
    'Email Pencacah': 'user@example.com'
  }
];

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000
};

// Time Constants (milliseconds)
export const TIME_CONSTANTS = {
  HISTORY_TTL_MS: 10 * 60 * 1000, // 10 minutes
  HISTORY_COUNTDOWN_CHECK_MS: 1000, // 1 second
  SESSION_CHECK_DELAY_MS: 1500, // 1.5 seconds
  JWT_STATUS_CHECK_DELAY_MS: 1000, // 1 second
  PROVINCE_DROPDOWN_DELAY_MS: 500, // 0.5 seconds
  FLOATING_STATUS_HIDE_MS: 3000, // 3 seconds
  FLOATING_STATUS_HIDE_ON_FAILURE_MS: 10000, // 10 seconds
  DETAIL_EXPORT_PROGRESS_HIDE_MS: 3000, // 3 seconds
  DETAIL_EXPORT_RATE_LIMIT_MS: 1000, // 1 second between requests
  AKUN_SEARCH_DEBOUNCE_MS: 300, // 0.3 seconds
  TOAST_AUTO_DISMISS_RESULTS_MS: 10000, // 10 seconds
  TOAST_AUTO_DISMISS_WARNING_MS: 15000 // 15 seconds
};

// Mobile/Responsive Breakpoints
export const BREAKPOINTS = {
  MOBILE: 768, // pixels
  SIDEBAR_MOBILE_TOGGLE_MS: 300 // animation duration
};

// JWT Configuration
export const JWT_CONSTANTS = {
  TOKEN_EXPIRY_CHECK_BUFFER_MS: 60 * 60 * 1000, // 1 hour
  MINIMUM_TOKEN_LENGTH: 10, // CommunityBPS cookie value min length
  NIPLAMA_LENGTH: 9 // First 9 digits of CommunityBPS cookie
};

// Table Display Limits
export const TABLE_CONSTANTS = {
  MAX_ROWS_DISPLAY: 100, // Maximum rows shown in tables
  AKUN_MITRA_PER_PAGE_DEFAULT: 10, // Default pagination size
  AKUN_MITRA_FETCH_ALL: 9999 // Magic number for fetching all records
};

// DOM Element IDs
export const DOM_IDS = {
  // Navigation
  CHECK_SESSION_BTN: 'checkSessionBtn',
  // Loading Steps
  LOADING_STEP_INIT: 'step-init',
  LOADING_STEP_AUTH: 'step-auth',
  LOADING_STEP_SURVEYS: 'step-surveys',
  // Session Toast
  SESSION_TOAST: 'sessionToast',
  SESSION_TOAST_CONTENT: 'sessionToastContent',
  SESSION_TOAST_CLOSE: 'sessionToastClose',
  SESSION_TOAST_OPEN_ALL: 'sessionToastOpenAll'
};

// File Download Formats
export const DOWNLOAD_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  DELAY_MS: 3000 // Delay before hiding progress UI
};

// Status/Session Check Configuration
export const SESSION_CHECKS = [
  { key: 'fasih', name: 'FASIH', url: 'https://fasih-sm.bps.go.id', icon: '📊' },
  { key: 'mitra', name: 'Manajemen Mitra', url: 'https://manajemen-mitra.bps.go.id', icon: '👥' },
  { key: 'community', name: 'Community BPS', url: 'https://community.bps.go.id', icon: '🌐' },
  { key: 'simpeg', name: 'SIMPEG Profile', url: 'https://simpeg.bps.go.id', icon: '🏢' },
  { key: 'niplama', name: 'NIP/NIP Lama', url: null, icon: '🔢' }
];

// Loading Step Configuration
export const LOADING_STEPS = {
  INIT: { icon: '⚙️', name: 'Initializing...' },
  AUTH: { icon: '🔐', name: 'Checking Login...' },
  SURVEYS: { icon: '📊', name: 'Loading Data...' }
};

// Export File Naming
export const EXPORT_NAMING = {
  CSV_MIME_TYPE: 'text/csv;charset=utf-8;',
  EXCEL_MIME_TYPE: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  JSON_MIME_TYPE: 'application/json',
  FILENAME_SPECIAL_CHARS_REGEX: /[ /\\]/g,
  DATE_FORMAT_REGEX: /[-/:]/g
};

// Default API Configuration
export const DEFAULT_API_CONFIG = {
  baseUrl: 'https://fasih-sm.bps.go.id',
  modules: API_MODULES,
  endpoints: API_ENDPOINTS
};

// Default Scraper Configuration
export const DEFAULT_SCRAPER_CONFIG = {
  level1FullCode: SCRAPER_CONFIG.LEVEL1_FULL_CODE,
  targetLevel2Id: null,
  targetLevel3Id: null,
  rateLimitMs: SCRAPER_CONFIG.DEFAULT_RATE_LIMIT,
  detailRateLimitMs: SCRAPER_CONFIG.DEFAULT_DETAIL_RATE_LIMIT,
  batchSize: SCRAPER_CONFIG.DEFAULT_BATCH_SIZE,
  maxPaginationPages: SCRAPER_CONFIG.MAX_PAGINATION_PAGES,
  debugMode: true,
  respectUserRegionFilter: true,
  showRegionCodes: true,
  showRequestUrls: true
};

// Default UI Configuration
export const DEFAULT_UI_CONFIG = {
  toastDuration: UI_CONFIG.TOAST_DURATION,
  toastMaxVisible: UI_CONFIG.TOAST_MAX_VISIBLE,
  toastPosition: UI_CONFIG.TOAST_POSITION,
  defaultTheme: UI_CONFIG.DEFAULT_THEME,
  enableAnimations: UI_CONFIG.ENABLE_ANIMATIONS
};