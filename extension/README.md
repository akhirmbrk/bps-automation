# BPS AUTOMATION v5.1.0

Ekstensi Chromium untuk otomatisasi ekstraksi data dari portal FASIH BPS dan Manajemen Mitra. Dibangun dengan arsitektur modular ES modules dan best practices modern.

## 🚀 Fitur Utama

### 1. FASIH - Ekstraksi Data
- **Mode Basic**: Data dasar (kode identitas, nama KK, alamat, status)
- **Mode Ekstra**: Termasuk pre-defined data dari survei
- **Mode Detail**: Ekstraksi lengkap termasuk answers data
- Export ke CSV dan Excel
- History dengan auto-expire 10 menit

### 2. FASIH - User Allocation
- Upload template Excel untuk alokasi petugas
- Resolve region hierarchy otomatis
- Progress tracking real-time
- Rate limiting configurable

### 3. Manajemen Mitra - Dashboard
- **Mitra KEPKA**: Daftar mitra dengan mode Basic/Detail
- **Riwayat Survei**: Tracking partisipasi mitra
- Export CSV dan Excel

### 4. Manajemen Mitra - Scrapping
- Load data mitra berdasarkan survei dan kegiatan
- Filter dan export data

### 5. Manajemen Mitra - Seleksi
- Data seleksi mitra per survei/kegiatan
- Status exam dan remedial

### 6. Manajemen Mitra - Akun
- Manajemen akun mitra (paginated)
- Search dan sort

### 7. UI/UX
- Dark mode support
- Responsive design
- Collapsible sidebar dengan 2 menu group
- Real-time progress bar
- Terminal log dengan warna
- Profile image dari community.bps.go.id

## 📁 Struktur Proyek

```
extension/
├── manifest.json          # Chrome extension manifest v3
├── background.js          # Service worker
├── dashboard.html         # Main UI (v5.0)
├── main.css               # Styles
├── xlsx.full.min.js       # Excel library
├── README.md              # Dokumentasi
├── icons/                 # Extension icons
└── src/                   # Source code (ES modules)
    ├── index.js           # Entry point
    ├── app.js             # Application controller
    ├── constants.js       # Constants & config
    ├── core/              # Core modules
    │   ├── api-client.js  # HTTP client + retry
    │   ├── config.js      # Config manager
    │   ├── event-bus.js   # Event system
    │   ├── logger.js      # Logging
    │   ├── utils.js       # Utilities
    │   └── index.js       # Core exports
    ├── modules/           # Feature modules
    │   ├── auth/          # Authentication
    │   ├── surveys/       # Survey management
    │   ├── scraper/       # Data extraction
    │   ├── exporter/      # CSV/Excel export
    │   ├── allocation/    # User allocation
    │   └── mitra/         # Manajemen Mitra (NEW!)
    │       ├── index.js
    │       └── mitra-service.js
    └── storage/
        └── history-cache.js # History storage
```

## 🔧 Instalasi

