/**
 * FASIH SCRAPPER - Scraper Service
 * Handles data extraction from FASIH API with pagination and rate limiting
 */

import { apiClient } from '../../core/api-client.js';
import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { utils } from '../../core/utils.js';
import { surveyService } from '../surveys/survey-service.js';
import { authService } from '../auth/auth-service.js';
import {
  API_ENDPOINTS,
  SCRAPER_CONFIG,
  EXPORT_COLUMNS
} from '../../constants.js';
import { config } from '../../core/config.js';

class ScraperService {
  constructor() {
    this.isRunning = false;
    this.results = [];
    this.totalRecords = 0;
    this.groupRegionId = null;
    this.userInfo = null;
    this.startTime = null;
    this.timerInterval = null;
  }

  /**
   * Load kecamatan (level 3) regions
   * @param {string} groupId - Group region ID
   * @param {string} level2Id - Kabupaten ID
   * @returns {Promise<Array>} Array of kecamatan
   */
  async loadLevel3(groupId, level2Id) {
    if (!groupId || !level2Id) return [];
    const url = apiClient.buildUrl('region', API_ENDPOINTS.REGION_LEVEL3, { groupId, level2Id });
    const response = await apiClient.get(url, 'Load Kecamatan');
    return apiClient.parseResponse(response, 'data');
  }

  /**
   * Load desa (level 4) regions
   * @param {string} groupId - Group region ID
   * @param {string} level3Id - Kecamatan ID
   * @returns {Promise<Array>} Array of desa
   */
  async loadLevel4(groupId, level3Id) {
    if (!groupId || !level3Id) return [];
    const url = apiClient.buildUrl('region', API_ENDPOINTS.REGION_LEVEL4, { groupId, level3Id });
    const response = await apiClient.get(url, 'Load Desa');
    return apiClient.parseResponse(response, 'data');
  }

  /**
   * Probe API architecture to get region metadata
   * @param {string} surveyPeriodId - Survey period ID
   * @returns {Promise<Object|null>} Architecture info or null
   */
  async probeArchitecture(surveyPeriodId) {
    const probePayload = {
      draw: 1,
      start: 0,
      length: 1,
      search: { value: '', regex: false },
      columns: [{ data: 'id', searchable: true, orderable: false, search: { value: '', regex: false } }],
      order: [{ column: 0, dir: 'asc' }],
      assignmentExtraParam: {
        region1Id: null, region2Id: null, region3Id: null, region4Id: null,
        region5Id: null, region6Id: null, region7Id: null, region8Id: null,
        region9Id: null, region10Id: null,
        surveyPeriodId,
        assignmentErrorStatusType: -1,
        assignmentStatusAlias: null,
        filterTargetType: 'TARGET_ONLY'
      }
    };

    const url = apiClient.buildUrl('analytic', API_ENDPOINTS.EXTRACT);
    const response = await apiClient.post(url, probePayload, 'Probing Arsitektur');
    const searchData = response.searchData || [];
    
    if (searchData.length === 0) return null;

    const sample = searchData[0];
    const groupId = sample.regionMetadata?.id;
    const regionLvl1 = sample.region?.level1 || {};
    const regionLvl2 = regionLvl1.level2 || {};

    return {
      groupId,
      provinsiId: regionLvl1.id,
      provCode: regionLvl1.code || '00',
      provName: utils.cleanRegionName(regionLvl1.name),
      kabupatenId: regionLvl2.id,
      kabCode: regionLvl2.code || '00',
      kabName: utils.cleanRegionName(regionLvl2.name)
    };
  }

  /**
   * Fetch detailed assignment data
   * @param {string} assignmentId - Assignment ID
   * @param {string} mode - Extraction mode (basic/ekstra/detail)
   * @returns {Promise<Object>} Extra data object
   */
  async fetchAssignmentDetail(assignmentId, mode) {
    if (mode === 'basic') return {};

    const url = apiClient.buildUrl('assignment', API_ENDPOINTS.ASSIGNMENT_BY_ID, { assignmentId });
    
    try {
      const response = await apiClient.get(url, 'Detail Assignment');
      const data = response.data || {};
      const extraData = {};

      // Parse pre_defined_data (for Ekstra and Detail modes)
      const rawPreDef = data.pre_defined_data;
      if (rawPreDef) {
        try {
          const preDef = JSON.parse(rawPreDef);
          for (const item of (preDef.predata || [])) {
            const key = item.dataKey || '';
            let val = item.answer || '';
            if (Array.isArray(val)) val = val.map(v => v.label || v).join(', ');
            extraData[`Pre_${key}`] = val;
          }
        } catch (e) {
          Logger.warn('[Scraper] pre_defined_data parse error:', e.message);
        }
      }

      // Parse answers data (only for Detail mode)
      if (mode === 'detail') {
        const rawData = data.data;
        if (rawData) {
          try {
            const dataParsed = JSON.parse(rawData);
            for (const ans of (dataParsed.answers || [])) {
              const key = ans.dataKey || '';
              let val = ans.answer || '';
              if (Array.isArray(val)) val = val.map(v => v.label || v).join(', ');
              extraData[`Ans_${key}`] = val;
            }
          } catch (e) {
            Logger.warn('[Scraper] answers parse error:', e.message);
          }
        }
      }

      await utils.sleep(config.getScraper().detailRateLimitMs || SCRAPER_CONFIG.DEFAULT_DETAIL_RATE_LIMIT);
      return extraData;
    } catch (err) {
      Logger.warn('[Scraper] Detail fetch error:', err.message);
      return {};
    }
  }

