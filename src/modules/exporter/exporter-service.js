/**
 * FASIH SCRAPPER - Exporter Service
 * Handles data export to CSV, Excel, and JSON formats
 */

import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { EXPORT_COLUMNS } from '../../constants.js';

class ExporterService {
  /**
   * Generate timestamp for filenames
   * @returns {string} Formatted timestamp
   */
  static generateTimestamp() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${dd}-${mm}-${yy}_${hh}-${min}-${ss}-${ms}`;
  }

  /**
   * Get ordered columns for export
   * @param {Array} data - Data array
   * @returns {Array} Ordered column names
   */
  static getExportColumns(data) {
    const baseColumns = [
      ...EXPORT_COLUMNS.BASIC,
      ...EXPORT_COLUMNS.ADDITIONAL
    ];
    
    const allKeys = new Set();
    data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
    
    const dynamicColumns = [...allKeys].filter(k => !baseColumns.includes(k)).sort();
    return [...baseColumns, ...dynamicColumns];
  }

  /**
   * Export data to CSV
   * @param {Array} data - Data to export
   * @param {string} surveyName - Survey name
   * @param {string} mode - Export mode (basic/ekstra/detail)
   * @returns {boolean} True if export successful
   */
  static exportToCSV(data, surveyName, mode) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }

    const finalColumns = this.getExportColumns(data);
    
    const csvRows = [
      finalColumns.join(','),
      ...data.map(row =>
        finalColumns.map(f => {
          let v = row[f];
          if (v == null) v = '';
          v = String(v);
          if (v.includes(',') || v.includes('"') || v.includes('\n')) {
            v = `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        }).join(',')
      )
    ].join('\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const safeName = surveyName.replace(/[ /\\]/g, '_');
    const modeLabel = mode === 'basic' ? 'Basic' : mode === 'ekstra' ? 'Ekstra' : 'Detail';
    const timestamp = this.generateTimestamp();
    link.download = `Export_${safeName}_Mode_${modeLabel}__${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    eventBus.emit('exporter:success', { filename: link.download, rows: data.length });
    return true;
  }

  /**
   * Export data to Excel
   * @param {Array} data - Data to export
   * @param {string} surveyName - Survey name
   * @param {string} mode - Export mode (basic/ekstra/detail)
   * @returns {boolean} True if export successful
   */
  static exportToExcel(data, surveyName, mode) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }

    // Check if XLSX library is available
    if (typeof window.XLSX === 'undefined') {
      eventBus.emit('exporter:error', { message: 'XLSX library not loaded' });
      return false;
    }

    try {
      // Convert data to worksheet with ordered columns
      const finalColumns = this.getExportColumns(data);
      const wsData = [finalColumns];
      
      data.forEach(row => {
        const rowValues = finalColumns.map(f => {
          let v = row[f];
          return v == null ? '' : v;
        });
        wsData.push(rowValues);
      });

      const ws = window.XLSX.utils.aoa_to_sheet(wsData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const safeName = surveyName.replace(/[ /\\]/g, '_');
      const modeLabel = mode === 'basic' ? 'Basic' : mode === 'ekstra' ? 'Ekstra' : 'Detail';
      const timestamp = this.generateTimestamp();
      const filename = `Export_${safeName}_Mode_${modeLabel}__${timestamp}.xlsx`;

      window.XLSX.writeFile(wb, filename);
      eventBus.emit('exporter:success', { filename, rows: data.length });
      return true;
    } catch (e) {
      Logger.error('[Exporter] Excel export error:', e);
      eventBus.emit('exporter:error', { message: e.message });
      return false;
    }
  }

  /**
   * Export data to JSON
   * @param {Array} data - Data to export
   * @param {string} surveyName - Survey name
   * @returns {boolean} True if export successful
   */
  static exportToJSON(data, surveyName) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const safeName = surveyName.replace(/[ /\\]/g, '_');
    const timestamp = this.generateTimestamp();
    link.download = `Export_${safeName}__${timestamp}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    eventBus.emit('exporter:success', { filename: link.download, rows: data.length });
    return true;
  }
}

export { ExporterService };