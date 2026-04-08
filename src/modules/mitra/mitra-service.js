/**
 * BPS Automation v5.0 - Mitra Service
 * Handles all Manajemen Mitra API interactions with JWT Bearer token
 */

import { Logger } from '../../core/logger.js';
import { eventBus } from '../../core/event-bus.js';
import { sleep } from '../../core/utils.js';

  class MitraService {
  constructor() {
    this.baseUrl = 'https://mitra-api.bps.go.id';
    this.penggunaBaseUrl = 'https://mitra-pengguna-api.bps.go.id';
    this.communityUrl = 'https://community.bps.go.id';
    this.kdProv = '64'; // Default: Kalimantan Timur
    this.kdKab = '03'; // Default: Kutai Kartanegara
    this.mitraKepkaData = [];
    this.mitraScrapData = [];
    this.seleksiData = [];
    this.akunMitraData = [];
    this.akunMitraPage = 1;
    this.akunMitraPerPage = 50;
    this.selectedMitraId = null;
    this.cachedJwtToken = null;
    this.rateLimitMs = 1000; // 1 second delay between requests (matching Python time.sleep(1))
  }

  /**
   * Get JWT Bearer token from extension storage
   * Token is extracted by content script from manajemen-mitra.bps.go.id
   * @returns {Promise<string|null>} JWT token or null
   */
  async getJwtToken() {
    // Return cached token if available
    if (this.cachedJwtToken) {
      return this.cachedJwtToken;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getJwtToken' }, (response) => {
        if (chrome.runtime.lastError) {
          Logger.warn('[Mitra] Failed to get JWT from storage:', chrome.runtime.lastError.message);
        }
        this.cachedJwtToken = response?.token || null;
        resolve(this.cachedJwtToken);
      });
    });
  }

  /**
   * Build headers with JWT Bearer token (matching Python script headers)
   * @param {Object} extraHeaders - Additional headers to include
   * @returns {Promise<Object>} Headers object with Authorization
   */
  async buildHeaders(extraHeaders = {}) {
    const jwt = await this.getJwtToken();
    return {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': 'https://manajemen-mitra.bps.go.id',
      'Referer': 'https://manajemen-mitra.bps.go.id/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      ...extraHeaders,
      ...(jwt && { 'Authorization': `Bearer ${jwt}` })
    };
  }

  /**
   * Get profile image URL - Fallback to local icon
   * community.bps.go.id returns ERR_CONNECTION_RESET
   */
  getProfileImage() {
    // Return local icon as fallback since community.bps.go.id is inaccessible
    return 'icons/icon128.png';
  }

  /**
   * Get RE (Rekening) list - contains survei and kegiatan info for wilayah
   * @param {string} kdProv - Province code
   * @param {string} kdKab - Kabupaten code
   * @returns {Promise<Array>} List of survei/kegiatan
   */
  async getReList(kdProv, kdKab) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.penggunaBaseUrl}/api/wilayah/re/list/${kdProv}/${kdKab}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.rekList || [];
    } catch (err) {
      Logger.error('Failed to get RE list:', err.message);
      return [];
    }
  }

  /**
   * Get Provinsi list
   */
  async getProvinsi() {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.penggunaBaseUrl}/api/wilayah/prov`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.provinsiList || [];
    } catch (err) {
      Logger.error('Failed to get provinsi:', err.message);
      return [];
    }
  }

  /**
   * Get Kabupaten list by provinsi
   * Note: This endpoint may not be available on all servers
   */
  async getKabupaten(kdProv) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.penggunaBaseUrl}/api/wilayah/kab/${kdProv}`, {
        credentials: 'include',
        headers
      });
      if (!response.ok) {
        Logger.info('[Mitra] Kabupaten endpoint not available, using silent fallback');
        return [];
      }
      const data = await response.json();
      return data.kabupatenList || data.kabkotaList || [];
    } catch (err) {
      // Silent fallback - kabupaten is optional, keep default kdKab
      Logger.info('[Mitra] Kabupaten API unavailable, keeping default kdKab');
      return [];
    }
  }

  /**
   * Get Kecamatan list (RE list)
   */
  async getKecamatan(kdProv, kdKab) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.penggunaBaseUrl}/api/wilayah/re/list/${kdProv}/${kdKab}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.rekList || [];
    } catch (err) {
      Logger.error('Failed to get kecamatan:', err.message);
      return [];
    }
  }

  /**
   * Get Survei list by kegiatan
   */
  async getSurveiList(idKeg) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/survei/list/${idKeg}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.surveis || [];
    } catch (err) {
      Logger.error('Failed to get survei:', err.message);
      return [];
    }
  }

  /**
   * Get Kegiatan list
   */
  async getKegiatanList(kdSurvei, level, page, status) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/keg/list/ks/${kdSurvei}/${level}/${page}/${status}?p=${this.kdProv}&k=${this.kdKab}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.keg_surveis || [];
    } catch (err) {
      Logger.error('Failed to get kegiatan:', err.message);
      return [];
    }
  }

  /**
   * Get Mitra KEPKA list
   */
  async getMitraKepka(tahun, kdProv, kdKab) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/mitra-kepka/by-year-wil/${tahun}/${kdProv}/${kdKab}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      this.mitraKepkaData = data.mitras || [];
      eventBus.emit('mitra:kepka_loaded', { count: this.mitraKepkaData.length, data: this.mitraKepkaData });
      return this.mitraKepkaData;
    } catch (err) {
      Logger.error('Failed to get mitra KEPKA:', err.message);
      eventBus.emit('mitra:error', { message: err.message });
      return [];
    }
  }

  /**
   * Get Mitra detail by ID
   */
  async getMitraDetail(idMitra) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/mitra/id/${idMitra}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.mitra || null;
    } catch (err) {
      Logger.error('Failed to get mitra detail:', err.message);
      return null;
    }
  }

  /**
   * Get Mitra history survei
   */
  async getMitraHistory(idMitra, tahun) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/mitra/hist/sm/${idMitra}?tahun=${tahun}&prev=false`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data.smds || [];
    } catch (err) {
      Logger.error('Failed to get mitra history:', err.message);
      return [];
    }
  }

  /**
   * Get Mitra list for survei (Scrapping)
   */
  async getMitraList(kdSurvei, idKeg) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/mitra/listv3/${kdSurvei}/${idKeg}/${this.kdProv}/${this.kdKab}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      this.mitraScrapData = data || [];
      eventBus.emit('mitra:scrap_loaded', { count: this.mitraScrapData.length, data: this.mitraScrapData });
      return this.mitraScrapData;
    } catch (err) {
      Logger.error('Failed to get mitra list:', err.message);
      eventBus.emit('mitra:error', { message: err.message });
      return [];
    }
  }

  /**
   * Get Akun Mitra (paginated)
   * @param {number} page - Page number
   * @param {number} perPage - Items per page
   * @param {string} search - Search query
   * @param {string} sortField - Sort field
   * @param {string} sortOrder - Sort order (asc/desc)
   * @param {string} kdProv - Province code (optional, uses default if not provided)
   * @param {string} kdKab - Kabupaten code (optional, uses default if not provided)
   */
  async getAkunMitra(page = 1, perPage = 50, search = '', sortField = 'username', sortOrder = 'asc', kdProv = null, kdKab = null) {
    try {
      const prov = kdProv || this.kdProv;
      const kab = kdKab || this.kdKab;
      
      const params = new URLSearchParams({
        idprov: prov,
        idkab: kab
      });

      const bodyParams = new FormData();
      bodyParams.append('idprov', prov);
      bodyParams.append('idkab', kab);
      bodyParams.append('params', JSON.stringify({
        onlyDummy: false,
        word: search,
        sort: [{ field: sortField, type: sortOrder }],
        page,
        perPage
      }));

      const headers = await this.buildHeaders();
      delete headers['Content-Type']; // Let browser set it for FormData

      const response = await fetch(`${this.baseUrl}/api/mitra/serversidetable?${params.toString()}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: bodyParams
      });
      await this.handleResponseError(response);
      const data = await response.json();
      this.akunMitraData = data.data || [];
      this.akunMitraPage = page;
      eventBus.emit('mitra:akun_loaded', { count: this.akunMitraData.length, page, data: this.akunMitraData });
      return this.akunMitraData;
    } catch (err) {
      Logger.error('Failed to get akun mitra:', err.message);
      eventBus.emit('mitra:error', { message: err.message });
      return [];
    }
  }

  /**
   * Get exam status for kegiatan
   */
  async getExamStatus(kdSurvei, idKeg) {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.baseUrl}/api/keg/ks/exam-status/${kdSurvei}/${idKeg}`, {
        credentials: 'include',
        headers
      });
      await this.handleResponseError(response);
      const data = await response.json();
      return data || { status: false, list_exam_id: [], list_remidi_id: [] };
    } catch (err) {
      Logger.error('Failed to get exam status:', err.message);
      return { status: false, list_exam_id: [], list_remidi_id: [] };
    }
  }

  /**
   * Handle API response errors
   * @param {Response} response - Fetch response
   */
  async handleResponseError(response) {
    if (response.status === 401) {
      const errorBody = await response.text().catch(() => '');
      const errorMessage = errorBody || 'Unauthorized - JWT token may be expired';
      Logger.warn('[Mitra] 401 Unauthorized:', errorMessage);
      // Clear cached token so next request fetches fresh one
      this.cachedJwtToken = null;
      throw new Error(`HTTP 401: ${errorMessage}. Please refresh manajemen-mitra.bps.go.id to get new JWT.`);
    }
    if (response.status === 403) {
      const errorBody = await response.text().catch(() => '');
      let errorMessage = 'Forbidden - Access denied';
      try {
        const json = JSON.parse(errorBody);
        if (json.errors) {
          errorMessage = JSON.stringify(json.errors);
        }
      } catch {}
      Logger.warn('[Mitra] 403 Forbidden:', errorMessage);
      
      // Check if JWT exists
      const jwt = await this.getJwtToken();
      if (!jwt) {
        throw new Error(`HTTP 403: ${errorMessage}. No JWT token found. Please login to manajemen-mitra.bps.go.id or paste JWT manually in Settings.`);
      }
      
      // Decode JWT to check expiry
      try {
        const parts = jwt.split('.');
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          throw new Error(`HTTP 403: JWT expired (${new Date(payload.exp * 1000).toLocaleString()}). Please re-login to manajemen-mitra.bps.go.id to get new JWT.`);
        }
        // Token not expired, might be permission issue
        const wilayah = payload.w || 'unknown';
        const type = payload.type || 'unknown';
        throw new Error(`HTTP 403: ${errorMessage}. JWT valid but access denied. User type: ${type}, Wilayah: ${JSON.stringify(wilayah)}. You may not have permission for this endpoint.`);
      } catch (decodeErr) {
        if (decodeErr.message.startsWith('HTTP 403')) {
          throw decodeErr;
        }
        throw new Error(`HTTP 403: ${errorMessage}. JWT decode error. Please check your token.`);
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Export Mitra KEPKA to CSV
   */
  exportKepkaToCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = ['NIK', 'Nama Lengkap', 'Email', 'Posisi', 'Status', 'Kabupaten', 'Provinsi'];
    const rows = data.map(m => [
      m.mitra_detail?.nik || '-',
      m.mitra_detail?.nama_lengkap || '-',
      m.mitra_detail?.email || '-',
      m.nama_pos || '-',
      m.ket_status || '-',
      m.kd_kab || '-',
      m.kd_prov || '-'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    this.downloadFile(csvContent, `${filename}_kepka.csv`, 'text/csv');
  }

  /**
   * Export Mitra KEPKA to Excel
   */
  exportKepkaToExcel(data, filename) {
    if (!data || data.length === 0) return;
    const rows = data.map(m => ({
      'NIK': m.mitra_detail?.nik || '-',
      'Nama Lengkap': m.mitra_detail?.nama_lengkap || '-',
      'Email': m.mitra_detail?.email || '-',
      'Posisi': m.nama_pos || '-',
      'Status': m.ket_status || '-',
      'Kabupaten': m.kd_kab || '-',
      'Provinsi': m.kd_prov || '-'
    }));
    const ws = window.XLSX?.utils.json_to_sheet(rows);
    if (!ws) return;
    const wb = window.XLSX?.utils.book_new();
    window.XLSX?.utils.book_append_sheet(wb, ws, 'Mitra KEPKA');
    window.XLSX?.writeFile(wb, `${filename}_kepka.xlsx`);
  }

  /**
   * Export Mitra KEPKA Detail (more fields than Basic)
   */
  exportKepkaDetailToCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = ['NIK', 'Nama Lengkap', 'Email', 'No Telp', 'Alamat', 'Kota', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Posisi', 'Status', 'Pendidikan', 'Pengalaman', 'Tanggal Daftar'];
    const rows = data.map(m => {
      const d = m.mitra_detail || {};
      return [
        d.nik || '-',
        d.nama_lengkap || '-',
        d.email || '-',
        d.no_telp || '-',
        d.alamat || '-',
        d.kota || '-',
        d.provinsi || '-',
        d.kabupaten || '-',
        d.kecamatan || '-',
        m.nama_pos || '-',
        m.ket_status || '-',
        d.pendidikan || '-',
        d.pengalaman || '-',
        m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    this.downloadFile(csvContent, `${filename}_kepka_detail.csv`, 'text/csv');
  }

  /**
   * Export Mitra KEPKA Detail to Excel
   */
  exportKepkaDetailToExcel(data, filename) {
    if (!data || data.length === 0) return;
    const rows = data.map(m => {
      const d = m.mitra_detail || {};
      return {
        'NIK': d.nik || '-',
        'Nama Lengkap': d.nama_lengkap || '-',
        'Email': d.email || '-',
        'No Telp': d.no_telp || '-',
        'Alamat': d.alamat || '-',
        'Kota': d.kota || '-',
        'Provinsi': d.provinsi || '-',
        'Kabupaten': d.kabupaten || '-',
        'Kecamatan': d.kecamatan || '-',
        'Posisi': m.nama_pos || '-',
        'Status': m.ket_status || '-',
        'Pendidikan': d.pendidikan || '-',
        'Pengalaman': d.pengalaman || '-',
        'Tanggal Daftar': m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
      };
    });
    const ws = window.XLSX?.utils.json_to_sheet(rows);
    if (!ws) return;
    const wb = window.XLSX?.utils.book_new();
    window.XLSX?.utils.book_append_sheet(wb, ws, 'Mitra KEPKA Detail');
    window.XLSX?.writeFile(wb, `${filename}_kepka_detail.xlsx`);
  }

  /**
   * Export Akun Mitra to CSV
   */
  exportAkunToCSV(data, filename) {
    if (!data || data.length === 0) return;
    const headers = ['Username', 'Email', 'Nama Lengkap', 'NIK', 'Status', 'Tanggal Daftar'];
    const rows = data.map(m => [
      m.username || '-',
      m.email || '-',
      m.nama_lengkap || '-',
      m.nik || '-',
      m.status === '1' ? 'Aktif' : 'Nonaktif',
      m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    this.downloadFile(csvContent, `${filename}_akun.csv`, 'text/csv');
  }

  /**
   * Export Akun Mitra to Excel
   */
  exportAkunToExcel(data, filename) {
    if (!data || data.length === 0) return;
    const rows = data.map(m => ({
      'Username': m.username || '-',
      'Email': m.email || '-',
      'Nama Lengkap': m.nama_lengkap || '-',
      'NIK': m.nik || '-',
      'Status': m.status === '1' ? 'Aktif' : 'Nonaktif',
      'Tanggal Daftar': m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
    }));
    const ws = window.XLSX?.utils.json_to_sheet(rows);
    if (!ws) return;
    const wb = window.XLSX?.utils.book_new();
    window.XLSX?.utils.book_append_sheet(wb, ws, 'Akun Mitra');
    window.XLSX?.writeFile(wb, `${filename}_akun.xlsx`);
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Check if user is logged in to Manajemen Mitra
   */
  async checkMitraLogin() {
    try {
      const headers = await this.buildHeaders();
      const response = await fetch(`${this.penggunaBaseUrl}/api/wilayah/prov`, {
        credentials: 'include',
        headers
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Store JWT manually (for fallback manual input)
   */
  async storeJwtManually(token) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveJwtToken',
        token: token,
        timestamp: Date.now()
      }, () => {
        this.cachedJwtToken = token;
        resolve({ success: true });
      });
    });
  }
}

// Export singleton instance
export const mitraService = new MitraService();