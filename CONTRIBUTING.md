# Berkontribusi ke BPS Automation

Pertama-tama, terima kasih telah mempertimbangkan untuk berkontribusi ke BPS Automation! Ekstensi ini membantu tim BPS bekerja dengan lebih efisien, dan setiap kontribusi sangat berarti.

## Daftar Isi

- [Kode Etik](#kode-etik)
- [Memulai](#memulai)
- [Setup Development](#setup-development)
- [Standar Pengkodean](#standar-pengkodean)
- [Proses Pull Request](#proses-pull-request)
- [Panduan Commit Message](#panduan-commit-message)

## Kode Etik

- Bersikap hormat dan inklusif
- Terima umpan balik konstruktif dengan lapang dada
- Fokus pada yang terbaik untuk komunitas

## Memulai

### Prasyarat

- Chrome 88+ atau Edge 88+ (berbasis Chromium)
- VS Code (direkomendasikan) atau editor kode lainnya

### Setup Development

```bash
# 1. Fork dan clone repository
git clone https://github.com/akhirmbrk/bps-automation.git
cd bps-automation

# 2. Muat sebagai ekstensi terbongkar di Chrome
# Buka chrome://extensions/ → Mode Pengembang → Muat Ekstensi Terbongkar → Pilih folder
```

## Standar Pengkodean

### JavaScript/ES6+

```javascript
// ✅ LAKUKAN: Gunakan fitur ES6+ dan pola modern
const getConfig = () => config.get();
const { api, scraper } = config.get();

// ✅ LAKUKAN: Gunakan equality ketat
if (value === null) return;

// ❌ JANGAN: Gunakan var atau equality longgar
var config = getConfig();
if (value == null) return;
```

### Konvensi Penamaan

- **Variabel/Fungsi**: camelCase (`loadSurveys`, `isDarkMode`)
- **Kelas**: PascalCase (`App`, `ScraperService`)
- **Konstanta**: UPPER_SNAKE_CASE (`API_ENDPOINTS`, `MAX_RETRIES`)
- **File**: kebab-case (`auth-service.js`, `event-bus.js`)

### Pedoman Arsitektur

1. **Gunakan EventBus untuk komunikasi lintas modul** — Jangan impor modul langsung melintasi batas fitur
2. **Ekspor singleton dari modul** — Setiap modul mengekspor satu singleton instance
3. **Pusatkan konstanta** — Tambahkan konstanta baru ke `src/constants.js`, bukan inline
4. **Penanganan error** — Selalu gunakan try/catch untuk operasi async

### Gaya Kode

- Gunakan indentasi 2 spasi
- Semicolon wajib
- Kutip tunggal untuk string (kecuali perlu escape)
- Trailing commas di array/objek
- Tidak ada variabel atau import yang tidak digunakan

## Proses Pull Request

### Sebelum Mengirim

- [ ] Kode mengikuti standar proyek
- [ ] Tidak ada console.log atau debug statement
- [ ] Tidak ada data sensitif (token, kredensial)
- [ ] README.md diperbarui jika fitur berubah
- [ ] Diuji lokal di Chrome/Edge

### Template Deskripsi PR

```markdown
## Deskripsi
Ringkasan singkat perubahan yang dibuat.

## Jenis Perubahan
- [ ] Perbaikan bug (perubahan non-breaking)
- [ ] Fitur baru
- [ ] Perubahan breaking
- [ ] Pembaruan dokumentasi

## Pengujian
- [ ] Diuji lokal di Chrome
- [ ] Tidak ada error di console

## Checklist
- [ ] Kode mengikuti standar proyek
- [ ] Tidak ada data sensitif terlihat
- [ ] Perubahan didokumentasikan
```

## Panduan Commit Message

Kami mengikuti [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipe>(<scope>): <deskripsi>

[body opsional]
```

### Tipe

| Tipe | Gunakan Ketika |
|------|----------------|
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Hanya dokumentasi |
| `refactor` | Perubahan kode yang bukan perbaikan bug atau penambahan fitur |
| `style` | Format, semicolon hilang, dll |
| `test` | Menambah atau memperbarui test |
| `chore` | Tugas pemeliharaan |

### Contoh

```
feat(app): tambah auto-capture JWT dari manajemen-mitra
fix(utils): perbaiki binding this pada debounce
docs(readme): perbarui instruksi instalasi
refactor(scraper): ekstraksi logika pagination ke fungsi terpisah
chore(deps): perbarui library xlsx ke v0.18.0
```

## Struktur Proyek

```
src/
├── app.js              # Controller utama
├── constants.js        # Konstanta terpusat
├── core/               # Modul infrastruktur
├── modules/            # Modul fitur
│   ├── auth/           # Autentikasi
│   ├── surveys/        # Manajemen survei
│   ├── scraper/        # Ekstraksi data
│   ├── exporter/       # Layanan export
│   ├── allocation/     # Alokasi pengguna
│   └── mitra/          # Manajemen mitra
└── storage/            # Cache riwayat
```

## Butuh Bantuan?

Jika Anda memiliki pertanyaan, hubungi maintainer proyek melalui issue repository atau saluran komunikasi tim Anda.