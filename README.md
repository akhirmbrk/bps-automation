# BPS Automation

<p align="center">
  <img src="https://img.shields.io/badge/versi-5.1.0-blue?style=for-the-badge" alt="Versi 5.1.0" />
  <img src="https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Chrome-Extension-orange?style=for-the-badge" alt="Ekstensi Chrome" />
  <img src="https://img.shields.io/badge/Lisensi-Internal-red?style=for-the-badge" alt="Lisensi" />
</p>

<p align="center">
  <b>Ekstensi Chrome untuk otomatisasi ekstraksi data dari portal FASIH BPS dengan arsitektur modular, manajemen JWT otomatis, dan export lengkap.</b>
</p>

<p align="center">
  <a href="#mulai-cepat">Mulai Cepat</a> · <a href="#fitur">Fitur</a> · <a href="#arsitektur">Arsitektur</a> · <a href="#instalasi">Instalasi</a> · <a href="#konfigurasi">Konfigurasi</a> · <a href="#changelog">Changelog</a>
</p>

---

## Gambaran Umum

**BPS Automation** adalah ekstensi browser Chromium yang mengotomatisasi ekstraksi data dari portal FASIH BPS (Badan Pusat Statistik) dan menyediakan kemampuan Manajemen Mitra yang komprehensif. Dibangun untuk enumerator dan administrator BPS, ekstensi ini menyederhanakan pengumpulan data survei, alokasi pengguna, dan pelacakan mitra dengan arsitektur ES6 modular yang modern.

---

## Mulai Cepat

**Prasyarat:** Chrome 88+ atau Edge 88+ (browser berbasis Chromium)

```bash
# 1. Clone repository
git clone https://github.com/akhirmbrk/bps-automation.git
cd bps-automation

# 2. Muat sebagai ekstensi
# Buka chrome://extensions/ → Mode Pengembang → Muat Ekstensi Terbongkar → Pilih folder ini
```

---

## Fitur

### 📊 Ekstraksi Data FASIH
Ekstrak data survei dalam tiga mode: **Dasar** (data inti), **Ekstra** (data pra-terdefinisi), dan **Detail** (jawaban lengkap). Mendukung export CSV dan Excel dengan cache riwayat yang kedaluwarsa otomatis.

### 👥 Manajemen Mitra
Kelola data mitra KEPKA dengan profil lengkap. Lihat riwayat partisipasi survei dan status ujian. Cari, filter, dan export data mitra dengan mudah.

### 👤 Alokasi Pengguna
Upload template Excel untuk mengalokasikan enumerator. Resolusi hierarki wilayah otomatis dengan pelacakan progress real-time dan rate limiting yang dapat dikonfigurasi.

### 🔐 Auto-Capture JWT
Secara otomatis mengekstrak dan mempertahankan token JWT dari manajemen-mitra.bps.go.id melalui content script, menghilangkan kebutuhan input token manual.

### 📡 Monitoring Sesi
Toast pemeriksaan sesi modern dengan loading state dan kartu status floating untuk memverifikasi kesehatan sesi sekilas.

### 🌙 Mode Gelap & Responsif
Dukungan mode gelap penuh dengan desain responsif yang berfungsi di desktop dan tablet.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────┐
│                    Dashboard (HTML/CSS)              │
├─────────────────────────────────────────────────────┤
│                  App Controller (app.js)             │
├───────────┬───────────┬───────────┬─────────────────┤
│   Auth    │  Surveys  │ Scraper   │  Exporter       │
│  Module   │  Module   │  Module   │  Module         │
├───────────┴───────────┴───────────┴─────────────────┤
│              Infrastruktur Inti                      │
│  ┌─────────┬─────────┬──────────┬────────┐          │
│  │API      │Config   │Event Bus │Logger  │          │
│  │Client   │Manager  │(Pub/Sub) │        │          │
│  └─────────┴─────────┴──────────┴────────┘          │
├─────────────────────────────────────────────────────┤
│              Lapisan Ekstensi Chrome                 │
│  ┌──────────────┬──────────────────────────────────┐ │
│  │Background.js │Content Scripts (JWT Injection)   │ │
│  └──────────────┴──────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Prinsip Desain:**
- **Event-driven** — Modul berkomunikasi melalui EventBus terpusat (pola pub/sub)
- **Singleton services** — Setiap modul mengekspor satu singleton instance untuk state konsisten
- **Centralized constants** — Semua magic numbers dan konfigurasi ada di `constants.js`

---

## Instalasi

### 1. Setup Dependencies (Opsional, untuk Development)

```bash
# Install dependencies
npm install

# Jalankan linter
npm run lint

# Format kode otomatis
npm run format
```

### 2. Muat Ekstensi (Produksi)

1. **Clone** repository
   ```bash
   git clone https://github.com/akhirmbrk/bps-automation.git
   cd bps-automation
   ```

