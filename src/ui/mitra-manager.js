/**
 * BPS Automation - Mitra Manager
 * Handles all Mitra-related UI interactions
 */

import { Logger } from '../core/logger.js';
import { mitraService } from '../modules/mitra/index.js';
import { TABLE_CONSTANTS } from '../constants.js';

/** Escape HTML to prevent XSS */
function esc(val) {
  if (val == null) return '-';
  const s = String(val);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class MitraManager {
  /**
   * @param {App} app - Reference to main App instance
   */
  constructor(app) {
    this.app = app;
  }

  get elements() { return this.app.elements; }
  get log() { return this.app.log.bind(this.app); }

  async loadMitraKepka() {
    const tahun = this.elements.mitraTahunSelect?.value || '2026';
    this.log(`📊 Memuat data Mitra KEPKA tahun ${tahun}...`, 'info');
    this.app.mitraKepkaData = await mitraService.getMitraKepka(tahun, mitraService.kdProv, mitraService.kdKab);
    if (this.app.mitraKepkaData.length > 0) {
      this.renderMitraKepkaTable();
      this.updateMitraStats();
      if (this.elements.downloadMitraCsvBtn) this.elements.downloadMitraCsvBtn.disabled = false;
      if (this.elements.downloadMitraExcelBtn) this.elements.downloadMitraExcelBtn.disabled = false;
    }
  }

  renderMitraKepkaTable() {
    const tbody = this.elements.mitraKepkaTableBody;
    if (!tbody) return;
    if (this.app.mitraKepkaData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = this.app.mitraKepkaData.slice(0, 100).map(m => `
      <tr>
        <td>${esc(m.mitra_detail?.nik)}</td>
        <td>${esc(m.mitra_detail?.nama_lengkap)}</td>
        <td>${esc(m.mitra_detail?.email)}</td>
        <td>${esc(m.nama_pos)}</td>
        <td>${esc(m.ket_status)}</td>
        <td>
          <button class="btn btn-sm btn-primary mitra-detail-btn" data-id="${esc(m.id_mitra)}">Detail</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.mitra-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showMitraDetail(btn.dataset.id));
    });
  }

  async showMitraDetail(idMitra) {
    if (!idMitra) {
      this.log('⚠️ ID Mitra tidak valid', 'warning');
      return;
    }
    this.app.selectedMitraId = idMitra;
    this.log(`📋 Memuat detail mitra ID: ${idMitra}...`, 'info');
    
    const detail = await mitraService.getMitraDetail(idMitra);
    if (!detail) {
      this.log('⚠️ Detail mitra tidak ditemukan', 'warning');
      return;
    }
    
    if (this.elements.mitraDetailModal) this.elements.mitraDetailModal.classList.add('active');
    
    if (this.elements.mitraDetailBody) {
      this.elements.mitraDetailBody.innerHTML = `
        <div class="detail-row"><span class="detail-label">ID Mitra</span><span class="detail-value">${esc(detail.idmitra)}</span></div>
        <div class="detail-row"><span class="detail-label">NIK</span><span class="detail-value">${esc(detail.nik)}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Lengkap</span><span class="detail-value">${esc(detail.nama_lengkap)}</span></div>
        <div class="detail-row"><span class="detail-label">Username</span><span class="detail-value">${esc(detail.username)}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(detail.email)}</span></div>
        <div class="detail-row"><span class="detail-label">No. Telepon</span><span class="detail-value">${esc(detail.no_telp)}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${esc(detail.status)}</span></div>
        <div class="detail-row"><span class="detail-label">NPWP</span><span class="detail-value">${esc(detail.npwp)}</span></div>
        <div class="detail-row"><span class="detail-label">Alamat</span><span class="detail-value">${esc(detail.alamat_detail)}</span></div>
        <div class="detail-row"><span class="detail-label">Provinsi</span><span class="detail-value">${esc(detail.alamat_prov)}</span></div>
        <div class="detail-row"><span class="detail-label">Kabupaten</span><span class="detail-value">${esc(detail.alamat_kab)}</span></div>
        <div class="detail-row"><span class="detail-label">Kecamatan</span><span class="detail-value">${esc(detail.alamat_kec)}</span></div>
        <div class="detail-row"><span class="detail-label">Desa</span><span class="detail-value">${esc(detail.alamat_desa)}</span></div>
        <div class="detail-row"><span class="detail-label">Tanggal Lahir</span><span class="detail-value">${esc(detail.tgl_lahir)}</span></div>
        <div class="detail-row"><span class="detail-label">Jenis Kelamin</span><span class="detail-value">${detail.jns_kelamin === '1' ? 'Laki-laki' : detail.jns_kelamin === '2' ? 'Perempuan' : '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Agama</span><span class="detail-value">${esc(detail.agama)}</span></div>
        <div class="detail-row"><span class="detail-label">Status Kawin</span><span class="detail-value">${esc(detail.status_kawin)}</span></div>
        <div class="detail-row"><span class="detail-label">Pendidikan</span><span class="detail-value">${esc(detail.pendidikan)}</span></div>
        <div class="detail-row"><span class="detail-label">Pekerjaan</span><span class="detail-value">${esc(detail.pekerjaan)}</span></div>
        <div class="detail-row"><span class="detail-label">Bank</span><span class="detail-value">${esc(detail.kd_bank)}</span></div>
        <div class="detail-row"><span class="detail-label">No. Rekening</span><span class="detail-value">${esc(detail.rekening)}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Rekening</span><span class="detail-value">${esc(detail.rekening_nama)}</span></div>
        <div class="detail-row"><span class="detail-label">Merk HP</span><span class="detail-value">${esc(detail.merk_hp)}</span></div>
        <div class="detail-row"><span class="detail-label">Tipe HP</span><span class="detail-value">${esc(detail.tipe_hp)}</span></div>
        <div class="detail-row"><span class="detail-label">RAM HP</span><span class="detail-value">${esc(detail.ram_hp)}</span></div>
        <div class="detail-row"><span class="detail-label">Catatan</span><span class="detail-value">${esc(detail.catatan)}</span></div>
        <div class="detail-row"><span class="detail-label">Sobat ID</span><span class="detail-value">${esc(detail.sobat_id)}</span></div>
      `;
    }
    
    this.log(`📊 Memuat riwayat survei mitra...`, 'info');
    await this.loadMitraHistory(idMitra);
  }

  async loadMitraHistory(idMitra) {
    const tahun = this.elements.mitraTahunSelect?.value || '2026';
    const history = await mitraService.getMitraHistory(idMitra, tahun);
    const tbody = this.elements.mitraHistoryTableBody;
    if (!tbody) return;
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan=\"6\" class=\"text-center text-muted\">Tidak ada riwayat survei</td></tr>';
    } else {
      tbody.innerHTML = history.map(h => `
        <tr>
          <td>${esc(h.kd_survei)}</td>
          <td>${esc(h.nama_survei)}</td>
          <td>${esc(h.nama_keg)}</td>
          <td>${esc(h.nama_pos)}</td>
          <td>${esc(h.nama_status)}</td>
          <td>${h.nama_kab ? `${esc(h.nama_kab)}, ${esc(h.nama_prov)}` : '-'}</td>
        </tr>
      `).join('');
    }
  }

  downloadMitraKepkaCSV() {
    if (this.app.mitraKepkaData.length === 0) return;
    mitraService.exportKepkaToCSV(this.app.mitraKepkaData, 'mitra_kepka');
    this.log('📥 Mitra KEPKA CSV downloaded', 'success');
  }

  downloadMitraKepkaExcel() {
    if (this.app.mitraKepkaData.length === 0) return;
    mitraService.exportKepkaToExcel(this.app.mitraKepkaData, 'mitra_kepka');
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
    this.app.mitraScrapData = await mitraService.getMitraList(surveyVal, kegiatanVal);
    if (this.app.mitraScrapData.length > 0) {
      this.renderMitraScrapTable();
      if (this.elements.downloadMitraScrapCsvBtn) this.elements.downloadMitraScrapCsvBtn.disabled = false;
      if (this.elements.downloadMitraScrapExcelBtn) this.elements.downloadMitraScrapExcelBtn.disabled = false;
    }
  }

  renderMitraScrapTable() {
    const tbody = this.elements.mitraScrapTableBody;
    if (!tbody) return;
    if (this.app.mitraScrapData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = this.app.mitraScrapData.slice(0, 100).map(m => `
      <tr>
        <td>${esc(m.nik)}</td>
        <td>${esc(m.nama_lengkap)}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.posisi)}</td>
        <td>${esc(m.status)}</td>
        <td>${esc(m.alamat)}</td>
      </tr>
    `).join('');
    if (this.elements.mitraScrapStats) {
      this.elements.mitraScrapStats.textContent = `${this.app.mitraScrapData.length} records`;
    }
  }

  downloadMitraScrapCSV() {
    if (this.app.mitraScrapData.length === 0) return;
    mitraService.exportKepkaToCSV(this.app.mitraScrapData, 'mitra_scrap');
    this.log('📥 Mitra Scrap CSV downloaded', 'success');
  }

  downloadMitraScrapExcel() {
    if (this.app.mitraScrapData.length === 0) return;
    mitraService.exportKepkaToExcel(this.app.mitraScrapData, 'mitra_scrap');
    this.log('📥 Mitra Scrap Excel downloaded', 'success');
  }

  async loadMitraKegiatan(kdSurvei) {
    const select = this.elements.mitraKegiatanSelect;
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const status = this.elements.mitraStatusKegiatanSelect?.value || '1';
    const kegiatan = await mitraService.getKegiatanList(kdSurvei, 2, 0, status);
    kegiatan.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id_keg;
      opt.textContent = k.nama_keg || '-';
      select.appendChild(opt);
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
    this.app.seleksiData = await mitraService.getMitraList(surveiVal, kegiatanVal);
    if (this.app.seleksiData.length > 0) this.renderSeleksiTable();
  }

  renderSeleksiTable() {
    const tbody = this.elements.seleksiTableBody;
    if (!tbody) return;
    if (this.app.seleksiData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = this.app.seleksiData.slice(0, 100).map(m => `
      <tr>
        <td>${esc(m.nik)}</td>
        <td>${esc(m.nama_lengkap)}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.posisi)}</td>
        <td>${esc(m.ket_status)}</td>
        <td>
          <button class="btn btn-sm btn-primary seleksi-detail-btn" data-id="${esc(m.id)}">Detail</button>
        </td>
      </tr>
    `).join('');
    if (this.elements.seleksiStats) {
      this.elements.seleksiStats.textContent = `${this.app.seleksiData.length} records`;
    }
  }

  async loadSeleksiKegiatan(kdSurvei) {
    const select = this.elements.seleksiKegiatanSelect;
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const status = this.elements.seleksiStatusKegiatanSelect?.value || '1';
    const kegiatan = await mitraService.getKegiatanList(kdSurvei, 2, 0, status);
    kegiatan.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id_keg;
      opt.textContent = k.nama_keg || '-';
      select.appendChild(opt);
    });
    this.log(`✅ ${kegiatan.length} kegiatan seleksi dimuat (status: ${status})`, 'success');
  }

  renderAkunMitraTable() {
    const tbody = this.elements.akunMitraTableBody;
    if (!tbody) return;
    if (mitraService.akunMitraData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = mitraService.akunMitraData.map(m => `
      <tr>
        <td>${esc(m.username)}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.nama_lengkap)}</td>
        <td>${esc(m.nik)}</td>
        <td>${m.status === '1' ? 'Aktif' : 'Nonaktif'}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}</td>
      </tr>
    `).join('');
    if (this.elements.pageInfo) this.elements.pageInfo.textContent = `Page ${this.app.akunMitraPage}`;
    if (this.elements.prevPageBtn) this.elements.prevPageBtn.disabled = this.app.akunMitraPage <= 1;
    if (this.elements.nextPageBtn) this.elements.nextPageBtn.disabled = mitraService.akunMitraData.length < mitraService.akunMitraPerPage;
  }

  prevAkunMitraPage() {
    if (this.app.akunMitraPage > 1) {
      this.app.akunMitraPage--;
      this.loadAkunMitra();
    }
  }

  nextAkunMitraPage() {
    this.app.akunMitraPage++;
    this.loadAkunMitra();
  }

  async loadAkunMitra() {
    this.log('📊 Memuat data Akun Mitra...', 'info');
    const data = await mitraService.getAkunMitra(this.app.akunMitraPage);
    if (data.length > 0) this.renderAkunMitraTable();
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

  closeMitraDetailModal() {
    if (this.elements.mitraDetailModal) this.elements.mitraDetailModal.classList.remove('active');
  }

  async loadAllAkunMitraAuto() {
    if (this.app.akunMitraAllData.length > 0) return;
    const loadingEl = this.elements.akunLoading;
    const tableBody = this.elements.akunMitraTableBody;
    if (loadingEl) loadingEl.style.display = 'block';
    if (tableBody) tableBody.innerHTML = '';
    try {
      const allData = await mitraService.getAkunMitra(1, TABLE_CONSTANTS.AKUN_MITRA_FETCH_ALL);
      this.app.akunMitraAllData = allData;
      if (loadingEl) loadingEl.style.display = 'none';
      if (allData.length > 0) {
        this.renderAkunMitraTableWithAllData(allData);
        if (this.elements.downloadAkunCsvBtn) this.elements.downloadAkunCsvBtn.disabled = false;
        if (this.elements.downloadAkunExcelBtn) this.elements.downloadAkunExcelBtn.disabled = false;
        Logger.info(`[MitraManager] ${allData.length} akun mitra loaded`);
      } else {
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Error: ${esc(err.message)}</td></tr>`;
      Logger.error('[MitraManager] Failed to load akun mitra:', err.message);
    }
  }

  renderAkunMitraTableWithAllData(data) {
    const tbody = this.elements.akunMitraTableBody;
    if (!tbody) return;
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(m => `
      <tr>
        <td>${esc(m.username)}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.nama_lengkap)}</td>
        <td>${esc(m.nik)}</td>
        <td>${m.status === '1' ? 'Aktif' : 'Nonaktif'}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}</td>
      </tr>
    `).join('');
    if (this.elements.pageInfo) this.elements.pageInfo.textContent = `Menampilkan semua ${data.length} data`;
    if (this.elements.prevPageBtn) this.elements.prevPageBtn.style.display = 'none';
    if (this.elements.nextPageBtn) this.elements.nextPageBtn.style.display = 'none';
  }

  filterAkunMitra(query) {
    const lowerQuery = (query || '').toLowerCase();
    const allData = this.app.akunMitraAllData;
    if (!allData || allData.length === 0) return;
    const filtered = lowerQuery ? allData.filter(m =>
      (m.username || '').toLowerCase().includes(lowerQuery) ||
      (m.nama_lengkap || '').toLowerCase().includes(lowerQuery) ||
      (m.email || '').toLowerCase().includes(lowerQuery) ||
      (m.nik || '').toLowerCase().includes(lowerQuery)
    ) : allData;
    this.renderAkunMitraTableWithAllData(filtered);
  }

  filterMitraKepka(query) {
    const lowerQuery = (query || '').toLowerCase();
    if (this.app.mitraKepkaData.length === 0) return;
    const filtered = this.app.mitraKepkaData.filter(m => {
      const nik = m.mitra_detail?.nik || '';
      const nama = m.mitra_detail?.nama_lengkap || '';
      const email = m.mitra_detail?.email || '';
      const posisi = m.nama_pos || '';
      return nik.toLowerCase().includes(lowerQuery) ||
        nama.toLowerCase().includes(lowerQuery) ||
        email.toLowerCase().includes(lowerQuery) ||
        posisi.toLowerCase().includes(lowerQuery);
    });
    const tbody = this.elements.mitraKepkaTableBody;
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada hasil pencarian</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.slice(0, 100).map(m => `
      <tr>
        <td>${esc(m.mitra_detail?.nik)}</td>
        <td>${esc(m.mitra_detail?.nama_lengkap)}</td>
        <td>${esc(m.mitra_detail?.email)}</td>
        <td>${esc(m.nama_pos)}</td>
        <td>${esc(m.ket_status)}</td>
        <td>
          <button class="btn btn-sm btn-primary mitra-detail-btn" data-id="${esc(m.id_mitra)}">Detail</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.mitra-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showMitraDetail(btn.dataset.id));
    });
  }

  async downloadAllMitraDetailCSV() {
    if (this.app.mitraKepkaData.length === 0) {
      this.log('⚠️ Tidak ada data Mitra KEPKA', 'warning');
      return;
    }
    await this._downloadAllMitraDetail('csv');
  }

  async downloadAllMitraDetailExcel() {
    if (this.app.mitraKepkaData.length === 0) {
      this.log('⚠️ Tidak ada data Mitra KEPKA', 'warning');
      return;
    }
    await this._downloadAllMitraDetail('excel');
  }

  async _downloadAllMitraDetail(format) {
    const progressDiv = this.elements.detailProgress;
    const progressText = this.elements.detailProgressText;
    const progressPercent = this.elements.detailProgressPercent;
    const progressBar = this.elements.detailProgressBar;
    const progressBarText = this.elements.detailProgressBarText;
    if (progressDiv) progressDiv.style.display = 'block';
    const total = this.app.mitraKepkaData.length;
    const allDetail = [];
    for (let i = 0; i < total; i++) {
      const m = this.app.mitraKepkaData[i];
      const idMitra = m.id_mitra;
      if (progressText) progressText.textContent = `Mengambil detail ${i + 1}/${total}: ${m.mitra_detail?.nama_lengkap || '...'}`;
      const percent = Math.round(((i + 1) / total) * 100);
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressBarText) progressBarText.textContent = `${percent}%`;
      try {
        const detail = await mitraService.getMitraDetail(idMitra);
        if (detail) allDetail.push(detail);
        await new Promise(r => setTimeout(r, mitraService.rateLimitMs));
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
    if (format === 'csv') this._exportDetailToCSV(allDetail);
    else this._exportDetailToExcel(allDetail);
    setTimeout(() => { if (progressDiv) progressDiv.style.display = 'none'; }, 3000);
  }

  _exportDetailToCSV(data) {
    const headers = ['ID Mitra','NIK','Nama Lengkap','Email','Username','Status','No Telp','NPWP','Alamat','Provinsi','Kabupaten','Kecamatan','Desa','Tgl Lahir','Jenis Kelamin','Agama','Status Kawin','Pendidikan','Pekerjaan','Bank','No Rekening','Nama Rekening','Merk HP','Tipe HP','RAM HP','Sobat ID','Foto URL','Foto KTP URL'];
    const rows = data.map(d => [
      d.idmitra || '-',
      `"${(d.nik || '-').replace(/"/g, '""')}"`,
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

  _exportDetailToExcel(data) {
    if (!window.XLSX) {
      this.log('❌ Library XLSX tidak tersedia', 'error');
      return;
    }
    const rows = data.map(d => ({
      'ID Mitra': d.idmitra || '-', 'NIK': d.nik || '-', 'Nama Lengkap': d.nama_lengkap || '-',
      'Email': d.email || '-', 'Username': d.username || '-', 'Status': d.status || '-',
      'No Telp': d.no_telp || '-', 'NPWP': d.npwp || '-', 'Alamat': d.alamat_detail || '-',
      'Provinsi': d.alamat_prov || '-', 'Kabupaten': d.alamat_kab || '-', 'Kecamatan': d.alamat_kec || '-',
      'Desa': d.alamat_desa || '-', 'Tgl Lahir': d.tgl_lahir || '-',
      'Jenis Kelamin': d.jns_kelamin === '1' ? 'Laki-laki' : d.jns_kelamin === '2' ? 'Perempuan' : '-',
      'Agama': d.agama || '-', 'Status Kawin': d.status_kawin || '-', 'Pendidikan': d.pendidikan || '-',
      'Pekerjaan': d.pekerjaan || '-', 'Bank': d.kd_bank || '-', 'No Rekening': d.rekening || '-',
      'Nama Rekening': d.rekening_nama || '-', 'Merk HP': d.merk_hp || '-', 'Tipe HP': d.tipe_hp || '-',
      'RAM HP': d.ram_hp || '-', 'Sobat ID': d.sobat_id || '-', 'Foto URL': d.foto || '-', 'Foto KTP URL': d.foto_ktp || '-'
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Mitra KEPKA Detail');
    window.XLSX.writeFile(wb, `mitra_kepka_detail_${new Date().toISOString().slice(0,10)}.xlsx`);
    this.log(`📥 Downloaded ${data.length} detail records as Excel`, 'success');
  }

  async loadMitraSurveiList() {
    try {
      this.log('📊 Memuat daftar survei Mitra...', 'info');
      const reList = await mitraService.getReList(mitraService.kdProv, mitraService.kdKab);
      if (reList.length === 0) {
        this.log('⚠️ Tidak ada data RE ditemukan', 'warning');
        return;
      }
      const idKeg = reList[0].idKeg || '1';
      const surveys = await mitraService.getSurveiList(idKeg);
      this.app.mitraSurveiList = surveys;
      ['mitraSurveySelect', 'seleksiSurveiSelect'].forEach(selectId => {
        const select = this.elements[selectId];
        if (select) {
          select.innerHTML = '<option value="">-- Pilih Survei --</option>';
          surveys.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.kd_survei;
            opt.textContent = s.nama;
            select.appendChild(opt);
          });
        }
      });
      this.log(`✅ ${surveys.length} survei dimuat`, 'success');
    } catch (err) {
      this.log(`❌ Error loading survei list: ${err.message}`, 'error');
    }
  }

  updateMitraStats() {
    if (this.elements.statMitraTotal) this.elements.statMitraTotal.textContent = this.app.mitraKepkaData.length;
    if (this.elements.statMitraDiterima) {
      const diterima = this.app.mitraKepkaData.filter(m => m.ket_status?.toLowerCase().includes('diterima')).length;
      this.elements.statMitraDiterima.textContent = diterima;
    }
    if (this.elements.statMitraSurvei) {
      const survei = new Set(this.app.mitraKepkaData.map(m => m.nama_pos)).size;
      this.elements.statMitraSurvei.textContent = survei;
    }
  }

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
}

export { MitraManager };