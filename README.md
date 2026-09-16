# 🎵 Spotify KW (Ultra-Lightweight Edition)

Aplikasi musik desktop alternatif Spotify yang dirancang khusus untuk memangkas konsumsi **RAM hingga >85%** dan **Storage hingga >99%** dibandingkan Spotify resmi berbasis Electron/Chromium, dengan tetap menyajikan kualitas audio penuh 320kbps, lirik tersinkronisasi (*synced lyrics*), audio visualizer, serta pemutar lagu lokal offline.

---

## ⚡ Perbandingan Efisiensi Sumber Daya

| Parameter | Spotify Resmi (Electron) | Spotify KW (Ultra-Lite) | Penghematan |
| :--- | :--- | :--- | :--- |
| **Pemakaian RAM** | 450 MB – 950 MB+ | **45 MB – 70 MB** | **Hemat ~90% RAM** |
| **Ukuran Instalasi** | ~550 MB | **< 5 MB** | **Hemat 99% Storage** |
| **Penumpukan Cache** | Sering 2 GB – 10 GB | **Terkontrol / 1-Klik Bersih** | **Bebas beban disk** |
| **Jumlah Proses OS** | 5 – 8 proses terpisah | **1 proses terpadu** | **CPU lebih dingin** |
| **Waktu Boot (Cold Start)**| ~4 – 6 detik | **< 1 detik** | **Instan** |

---

## 🚀 Fitur Unggulan

1. **Streaming Audio 320kbps High Fidelity**:
   - Pilihan bitrate: `320k High`, `160k Normal`, `96k Data Saver`.
   - Streaming parsial HTTP 206 (seeking instan tanpa jeda buffer).
2. **Katalog Lagu Global & Indonesia Lengkap**:
   - Pencarian multi-sumber (JioSaavn 320kbps + YouTube Music fallback untuk lagu langka/cover/remix).
3. **Lirik Tersinkronisasi (*Synced Lyrics / Karaoke Mode*)**:
   - Teks lirik berjalan otomatis baris per baris mengikuti detik musik secara real-time via LRCLIB.
4. **Audio Spectrum Visualizer**:
   - Visualisasi denyut frekuensi musik animasi neon green berbasis Web Audio API.
5. **Pemutar Lagu Lokal (Offline - 0 Kuota)**:
   - Pindai folder musik di komputer Anda (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`) atau seret & lepas (*drag & drop*) file langsung ke jendela aplikasi.
6. **Integrasi Tombol Keyboard Windows (MediaSession API)**:
   - Kendalikan Play/Pause, Next, Previous langsung dari tombol keyboard (Fn + Media Keys) atau tombol headset Bluetooth.
7. **Koleksi Pribadi & Antrean (Queue)**:
   - Simpan lagu favorit (*Liked Songs*) dan buat playlist kustom yang tersimpan rapi secara lokal.
8. **Live RAM & Storage Monitor**:
   - Indikator real-time di antarmuka yang menunjukkan penghematan RAM dan tombol 1-klik untuk membersihkan cache.

---

## 💻 Cara Menjalankan

### Cara 1: Menggunakan Skrip Satu-Klik (Paling Mudah)
Cukup klik dua kali (double-click) file:
```
run.bat
```
Aplikasi akan otomatis menyala dan membuka jendela desktop Spotify KW mandiri tanpa URL bar/tab.

### Cara 2: Menjalankan via Terminal
```bash
# Menggunakan virtual environment
.venv\Scripts\python.exe main.py
```
Aplikasi dapat diakses di: [http://127.0.0.1:8765](http://127.0.0.1:8765)

---

## ⌨️ Pintasan Keyboard (Shortcuts)

- **Spasi**: Putar / Jeda (Play / Pause)
- **Panah Kiri (←)**: Mundur 5 detik
- **Panah Kanan (→)**: Maju 5 detik
- **Panah Atas (↑)**: Tambah volume (+5%)
- **Panah Bawah (↓)**: Kurangi volume (-5%)
- **M**: Bisukan / Suarakan (Mute / Unmute)
- **L**: Buka / Tutup Layar Lirik Karaoke
- **V**: Buka / Tutup Visualizer Audio
- **Q**: Buka / Tutup Antrean Lagu (Queue)
