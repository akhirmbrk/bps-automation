/**
 * BPS Automation - Exporter Service (Consolidated)
 * Handles all data export: FASIH scraping data + Mitra data (KEPKA, Akun, Detail)
 */

import { eventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { EXPORT_COLUMNS } from '../../constants.js';

class ExporterService {

  // ─── Helpers ───────────────────────────────────────────────

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

  static getExportColumns(data) {
    const baseColumns = [...EXPORT_COLUMNS.BASIC, ...EXPORT_COLUMNS.ADDITIONAL];
    const allKeys = new Set();
    data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
    const dynamicColumns = [...allKeys].filter(k => !baseColumns.includes(k)).sort();
    return [...baseColumns, ...dynamicColumns];
  }

  static buildCsvContent(headers, rows) {
    const csvRows = rows.map(r =>
      r.map(v => {
        const s = v == null ? '' : String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(',')
    );
    return [headers.join(','), ...csvRows].join('\n');
  }

  static downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadExcel(workbook, filename) {
    if (typeof window.XLSX === 'undefined') {
      Logger.error('[Exporter] XLSX library not loaded');
      return false;
    }
    window.XLSX.writeFile(workbook, filename);
    return true;
  }

  static buildWorkbook(sheetData, sheetName = 'Data') {
    const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }

  static buildWorkbookFromJson(rows, sheetName = 'Data') {
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }

  // ─── FASIH Scraping Export ─────────────────────────────────

  static exportToCSV(data, surveyName, mode) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }

    const finalColumns = this.getExportColumns(data);
    const csvRows = data.map(row =>
      finalColumns.map(f => {
        let v = row[f];
        if (v == null) v = '';
        v = String(v);
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          v = `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',')
    );
    const csvContent = ['\uFEFF' + finalColumns.join(','), ...csvRows].join('\n');

    const safeName = surveyName.replace(/[ /\\]/g, '_');
    const modeLabel = mode === 'basic' ? 'Basic' : mode === 'ekstra' ? 'Ekstra' : 'Detail';
    const filename = `Export_${safeName}_Mode_${modeLabel}__${this.generateTimestamp()}.csv`;

    this.downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
    eventBus.emit('exporter:success', { filename, rows: data.length });
    return true;
  }

  static exportToExcel(data, surveyName, mode) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }
    if (typeof window.XLSX === 'undefined') {
      eventBus.emit('exporter:error', { message: 'XLSX library not loaded' });
      return false;
    }

    try {
      const finalColumns = this.getExportColumns(data);
      const wsData = [finalColumns, ...data.map(row => finalColumns.map(f => row[f] ?? ''))];
      const wb = this.buildWorkbook(wsData, 'Data');

      const safeName = surveyName.replace(/[ /\\]/g, '_');
      const modeLabel = mode === 'basic' ? 'Basic' : mode === 'ekstra' ? 'Ekstra' : 'Detail';
      const filename = `Export_${safeName}_Mode_${modeLabel}__${this.generateTimestamp()}.xlsx`;

      this.downloadExcel(wb, filename);
      eventBus.emit('exporter:success', { filename, rows: data.length });
      return true;
    } catch (e) {
      Logger.error('[Exporter] Excel export error:', e);
      eventBus.emit('exporter:error', { message: e.message });
      return false;
    }
  }

  static exportToJSON(data, surveyName) {
    if (!data || data.length === 0) {
      eventBus.emit('exporter:error', { message: 'No data to export' });
      return false;
    }

    const safeName = surveyName.replace(/[ /\\]/g, '_');
    const filename = `Export_${safeName}__${this.generateTimestamp()}.json`;
    this.downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
    eventBus.emit('exporter:success', { filename, rows: data.length });
    return true;
  }

  // ─── Mitra KEPKA Export ────────────────────────────────────

  static exportMitraKepkaToCSV(data, filename = 'mitra_kepka') {
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
    this.downloadBlob(this.buildCsvContent(headers, rows), `${filename}_kepka.csv`, 'text/csv');
  }

  static exportMitraKepkaToExcel(data, filename = 'mitra_kepka') {
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
    const wb = this.buildWorkbookFromJson(rows, 'Mitra KEPKA');
    this.downloadExcel(wb, `${filename}_kepka.xlsx`);
  }

  // ─── Mitra Full Detail Export (28 fields) ──────────────────

  static exportMitraFullDetailToCSV(data, filename = 'mitra_kepka_full_detail') {
    if (!data || data.length === 0) return;
    const headers = ['ID Mitra','NIK','Nama Lengkap','Email','Username','Status','No Telp','NPWP',
      'Alamat','Provinsi','Kabupaten','Kecamatan','Desa','Tgl Lahir','Jenis Kelamin','Agama',
      'Status Kawin','Pendidikan','Pekerjaan','Bank','No Rekening','Nama Rekening','Merk HP',
      'Tipe HP','RAM HP','Sobat ID','Foto URL','Foto KTP URL'];
    const rows = data.map(d => [
      d.idmitra || '-', `"${(d.nik || '-').replace(/"/g, '""')}"`,
      `"${(d.nama_lengkap || '-').replace(/"/g, '""')}"`,
      d.email || '-', d.username || '-', d.status || '-', d.no_telp || '-', d.npwp || '-',
      `"${(d.alamat_detail || '-').replace(/"/g, '""')}"`,
      d.alamat_prov || '-', d.alamat_kab || '-', d.alamat_kec || '-', d.alamat_desa || '-',
      d.tgl_lahir || '-',
      d.jns_kelamin === '1' ? 'Laki-laki' : d.jns_kelamin === '2' ? 'Perempuan' : '-',
      d.agama || '-', d.status_kawin || '-', d.pendidikan || '-', d.pekerjaan || '-',
      d.kd_bank || '-', d.rekening || '-',
      `"${(d.rekening_nama || '-').replace(/"/g, '""')}"`,
      d.merk_hp || '-', d.tipe_hp || '-', d.ram_hp || '-', d.sobat_id || '-',
      d.foto || '-', d.foto_ktp || '-'
    ]);
    this.downloadBlob(this.buildCsvContent(headers, rows), `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  static exportMitraFullDetailToExcel(data, filename = 'mitra_kepka_full_detail') {
    if (!data || data.length === 0) return;
    const rows = data.map(d => ({
      'ID Mitra': d.idmitra || '-', 'NIK': d.nik || '-', 'Nama Lengkap': d.nama_lengkap || '-',
      'Email': d.email || '-', 'Username': d.username || '-', 'Status': d.status || '-',
      'No Telp': d.no_telp || '-', 'NPWP': d.npwp || '-', 'Alamat': d.alamat_detail || '-',
      'Provinsi': d.alamat_prov || '-', 'Kabupaten': d.alamat_kab || '-',
      'Kecamatan': d.alamat_kec || '-', 'Desa': d.alamat_desa || '-',
      'Tgl Lahir': d.tgl_lahir || '-',
      'Jenis Kelamin': d.jns_kelamin === '1' ? 'Laki-laki' : d.jns_kelamin === '2' ? 'Perempuan' : '-',
      'Agama': d.agama || '-', 'Status Kawin': d.status_kawin || '-',
      'Pendidikan': d.pendidikan || '-', 'Pekerjaan': d.pekerjaan || '-',
      'Bank': d.kd_bank || '-', 'No Rekening': d.rekening || '-',
      'Nama Rekening': d.rekening_nama || '-', 'Merk HP': d.merk_hp || '-',
      'Tipe HP': d.tipe_hp || '-', 'RAM HP': d.ram_hp || '-', 'Sobat ID': d.sobat_id || '-',
      'Foto URL': d.foto || '-', 'Foto KTP URL': d.foto_ktp || '-'
    }));
    const wb = this.buildWorkbookFromJson(rows, 'Mitra KEPKA Detail');
    this.downloadExcel(wb, `${filename}.xlsx`);
  }

  // ─── Akun Mitra Export ─────────────────────────────────────

  static exportAkunToCSV(data, filename = 'akun_mitra') {
    if (!data || data.length === 0) return;
    const headers = ['Username', 'Email', 'Nama Lengkap', 'NIK', 'Status', 'Tanggal Daftar'];
    const rows = data.map(m => [
      m.username || '-', m.email || '-', m.nama_lengkap || '-', m.nik || '-',
      m.status === '1' ? 'Aktif' : 'Nonaktif',
      m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
    ]);
    this.downloadBlob(this.buildCsvContent(headers, rows), `${filename}_akun.csv`, 'text/csv');
  }

  static exportAkunToExcel(data, filename = 'akun_mitra') {
    if (!data || data.length === 0) return;
    const rows = data.map(m => ({
      'Username': m.username || '-', 'Email': m.email || '-',
      'Nama Lengkap': m.nama_lengkap || '-', 'NIK': m.nik || '-',
      'Status': m.status === '1' ? 'Aktif' : 'Nonaktif',
      'Tanggal Daftar': m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'
    }));
    const wb = this.buildWorkbookFromJson(rows, 'Akun Mitra');
    this.downloadExcel(wb, `${filename}_akun.xlsx`);
  }
}

export { ExporterService };