### Development
1. Buka `chrome://extensions/` di Chrome/Edge
2. Aktifkan **Developer mode** (toggle kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `extension/`
5. Ekstensi akan muncul di toolbar (ikon puzzle piece)

### Setelah Install
1. Login ke https://fasih-sm.bps.go.id di browser
2. Login ke https://manajemen-mitra.bps.go.id (untuk fitur Mitra)
3. Klik icon BPS AUTOMATION di toolbar
4. Dashboard akan terbuka di tab baru

## 📖 Cara Penggunaan

### FASIH - Ekstraksi Data
1. Pilih survei dari dropdown
2. Pilih mode (Basic/Ekstra/Detail)
3. Klik **Mulai Ekstraksi**
4. Monitor progress di terminal
5. Download hasil (CSV/Excel) setelah selesai

### FASIH - User Allocation
1. Klik "Download Template" untuk template Excel
2. Isi data region dan email petugas
3. Upload file Excel
4. Pilih survei, periode, dan role
5. Atur opsi:
   - **Overwrite**: Timpa assignment yang ada
   - **Direct Assign**: Langsung assign petugas
   - **Rate Limit**: Jeda antar request (default 500ms)
6. Klik **Allocate Users**

### Manajemen Mitra - Dashboard
1. Pilih tahun (2024/2025/2026)
2. Klik **Load Data** untuk memuat Mitra KEPKA
3. Toggle mode Basic/Detail untuk tampilan berbeda
4. Export ke CSV/Excel
5. Klik **Detail** pada baris mitra untuk info lengkap

### Manajemen Mitra - Scrapping
1. Pilih Survei dari dropdown
2. Pilih Kegiatan dari dropdown
3. Klik **Load Data**
4. Export hasil ke CSV/Excel

### Manajemen Mitra - Seleksi
1. Pilih Sensus/Survei
2. Pilih Kegiatan
3. Klik **Load Data Seleksi**
4. Lihat status exam dan remedial

### Manajemen Mitra - Akun
1. Klik **Load Data** untuk memuat daftar akun
2. Gunakan Previous/Next untuk navigasi halaman
3. Export ke CSV

### Settings
| Setting | Default | Description |
|---------|---------|-------------|
| FASIH Base URL | https://fasih-sm.bps.go.id | URL server FASIH |
| Mitra API Base URL | https://mitra-api.bps.go.id | URL API Mitra |
| Mitra Pengguna API | https://mitra-pengguna-api.bps.go.id | URL API Pengguna Mitra |
| Rate Limit | 300ms | Jeda antar request |
| Detail Rate Limit | 100ms | Jeda untuk mode detail |
| Batch Size | 100 | Record per request |
| Max Pagination | 50 | Maksimal halaman |

## 🔌 API Endpoints

### FASIH - Surveys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/survey/api/v1/surveys/datatable` | List surveys |
| GET  | `/survey/api/v1/survey-periods?surveyId={id}` | Get periods |
| GET  | `/survey/api/v1/users/myinfo` | Get user info |

### FASIH - Region
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/region/api/v1/region/level3` | Get kecamatan |
| GET | `/region/api/v1/region/level4` | Get desa |

### FASIH - Assignment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analytic/api/v2/assignment/datatable-all-user-survey-periode` | Extract data |
| GET | `/assignment-general/api/assignment/get-by-assignment-id` | Get detail |
| POST | `/survey/api/v1/survey-period-role-users/` | Allocate users |

### Manajemen Mitra
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mitra-kepka/by-year-wil/{tahun}/{kdProv}/{kdKab}` | List Mitra KEPKA |
| GET | `/api/mitra/id/{idMitra}` | Detail Mitra |
| GET | `/api/mitra/hist/sm/{idMitra}?tahun={tahun}` | Riwayat Survei Mitra |
| GET | `/api/mitra/listv3/{kdSurvei}/{idKeg}/{kdProv}/{kdKab}` | List Mitra per Survei |
| POST | `/api/mitra/serversidetable` | List Akun Mitra (paginated) |
| GET | `/api/keg/ks/exam-status/{kdSurvei}/{idKeg}` | Status Exam |
| GET | `/api/wilayah/prov` | List Provinsi |
| GET | `/api/wilayah/kab/{kdProv}` | List Kabupaten |
| GET | `/api/wilayah/re/list/{kdProv}/{kdKab}` | List Kecamatan |

## 🛠️ Troubleshooting

### JavaScript tidak berjalan
1. Reload extension di `chrome://extensions/`
2. Pastikan manifest.json dan dashboard.html sinkron
3. Clear cache browser

### Network tab kosong (Fetch/XHR tidak muncul)
Pastikan CSP benar di `dashboard.html`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https://community.bps.go.id https://mitra-api.bps.go.id; 
               connect-src 'self' https://fasih-sm.bps.go.id https://*.bps.go.id chrome-extension://*;">
```

### Module import error
Pastikan semua file `.js` menggunakan `.js` extension di import:
```javascript
// Correct
import { utils } from './core/utils.js';

// Wrong (will fail in Chrome extension)
import { utils } from './core/utils';
```

### XLSX not defined
Pastikan xlsx.full.min.js di-load sebelum app.js:
```html
<script src="xlsx.full.min.js"></script>
<script type="module" src="src/app.js"></script>
```

### Allocation gagal - Region not found
Pastikan kode region di template Excel sesuai:
- Provinsi: 2 digit (64)
- Kabupaten: 2 digit (03)
- Kecamatan: 3 digit (081)
- Desa: 3 digit (003)
- SLS: 4 digit (0000)
- SUBSLS: 2 digit (00)

### Login session expired
1. Klik tombol Reload (ikon refresh) di topbar
2. Pastikan session FASIH masih aktif di browser

### Mitra data tidak muncul
1. Pastikan sudah login ke https://manajemen-mitra.bps.go.id
2. Cek status login di sidebar (online/offline indicator)
3. Pastikan wilayah (kdProv=64, kdKab=03) sesuai konfigurasi

## 📝 Changelog

### v5.1.0 (2026-04-06)
- **FIX**: Removed duplicate code in app.js (corrupted JWT/session handlers)
- **FIX**: Fixed debounce/throttle `this` context bug in utils.js
- **FIX**: Removed duplicate `filterAkunMitra` function
- **IMPROVED**: Code consistency across all modules
- **IMPROVED**: Cleaned up unused code and dead functions
- **NEW**: JWT auto-capture from manajemen-mitra.bps.go.id
- **NEW**: Compact floating status card for session monitoring
- **NEW**: Modern session check toast with loading state

### v5.0.0 (2026-04-05)
- **NEW**: Manajemen Mitra module
  - Dashboard Mitra dengan stats
  - Mitra KEPKA (Basic/Detail mode)
  - Scrapping Mitra dengan export
  - Seleksi Mitra
  - Akun Mitra (paginated)
- **NEW**: Dual session management (FASIH + Mitra)
- **NEW**: Profile image dari community.bps.go.id
- **NEW**: Sidebar dengan 2 menu groups (FASIH & Manajemen Mitra)
- **NEW**: Session status indicator (online/offline)
- **IMPROVED**: Loading overlay dengan step animation
- **IMPROVED**: Responsive design untuk mobile
- **IMPROVED**: Dark mode consistency

### v4.1 (2026-04-04)
- Fix ES module loading issue
- Fix CSP untuk Fetch/XHR
- Fix utils import error
- Fix label accessibility
- Hapus file/folder tidak digunakan
- Update README lengkap

### v4.0 (2026-04-04)
- Refactor dari single file ke modular
- ES modules support
- EventBus untuk communication
- Centralized config dan logger

### v3.8
- User Allocation feature
- Progress tracking
- Overwrite/Direct Assign options

## 👨‍💻 Developer

**BPS Kabupaten Kutai Kartanegara**

Untuk bug report atau feature request, silakan hubungi developer.

## 📄 License

Internal use only - BPS Kabupaten Kutai Kartanegara