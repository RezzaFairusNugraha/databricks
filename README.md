# CSV Tidy

> **Pembersihan Data Skala Besar Berbasis Databricks Unity Catalog & Serverless SQL**  
> *Next.js 15 (App Router, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Table, Zustand, Zod)*

---

## 🌟 Ikhtisar Proyek (Overview)

**CSV Tidy** adalah aplikasi modern untuk mengimpor, memproses, dan membersihkan berkas data tabular berukuran besar (CSV, TSV, TXT) dengan memanfaatkan kekuatan komputasi terdistribusi **Databricks**. Seluruh pemrosesan berat dilakukan langsung di Databricks Unity Catalog dan SQL Warehouse, tanpa membebani memori server web.

### Aturan Inti Proyek (Core Architecture Rules)
1. **Zero-Memory Server Streaming**: Berkas CSV tidak pernah dimuat seutuhnya ke dalam RAM server web Node.js. Setiap unggahan dialirkan langsung (*piped streaming*) ke **Databricks Unity Catalog Volume** melalui endpoint resmi Files API (`/api/2.0/fs/files/...`).
2. **Kredensial Server-Side**: Kredensial Databricks (Host, Warehouse ID, PAT Token / OAuth M2M Service Principal) hanya berada di environment variables sisi server dan tidak pernah terekspos ke browser pengguna.
3. **Safe SQL Generation**: Seluruh query SQL dibangun oleh TypeScript melalui validasi skema ketat (**Zod**) dengan setiap identifier di-quote menggunakan backtick (`` `catalog`.`schema`.`table` ``). Tidak pernah menjalankan raw SQL bebas dari pengguna atau model AI.
4. **Bilingual UI**: Bahasa Indonesia sebagai bahasa utama antarmuka pengguna, dan Bahasa Inggris sebagai bahasa sekunder via `next-intl`.
5. **Modern Linear/Vercel Aesthetic**: Tampilan premium bernuansa modern dengan dark/light mode, palet warna aksen dinamis, kelengkungan sudut (*border radius*), dan jenis font yang dapat dikustomisasi secara real-time via CSS variables.

---

## 🔐 Hak Akses SQL Databricks (Required SQL Grants)

Untuk menjalankan CSV Tidy, pengguna atau Service Principal Databricks membutuhkan izin pada **Catalog**, **Schema**, **Volume**, dan **SQL Warehouse**.

Jalankan skrip SQL berikut di Databricks SQL Editor oleh Administrator workspace:

```sql
-- =============================================================================
-- 1. Buat Schema dan Volume jika belum ada
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS `main`.`csv_tidy`
  COMMENT 'Schema khusus untuk pipeline CSV Tidy';

CREATE VOLUME IF NOT EXISTS `main`.`csv_tidy`.`raw_uploads`
  COMMENT 'Volume Unity Catalog untuk menampung streaming berkas CSV';

-- =============================================================================
-- 2. Berikan Izin pada Level Catalog
-- Ganti `<principal_name>` dengan email pengguna atau ID Service Principal Anda
-- =============================================================================
GRANT USE CATALOG ON CATALOG `main` TO `<principal_name>`;

-- =============================================================================
-- 3. Berikan Izin pada Level Schema
-- =============================================================================
GRANT USE SCHEMA ON SCHEMA `main`.`csv_tidy` TO `<principal_name>`;
GRANT CREATE TABLE ON SCHEMA `main`.`csv_tidy` TO `<principal_name>`;
GRANT CREATE VOLUME ON SCHEMA `main`.`csv_tidy` TO `<principal_name>`;

-- =============================================================================
-- 4. Berikan Izin Read/Write pada Unity Catalog Volume
-- =============================================================================
GRANT READ VOLUME, WRITE VOLUME ON VOLUME `main`.`csv_tidy`.`raw_uploads` TO `<principal_name>`;

-- =============================================================================
-- 5. Berikan Izin Penggunaan SQL Warehouse
-- Ganti `<warehouse_id>` dengan ID 16-karakter SQL Warehouse Anda
-- =============================================================================
GRANT CAN_USE ON SQL WAREHOUSE `<warehouse_id>` TO `<principal_name>`;
```

---

## 🚀 Konfigurasi & Variabel Lingkungan (.env.local)

Salin berkas `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Isi variabel lingkungan berikut:

| Variabel | Keterangan | Contoh |
| :--- | :--- | :--- |
| `DATABRICKS_HOST` | URL workspace Databricks | `https://dbc-xxxx.cloud.databricks.com` |
| `DATABRICKS_WAREHOUSE_ID` | ID SQL Warehouse (16 hex chars) | `2a7f8e8199cd1234` |
| `DATABRICKS_TOKEN` | Personal Access Token (PAT) | `dapi...` |
| `DATABRICKS_CLIENT_ID` | OAuth M2M Client ID *(opsional)* | `xxxx-xxxx-xxxx` |
| `DATABRICKS_CLIENT_SECRET` | OAuth M2M Secret *(opsional)* | `xxxx-secret` |
| `DATABRICKS_DEFAULT_CATALOG`| Target Catalog Unity Catalog | `main` |
| `DATABRICKS_DEFAULT_SCHEMA` | Target Schema Unity Catalog | `csv_tidy` |
| `DATABRICKS_DEFAULT_VOLUME` | Target Volume Unity Catalog | `raw_uploads` |
| `MAX_UPLOAD_SIZE_MB` | Batas maksimum berkas (MB) | `500` |

