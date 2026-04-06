/**
 * FASIH SCRAPPER - Survey Service
 * Handles survey loading, selection, and period management
 */

import { apiClient } from '../../core/api-client.js';
import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { API_ENDPOINTS, SURVEY_TYPES } from '../../constants.js';

class SurveyService {
  constructor() {
    this.surveys = [];
    this.selectedSurvey = null;
  }

  /**
   * Load all surveys from API
   * @returns {Promise<Array>} Array of surveys
   */
  async loadSurveys() {
    try {
      eventBus.emit('surveys:loading');
      let loadedSurveys = [];

      for (const surveyType of SURVEY_TYPES) {
        const url = apiClient.buildUrl('survey', API_ENDPOINTS.SURVEYS, { surveyType });
        const payload = {
          pageNumber: 0,
          pageSize: 50,
          sortBy: 'CREATED_AT',
          sortDirection: 'DESC',
          keywordSearch: ''
        };

        try {
          const response = await apiClient.post(url, payload, `Load ${surveyType}`);
          Logger.debug(`[Surveys] Raw response for ${surveyType}:`, JSON.stringify(response, null, 2));
          
          const surveysData = response?.data?.content || [];
          Logger.debug(`[Surveys] Parsed surveys for ${surveyType}:`, surveysData.length, 'items');
          
          if (surveysData.length > 0) {
            loadedSurveys = surveysData;
            break;
          }
        } catch (e) {
          Logger.warn(`[Surveys] Failed to load ${surveyType}:`, e.message);
        }
      }

      this.surveys = loadedSurveys;
      Logger.debug(`[Surveys] Total loaded: ${this.surveys.length}`);
      eventBus.emit('surveys:loaded', { surveys: this.surveys, count: this.surveys.length });
      return this.surveys;
    } catch (e) {
      Logger.error('[Surveys] Error loading surveys:', e);
      eventBus.emit('surveys:error', e);
      return [];
    }
  }

  /**
   * Get all loaded surveys
   * @returns {Array} Array of surveys
   */
  getAll() {
    return this.surveys;
  }

  /**
   * Get survey by ID
   * @param {string} id - Survey ID
   * @returns {Object|undefined} Survey object
   */
  getById(id) {
    return this.surveys.find(s => s.id === id);
  }

  /**
   * Search surveys by query
   * @param {string} query - Search query
   * @returns {Array} Filtered surveys
   */
  search(query) {
    if (!query) return this.surveys;
    const q = query.toLowerCase();
    return this.surveys.filter(s =>
      (s.name || s.nama || s.judul || '').toLowerCase().includes(q)
    );
  }

  /**
   * Select a survey
   * @param {Object} survey - Survey object
   * @returns {Object} Selected survey
   */
  select(survey) {
    this.selectedSurvey = survey;
    eventBus.emit('surveys:selected', survey);
    return survey;
  }

  /**
   * Get selected survey
   * @returns {Object|null} Selected survey
   */
  getSelected() {
    return this.selectedSurvey;
  }

  /**
   * Get survey periods
   * @param {string} surveyId - Survey ID
   * @returns {Promise<Array>} Array of periods
   */
  async getPeriods(surveyId) {
    try {
      const url = apiClient.buildUrl('survey', API_ENDPOINTS.SURVEY_PERIODS, { surveyId });
      const data = await apiClient.get(url, 'Get Periods');
      return data.data || [];
    } catch (e) {
      eventBus.emit('surveys:error', e);
      return [];
    }
  }
}

// Export singleton instance
export const surveyService = new SurveyService();