  /**
   * Extract data for a specific desa
   * @param {string} surveyPeriodId - Survey period ID
   * @param {Object} regionIds - Region IDs object
   * @param {string} mode - Extraction mode
   * @param {Object} kecInfo - Kecamatan info
   * @param {Object} desaInfo - Desa info
   * @returns {Promise<Array>} Array of extracted data
   */
  async extractData(surveyPeriodId, regionIds, mode, kecInfo, desaInfo) {
    const url = apiClient.buildUrl('analytic', API_ENDPOINTS.EXTRACT);
    const allData = [];
    const scraperConfig = config.getScraper();
    const maxPages = scraperConfig.maxPaginationPages || SCRAPER_CONFIG.MAX_PAGINATION_PAGES;
    const batchSize = scraperConfig.batchSize || SCRAPER_CONFIG.DEFAULT_BATCH_SIZE;

    for (let startIdx = 0; startIdx < maxPages * batchSize; startIdx += batchSize) {
      const payload = {
        draw: Math.floor(startIdx / batchSize) + 1,
        start: startIdx,
        length: batchSize,
        search: { value: '', regex: false },
        columns: [
          { data: 'id', searchable: true, orderable: false, search: { value: '', regex: false } },
          { data: 'codeIdentity', searchable: true, orderable: false, search: { value: '', regex: false } },
          { data: 'data1', searchable: true, orderable: true, search: { value: '', regex: false } },
          { data: 'data2', searchable: true, orderable: true, search: { value: '', regex: false } },
          { data: 'data3', searchable: true, orderable: true, search: { value: '', regex: false } },
          { data: 'data4', searchable: true, orderable: true, search: { value: '', regex: false } }
        ],
        order: [{ column: 0, dir: 'asc' }],
        assignmentExtraParam: {
          region1Id: regionIds.provinsiId,
          region2Id: regionIds.kabupatenId,
          region3Id: kecInfo.id,
          region4Id: desaInfo.id,
          region5Id: null, region6Id: null, region7Id: null, region8Id: null,
          region9Id: null, region10Id: null,
          surveyPeriodId,
          assignmentErrorStatusType: -1,
          assignmentStatusAlias: null,
          data1: null, data2: null, data3: null, data4: null,
          data5: null, data6: null, data7: null, data8: null,
          data9: null, data10: null,
          userIdResponsibility: null,
          currentUserId: null,
          filterTargetType: 'TARGET_ONLY'
        }
      };

      try {
        const label = startIdx === 0 ? 'Data Penugasan' : '';
        const response = await apiClient.post(url, payload, label);
        const searchData = response.searchData || [];
        
        if (searchData.length === 0) break;

        for (const item of searchData) {
          const regInfo = item.region || {};
          const lvl3 = regInfo.level1?.level2?.level3 || {};
          const lvl4 = regInfo.level1?.level2?.level3?.level4 || {};
          const lvl5 = regInfo.level1?.level2?.level3?.level4?.level5 || {};
          const lvl6 = regInfo.level1?.level2?.level3?.level4?.level5?.level6 || {};

          // 8 main columns (left) + additional columns (right)
          const row = {
            'Kode_Identitas': item.codeIdentity || '',
            'Nama_Kepala_Keluarga': item.data1 || '',
            'Nama_Anggota_Keluarga_Lain': item.data2 || '',
            'Alamat': item.data3 || '',
            'Keberadaan_Keluarga': item.data4 || '',
            'Status_Alias': item.assignmentStatusAlias || '',
            'User_Saat_Ini': item.currentUserFullname || '',
            'Mode': Array.isArray(item.mode) ? item.mode.join(', ') : (item.mode || ''),
            'Assignment_ID': item.id || '',
            'Kecamatan': utils.cleanRegionName(lvl3.name || ''),
            'Desa': utils.cleanRegionName(lvl4.name || ''),
            'SLS': utils.cleanRegionName(lvl5.name || ''),
            'SUBSLS': utils.cleanRegionName(lvl6.name || ''),
            'Strata': item.strata || '',
            'Sample_Type': item.sampleType || '',
            'Date_Created': item.dateCreated || '',
            'Date_Modified': item.dateModified || ''
          };

          if (mode !== 'basic') {
            const extraData = await this.fetchAssignmentDetail(item.id, mode);
            Object.assign(row, extraData);
          }

          allData.push(row);
        }

        await utils.sleep(scraperConfig.rateLimitMs || SCRAPER_CONFIG.DEFAULT_RATE_LIMIT);
      } catch (err) {
        Logger.error('[Scraper] Pagination error:', err.message);
        break;
      }
    }

    return allData;
  }

