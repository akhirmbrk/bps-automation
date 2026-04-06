/**
 * FASIH SCRAPPER - Allocation Service
 * Handles user allocation by parsing Excel files and assigning users to regions
 */

import { apiClient } from '../../core/api-client.js';
import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { utils } from '../../core/utils.js';
import {
  API_ENDPOINTS,
  API_MODULES,
  SCRAPER_CONFIG,
  SURVEY_ROLES
} from '../../constants.js';
import { config } from '../../core/config.js';

class AllocationService {
  constructor() {
    this.uploadedData = [];
    this.regionCache = {};
    this.userCache = {};
    this.groupId = SCRAPER_CONFIG.DEFAULT_GROUP_ID;
  }

  /**
   * Parse Excel file to allocation data
   * @param {File} file - Excel file to parse
   * @returns {Promise<Array>} Parsed allocation data
   */
  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          // Normalize column names
          const normalized = json.map(row => ({
            provinsi: String(row['PROVINSI'] || row['provinsi'] || '').padStart(2, '0'),
            kabupaten: String(row['KABUPATEN'] || row['KABUPATEN/KOTA'] || row['kabupaten'] || '').padStart(2, '0'),
            kecamatan: String(row['KECAMATAN'] || row['kecamatan'] || '').padStart(3, '0'),
            desa: String(row['DESA'] || row['DESA/KELURAHAN'] || row['desa'] || '').padStart(3, '0'),
            sls: String(row['SLS'] || row['sls'] || '').padStart(4, '0'),
            subsls: String(row['SUBSLS'] || row['SUBSLS'] || row['subsls'] || '').padStart(2, '0'),
            email: String(row['Email'] || row['Email Pencacah'] || row['email'] || '').trim()
          })).filter(r => r.email && r.provinsi && r.kabupaten);

          resolve(normalized);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Get level regions with caching
   * @param {number} level - Region level (1-6)
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of regions
   */
  async getLevelRegions(level, params) {
    const cacheKey = `${level}_${JSON.stringify(params)}`;
    if (this.regionCache[cacheKey]) return this.regionCache[cacheKey];

    const url = apiClient.buildUrl('region', `/region/level${level}`, params);
    const response = await apiClient.get(url, `Level ${level} Regions`);
    const data = response.data || [];
    this.regionCache[cacheKey] = data;
    return data;
  }

  /**
   * Resolve region hierarchy for a row
   * @param {string} groupId - Group region ID
   * @param {Object} row - Allocation row data
   * @returns {Object|null} Region info or null if not found
   */
  async resolveRegionHierarchy(groupId, row) {
    const fullCode = row.provinsi + row.kabupaten + row.kecamatan + row.desa + row.sls + row.subsls;

    // Level 1: Provinsi
    const provList = await this.getLevelRegions(1, { groupId });
    const prov = provList.find(p => p.code === row.provinsi);
    if (!prov) return null;

    // Level 2: Kabupaten
    const kabList = await this.getLevelRegions(2, { groupId, level1FullCode: prov.fullCode });
    const kab = kabList.find(k => k.code === row.kabupaten);
    if (!kab) return null;

    // Level 3: Kecamatan
    const kecList = await this.getLevelRegions(3, { groupId, level2Id: kab.id });
    const kec = kecList.find(k => k.code === row.kecamatan);
    if (!kec) return null;

    // Level 4: Desa
    const desaList = await this.getLevelRegions(4, { groupId, level3Id: kec.id });
    const desa = desaList.find(d => d.code === row.desa);
    if (!desa) return null;

    // Level 5: SLS
    const slsList = await this.getLevelRegions(5, { groupId, level4Id: desa.id });
    const sls = slsList.find(s => s.code === row.sls);
    if (!sls) return null;

    // Level 6: SUBSLS
    const subslsList = await this.getLevelRegions(6, { groupId, level5Id: sls.id });
    const subsls = subslsList.find(s => s.code === row.subsls);
    if (!subsls) return null;

    return {
      smallestRegionCode: fullCode,
      regionCode: prov.fullCode + kab.fullCode,
      provId: prov.id,
      kabId: kab.id,
      kecId: kec.id,
      desaId: desa.id,
      slsId: sls.id,
      subslsId: subsls.id
    };
  }