---

## 💻 Menjalankan Proyek secara Lokal

Pastikan Anda telah menginstal **Node.js 20+** dan **pnpm 10+**:

```bash
# 1. Masuk ke direktori proyek
cd databricks

# 2. Instal dependensi
pnpm install

# 3. Jalankan server pengembangan (development mode)
pnpm dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

Untuk memeriksa build produksi secara lokal:

```bash
# Uji kompilasi produksi
pnpm build

# Jalankan server produksi
pnpm start
```

---

## 🐳 Deployment Menggunakan Docker

CSV Tidy menggunakan server **Node.js standar (bukan serverless / lambda)** sehingga unggahan berkas berukuran gigabyte dapat dialirkan tanpa batasan timeout pendek atau memory buffer limit:

```bash
# 1. Build image Docker
docker build -t csv-tidy:latest .

# 2. Jalankan container dengan menyertakan environment variables
docker run -d \
  -p 3000:3000 \
  --name csv-tidy-app \
  --env-file .env.local \
  csv-tidy:latest
```

Cek logs container:

```bash
docker logs -f csv-tidy-app
```

---

## 📁 Struktur Direktori Proyek

```text
├── Dockerfile                  # Multi-stage production container (Node runtime)
├── README.md                   # Dokumentasi, SQL Grants & petunjuk instalasi
├── messages/                   # File kamus multibahasa
│   ├── id.json                 # Bahasa Indonesia (Utama)
│   └── en.json                 # English (Sekunder)
├── src/
│   ├── app/
│   │   ├── [locale]/           # Halaman App Router ter-lokalisasi
│   │   │   ├── layout.tsx      # Shell layout utama (Sidebar, Header, Toaster)
│   │   │   ├── page.tsx        # Dashboard (Dasbor metrik & status pipeline)
│   │   │   ├── import/         # Halaman Impor Baru (Streaming drag & drop)
│   │   │   ├── history/        # Halaman Riwayat (TanStack Table)
│   │   │   └── settings/       # Pengaturan (Uji Koneksi & Customizer Tema)
│   │   ├── api/
│   │   │   ├── databricks/     # Handler pengujian & query Databricks
│   │   │   ├── upload/         # Streaming upload ke Databricks UC Volume
│   │   │   └── jobs/           # Query riwayat pekerjaan impor
│   │   └── globals.css         # Styling global, Tailwind v4 & CSS variables
│   ├── components/
│   │   ├── layout/             # Sidebar, Header, StatusPill
│   │   ├── theme-provider.tsx  # Sinkronisasi CSS variables warna/radius/font
│   │   └── ui/                 # Komponen UI (Button, Card, Input, Progress, dll.)
│   ├── i18n/                   # Konfigurasi routing & request next-intl
│   ├── lib/
│   │   ├── databricks/         # Server module Databricks
│   │   │   ├── client.ts       # testConnection, runSql, uploadToVolume, dll.
│   │   │   ├── config.ts       # Manajemen environment & token OAuth M2M
│   │   │   ├── errors.ts       # Pemetaan error ramah pengguna (ID/EN)
│   │   │   ├── sql-builder.ts  # Pembuat query SQL aman dengan identifier quoting
│   │   │   └── types.ts        # Tipe TypeScript & skema Zod
│   │   └── jobs.ts             # Manajemen riwayat pekerjaan lokal
│   └── store/
│       └── useThemeStore.ts    # State Zustand untuk preferensi tema/warna
```

---

## 📌 Checklist Langkah 1 (Step 1 Completed)

- [x] Scaffold Next.js 15 App Router dengan TypeScript, Tailwind CSS, Framer Motion, TanStack Table, Zustand, dan Zod.
- [x] Desain premium ala Linear/Vercel dengan mode terang/gelap, pilihan warna aksen, kelengkungan sudut, dan font via CSS variables.
- [x] Navigasi Sidebar terintegrasi: Dashboard, Impor Baru, Riwayat, dan Pengaturan.
- [x] Server module Databricks lengkap: `testConnection()`, `runSql()`, `listCatalogs()`, `listSchemas()`, `listTables()`, `uploadToVolume(stream)`.
- [x] Pemetaan error ramah pengguna (Izin ditolak, warehouse starting dengan retry otomatis, skema/katalog tidak ditemukan).
- [x] Halaman Pengaturan dengan tombol interaktif **"Test connection"** dan diagnosa real-time.
- [x] Halaman Unggah Impor Baru dengan drag-and-drop zone, progress bar streaming real-time, ukuran file yang dapat dikonfigurasi, dan pembuatan `jobId`.
- [x] Dukungan penuh Bahasa Indonesia sebagai default dan English via `next-intl`.
- [x] Dockerfile multi-stage berbasis Node runtime (non-serverless) untuk streaming data besar.
- [x] Dokumentasi SQL Grants lengkap pada README.md.