2. **Buka Ekstensi Chrome** — Navigasi ke `chrome://extensions/`

3. **Aktifkan Mode Pengembang** — Klik toggle di pojok kanan atas

4. **Muat Ekstensi Terbongkar** — Klik "Muat ekstensi yang dibongkar" dan pilih folder repository (yang berisi `manifest.json`)

5. **Verifikasi** — Ikon BPS Automation akan muncul di toolbar Anda

### Setelah Instalasi

1. Login ke https://fasih-sm.bps.go.id di browser
2. Login ke https://manajemen-mitra.bps.go.id (untuk fitur Mitra)
3. Klik ikon **BPS AUTOMATION** di toolbar
4. Dashboard akan terbuka di tab baru

---

## Konfigurasi

Ekstensi menggunakan constants terpusat di `src/constants.js`. Pengaturan utama:

| Pengaturan | Default | Deskripsi |
|------------|---------|-----------|
| URL FASIH | `https://fasih-sm.bps.go.id` | URL server FASIH |
| URL Mitra API | `https://mitra-api.bps.go.id` | Endpoint API Mitra |
| Rate Limit | `300ms` | Jeda antar request API |
| Detail Rate Limit | `100ms` | Jeda untuk mode detail |
| Batch Size | `100` | Record per request |
| Max Pagination | `50` | Halaman pagination maksimal |

---

## Keamanan

- **Tidak ada kredensial hardcoded** — Autentikasi menggunakan cookie sesi browser
- **JWT disimpan dengan aman** — Token disimpan di `chrome.storage.local` (dienkripsi oleh Chromium)
- **Rate limiting** — Jeda built-in mencegah overload API dan server
- **CSP compliant** — Content Security Policy dikonfigurasi dengan benar untuk lingkungan ekstensi Chrome

---

## Struktur Proyek

```
bps-automation/
├── manifest.json            # Manifest ekstensi Chrome v3
├── background.js            # Service worker (messaging, cookies)
├── dashboard.html           # Dashboard UI utama
├── main.css                 # Stylesheet
├── xlsx.full.min.js         # Library SheetJS untuk export Excel
├── .gitignore               # Aturan git ignore
├── content/
│   └── mitra-jwt-inject.js  # Content script untuk JWT extraction
├── icons/                   # Ikon ekstensi
└── src/
    ├── app.js               # Aplikasi utama (controller)
    ├── constants.js         # Konstanta & konfigurasi terpusat
    ├── core/                # Modul infrastruktur
    ├── modules/             # Modul fitur
    └── storage/             # Cache riwayat
```

---

## Panduan Berkontribusi

Kami menerima kontribusi! Baca [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan lengkap termasuk standar kode, proses pull request, dan commit message guide.

## Keamanan

Melaporkan kerentanan? Baca [SECURITY.md](SECURITY.md) untuk proses pelaporan.

---

## Changelog

### v5.1.0 (2026-04-06)

**🔧 Perbaikan**

- **App/kode-duplikat**: hapus fungsi duplikat `updateJwtStatus`, `checkJwtStatus`, dan `checkAllSessions` agar handler JWT/session yang rusak tidak lagi menyebabkan error saat runtime
- **App/filterAkunMitra**: hapus fungsi duplikat `filterAkunMitra` agar pencarian data cache berjalan benar tanpa mengubah data service
- **Utils/debounce**: perbaiki binding `this` pada fungsi debounce dan throttle agar bekerja benar di luar konteks class

**✨ Perubahan Baru**

- **App/JWT**: tambah fitur auto-capture JWT dari manajemen-mitra.bps.go.id via content script agar autentikasi terjaga tanpa input token manual
- **App/monitoring-sesi**: tambah kartu status floating dan toast pemeriksaan sesi modern dengan loading state agar pengguna bisa verifikasi status sesi sekilas
- **Constants/konfigurasi**: gabungkan magic numbers ke konstanta bernama agar konfigurasi terpusat dan mudah dikelola

**📈 Peningkatan**

- **Code/konsistensi**: standarisasi penamaan, optional chaining, dan sintaks ES6+ modern di semua modul agar kode mengikuti praktik terbaik industri
- **Code/pembersihan**: hapus kode tak terjangkau, fungsi mati, dan import tidak perlu agar ukuran bundle dan kompleksitas berkurang
- **Struktur**: pindahkan semua file dari folder `extension/` ke root repository agar struktur ekstensi Chrome mengikuti konvensi standar

[Lihat Changelog Lengkap](https://github.com/akhirmbrk/bps-automation/releases/tag/v5.1.0)

---

<p align="center">
  <b>BPS Kabupaten Kutai Kartanegara</b><br />
  <sub>Penggunaan internal — BPS Kabupaten Kutai Kartanegara</sub>
</p>