  /**
   * Resolve user by email
   * @param {string} email - User email
   * @param {string} surveyPeriodId - Survey period ID
   * @returns {Object|null} User object or null
   */
  async resolveUserByEmail(email, surveyPeriodId) {
    const cacheKey = `${email}_${surveyPeriodId}`;
    if (this.userCache[cacheKey]) return this.userCache[cacheKey];

    const baseUrl = config.getApi().baseUrl;
    const url = `${baseUrl}${API_MODULES.SURVEY}/users/emails/${encodeURIComponent(email)}?surveyPeriodId=${surveyPeriodId}`;
    
    try {
      const response = await apiClient.get(url, `Resolve User: ${email}`);
      const users = response.data || [];
      if (users.length > 0) {
        this.userCache[cacheKey] = users[0];
        return users[0];
      }
      return null;
    } catch (e) {
      Logger.warn(`[Allocation] User not found: ${email}`, e.message);
      return null;
    }
  }

  /**
   * Set uploaded data
   * @param {Array} data - Allocation data
   */
  setUploadedData(data) {
    this.uploadedData = data;
  }

  /**
   * Get uploaded data
   * @returns {Array} Uploaded data
   */
  getUploadedData() {
    return this.uploadedData;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.regionCache = {};
    this.userCache = {};
    this.uploadedData = [];
  }

  /**
   * Allocate users one by one with progress
   * @param {string} surveyPeriodId - Survey period ID
   * @param {string} surveyRoleId - Survey role ID
   * @param {Object} options - Allocation options
   * @param {boolean} options.overwrite - Overwrite existing assignments
   * @param {boolean} options.directAssign - Direct assign
   * @param {number} options.rateLimit - Rate limit in ms
   * @returns {Promise<boolean>} True if all allocations successful
   */
  async allocateUsers(surveyPeriodId, surveyRoleId, options = {}) {
    const { overwrite = false, directAssign = true, rateLimit = 500 } = options;

    if (this.uploadedData.length === 0) {
      eventBus.emit('allocation:error', { message: 'No data uploaded' });
      return false;
    }

    eventBus.emit('allocation:start', { totalRows: this.uploadedData.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.uploadedData.length; i++) {
      const row = this.uploadedData[i];
      const progress = Math.round(((i + 1) / this.uploadedData.length) * 100);

      eventBus.emit('allocation:progress', {
        current: i + 1,
        total: this.uploadedData.length,
        percent: progress,
        email: row.email,
        region: `${row.provinsi}${row.kabupaten}${row.kecamatan}${row.desa}${row.sls}${row.subsls}`
      });

      try {
        // Resolve region hierarchy
        const regionInfo = await this.resolveRegionHierarchy(this.groupId, row);
        if (!regionInfo) {
          failCount++;
          eventBus.emit('allocation:row_error', { email: row.email, error: 'Region not found' });
          continue;
        }

        // Resolve user by email
        const user = await this.resolveUserByEmail(row.email, surveyPeriodId);
        if (!user) {
          failCount++;
          eventBus.emit('allocation:row_error', { email: row.email, error: 'User not found' });
          continue;
        }

        // Build payload for single row
        const payload = {
          surveyPeriodId,
          surveyRoleId,
          overwrite,
          isPetugas: true,
          directAssign,
          usersRegion: [{
            users: [row.email],
            smallestRegionCode: regionInfo.smallestRegionCode,
            regionCode: regionInfo.regionCode
          }]
        };

        // Send request
        const baseUrl = config.getApi().baseUrl;
        const url = `${baseUrl}${API_MODULES.SURVEY}/survey-period-role-users/`;
        const response = await apiClient.post(url, payload, `Allocate ${row.email}`);

        if (response.success) {
          successCount++;
          eventBus.emit('allocation:row_success', {
            email: row.email,
            region: regionInfo.smallestRegionCode,
            current: i + 1,
            total: this.uploadedData.length
          });
        } else {
          failCount++;
          eventBus.emit('allocation:row_error', { email: row.email, error: response.message });
        }

        // Rate limit between requests
        await utils.sleep(rateLimit);
      } catch (err) {
        failCount++;
        eventBus.emit('allocation:row_error', { email: row.email, error: err.message });
      }
    }

    eventBus.emit('allocation:complete', {
      total: this.uploadedData.length,
      success: successCount,
      failed: failCount
    });

    return failCount === 0;
  }

  /**
   * Get survey roles
   * @returns {Array} Survey roles
   */
  getSurveyRoles() {
    return SURVEY_ROLES;
  }
}

// Export singleton instance
export const allocationService = new AllocationService();