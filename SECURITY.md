# Kebijakan Keamanan

## Versi yang Didukung

| Versi | Didukung          |
| ----- | ----------------- |
| 5.1.x | :white_check_mark: |
| < 5.0 | :x:               |

## Melaporkan Kerentanan

Proyek ini adalah ekstensi browser yang berinteraksi dengan sistem internal BPS (Badan Pusat Statistik). Keamanan adalah prioritas utama kami.

### Cara Melaporkan

**JANGAN melaporkan kerentanan keamanan melalui issue GitHub publik.**

Sebagai gantinya:

1. **Email**: Kirim laporan detail ke maintainer proyek Anda
2. **Sertakan**:
   - Jenis kerentanan
   - Langkah reproduksi
   - Penilaian dampak potensial
   - Saran perbaikan (jika ada)

### Yang Diharapkan

- **Konfirmasi**: Dalam 48 jam
- **Penilaian Awal**: Dalam 5 hari kerja
- **Pembaruan Status**: Pembaruan mingguan selama investigasi
- **Target Resolusi**: Kami berupaya mengatasi kerentanan kritis dalam 30 hari

### Lingkup Keamanan

Ekstensi ini memiliki akses ke:
- Cookie dan data sesi browser
- Token API (JWT)
- Informasi profil pengguna

Semua penanganan data sensitif mengikuti:
- Enkripsi penyimpanan native browser (Chrome mengenkripsi data tersimpan)
- Tidak ada kredensial hardcoded di source code
- Tidak ada logging informasi sensitif (token, password)