  /**
   * Start elapsed time timer
   */
  startTimer() {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      eventBus.emit('scraper:timer', { elapsed, formatted: utils.formatDuration(elapsed) });
    }, 1000);
  }

  /**
   * Stop elapsed time timer
   * @returns {number} Elapsed time in seconds
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Start scraping process
   * @param {Object} surveyConfig - Survey configuration
   * @param {string} mode - Extraction mode (basic/ekstra/detail)
   * @returns {Promise<Array>} Array of scraped results
   */
  async scrape(surveyConfig, mode) {
    this.isRunning = true;
    this.results = [];
    this.totalRecords = 0;
    this.startTimer();
    
    eventBus.emit('scraper:start', { survey: surveyConfig, mode });

    try {
      const { id: surveyId } = surveyConfig;
      const periods = await surveyService.getPeriods(surveyId);
      
      if (periods.length === 0) {
        eventBus.emit('scraper:error', { message: 'No periods found' });
        return [];
      }

      const periodeId = periods[0].id;
      eventBus.emit('scraper:period', { id: periodeId, name: periods[0].name });

      this.userInfo = await authService.getUserInfo(periodeId);
      const archInfo = await this.probeArchitecture(periodeId);

      if (!archInfo) {
        eventBus.emit('scraper:error', { message: 'No data found' });
        return [];
      }

      this.groupRegionId = archInfo.groupId;
      eventBus.emit('scraper:architecture', archInfo);

      const kecamatans = await this.loadLevel3(archInfo.groupId, archInfo.kabupatenId);
      
      if (kecamatans.length === 0) {
        eventBus.emit('scraper:error', { message: 'No kecamatan found' });
        return [];
      }

      // Count total desa
      let totalDesa = 0;
      for (const kec of kecamatans) {
        const desas = await this.loadLevel4(archInfo.groupId, kec.id);
        totalDesa += desas.length;
      }

      eventBus.emit('scraper:progress', { totalKec: kecamatans.length, totalDesa });

      let processedDesa = 0;
      let kecCount = 0;
      const scraperConfig = config.getScraper();

      for (const kec of kecamatans) {
        if (!this.isRunning) break;
        
        kecCount++;
        const desas = await this.loadLevel4(archInfo.groupId, kec.id);
        if (desas.length === 0) continue;

        const kecCode = kec.code || kec.fullCode || '-';
        const kecNameClean = utils.cleanRegionName(kec.name);
        const kecDisplay = scraperConfig.showRegionCodes 
          ? `[${kecCode}] ${kecNameClean.toUpperCase()}` 
          : kecNameClean.toUpperCase();

        eventBus.emit('scraper:kecamatan', {
          index: kecCount,
          total: kecamatans.length,
          name: kecDisplay,
          desaCount: desas.length
        });

        for (const [desaIdx, desa] of desas.entries()) {
          if (!this.isRunning) break;

          processedDesa++;
          const desaCode = desa.code || '-';
          const desaNameClean = utils.cleanRegionName(desa.name);
          const kecInfo = { id: kec.id, cleanName: kecNameClean };
          const desaInfo = { id: desa.id, cleanName: desaNameClean };

          try {
            const data = await this.extractData(periodeId, archInfo, mode, kecInfo, desaInfo);
            const count = data.length;

            if (count > 0) {
              for (const row of data) {
                if (!this.results.find(r => r.Kode_Identitas === row.Kode_Identitas)) {
                  this.results.push(row);
                  this.totalRecords++;
                }
              }
            }

            const padDesa = utils.pad(desaIdx + 1, 2, ' ');
            const padTotal = utils.pad(desas.length, 2, ' ');
            const padCount = utils.pad(count, 3, ' ');
            const desaLabel = scraperConfig.showRegionCodes
              ? `Desa [${desaCode}] ${desaNameClean}`
              : `Desa ${desaNameClean}`;

            eventBus.emit('scraper:desa', {
              label: desaLabel.padEnd(40, ' '),
              current: desaIdx + 1,
              total: desas.length,
              count,
              id: desa.id
            });

            eventBus.emit('scraper:progress', {
              processedDesa,
              totalDesa,
              totalRecords: this.totalRecords,
              percent: Math.round((processedDesa / totalDesa) * 100)
            });
          } catch (err) {
            eventBus.emit('scraper:desa_error', { name: desaNameClean, error: err.message });
          }
        }
      }

      const duration = this.stopTimer();
      eventBus.emit('scraper:complete', { totalRecords: this.totalRecords, results: this.results, duration });
      return this.results;
    } catch (err) {
      this.stopTimer();
      eventBus.emit('scraper:error', err);
      return [];
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop scraping process
   */
  stop() {
    this.isRunning = false;
    this.stopTimer();
    eventBus.emit('scraper:stop');
  }

  /**
   * Get current results
   * @returns {Array} Current results
   */
  getResults() {
    return this.results;
  }

  /**
   * Get total records count
   * @returns {number} Total records
   */
  getTotalRecords() {
    return this.totalRecords;
  }

  /**
   * Check if scraping is running
   * @returns {boolean} True if scraping is running
   */
  isScraping() {
    return this.isRunning;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();