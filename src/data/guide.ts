export interface GuideStep {
  id: string;
  stepNumber: number;
  title: string;
  shortDescription: string;
  fullText: string[];
  checklist?: string[];
  codeBlock?: {
    language: string;
    code: string;
    caption?: string;
  };
  fieldExamples?: Array<{
    field: string;
    description: string;
    example: string;
  }>;
  actionButton?: {
    label: string;
    href: string;
  };
}

export interface GuideFaqItem {
  id: string;
  errorCode: string;
  title: string;
  cause: string;
  solution: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "langkah-1",
    stepNumber: 1,
    title: "Siapkan Databricks",
    shortDescription: "Persiapan SQL Warehouse, Catalog/Schema/Volume, dan Access Token.",
    fullText: [
      "Langkah pertama adalah memastikan workspace Databricks Anda sudah memiliki komputasi dan tempat penyimpanan data.",
      "Anda membutuhkan SQL Warehouse aktif untuk mengeksekusi query, serta Unity Catalog dengan Skema dan Volume sebagai tujuan penyimpanan berkas.",
      "Terakhir, buat Personal Access Token (PAT) melalui menu Settings > Developer > Access tokens di Databricks Workspace Anda.",
    ],
    checklist: [
      "SQL Warehouse berstatus Running (disarankan tipe Serverless atau Pro).",
      "Katalog, Skema, dan Volume Unity Catalog telah dibuat atau gunakan yang sudah ada.",
      "Personal Access Token (PAT) telah disalin dan disimpan dengan aman.",
    ],
  },
  {
    id: "langkah-2",
    stepNumber: 2,
    title: "Beri Izin Akses",
    shortDescription: "Berikan hak akses SQL Unity Catalog kepada pengguna atau token.",
    fullText: [
      "Agar aplikasi dapat membaca dan menulis data ke Unity Catalog, token pengguna membutuhkan hak akses khusus pada level katalog, skema, dan volume.",
      "Buka menu SQL Editor di Databricks Workspace Anda, lalu jalankan perintah SQL berikut menggunakan akun yang memiliki hak administrator.",
      "Sesuaikan nama katalog (main), skema (csv_tidy), volume (raw_uploads), dan email pengguna dengan konfigurasi Anda.",
    ],
    codeBlock: {
      language: "sql",
      code: `-- 1. Izin penggunaan Katalog
GRANT USE CATALOG ON CATALOG \`main\` TO \`nama_pengguna@email.com\`;

-- 2. Izin penggunaan Skema dan pembuatan Tabel
GRANT USE SCHEMA, CREATE TABLE ON SCHEMA \`main\`.\`csv_tidy\` TO \`nama_pengguna@email.com\`;

-- 3. Izin baca dan tulis ke Volume
GRANT READ VOLUME, WRITE VOLUME ON VOLUME \`main\`.\`csv_tidy\`.\`raw_uploads\` TO \`nama_pengguna@email.com\`;`,
      caption: "Salin dan jalankan query di Databricks SQL Editor",
    },
    checklist: [
      "Ganti nama_pengguna@email.com dengan akun pemilik token PAT Anda.",
      "Jalankan query hingga muncul status Success pada Databricks SQL Editor.",
    ],
  },
  {
    id: "langkah-3",
    stepNumber: 3,
    title: "Isi Pengaturan",
    shortDescription: "Hubungkan aplikasi ke Databricks melalui halaman Pengaturan.",
    fullText: [
      "Buka halaman Pengaturan untuk memasukkan kredensial koneksi Databricks Anda.",
      "Semua data kredensial disimpan aman pada server lokal dan token dienkripsi menggunakan AES-256-GCM tanpa pernah dikirim kembali ke browser.",
      "Setelah mengisi data, klik tombol 'Tes Koneksi' untuk memverifikasi bahwa URL, Warehouse, Token, dan Volume sudah terhubung hijau.",
    ],
    fieldExamples: [
      {
        field: "Workspace URL",
        description: "Alamat URL instans Databricks Workspace Anda.",
        example: "https://dbc-f8a4707b-9fe1.cloud.databricks.com",
      },
      {
        field: "SQL Warehouse ID",
        description: "ID SQL Warehouse (dapat dilihat di tab SQL Warehouses > Connection details).",
        example: "5e6af75272a52041",
      },
      {
        field: "Personal Access Token",
        description: "Token otentikasi Databricks yang diawali dengan dapi...",
        example: "dapi1234567890abcdef...",
      },
      {
        field: "Katalog Default",
        description: "Nama katalog Unity Catalog tempat data disimpan.",
        example: "main",
      },
      {
        field: "Skema Default",
        description: "Nama skema di dalam katalog yang dituju.",
        example: "csv_tidy",
      },
      {
        field: "Volume Default",
        description: "Nama volume tempat penampungan berkas mentah.",
        example: "raw_uploads",
      },
    ],
    actionButton: {
      label: "Buka Halaman Pengaturan",
      href: "/settings",
    },
    checklist: [
      "Isi semua kolom dengan teliti sesuai workspace Anda.",
      "Klik tombol 'Simpan Pengaturan'.",
      "Klik tombol 'Tes Koneksi' dan pastikan indikator berubah menjadi hijau.",
    ],
  },
  {
    id: "langkah-4",
    stepNumber: 4,
    title: "Upload File",
    shortDescription: "Unggah berkas data CSV, TSV, atau Excel (.xlsx) dengan pembersihan otomatis.",
    fullText: [
      "Pilih atau seret berkas data Anda ke area upload pada halaman Impor. Aplikasi mendukung format .csv, .tsv, dan .xlsx dengan ukuran hingga 500 MB.",
      "Aplikasi menormalisasi data saat streaming secara langsung tanpa membebani memori server.",
      "Tanda kutip pembungkus yang berantakan, header ganda, baris total, dan encoding lawas (Latin-1/Windows-1252) akan diperbaiki otomatis menjadi UTF-8 bersih.",
    ],
    checklist: [
      "Format berkas yang didukung: .csv, .tsv, dan .xlsx.",
      "Untuk berkas Excel dengan banyak sheet, Anda dapat memilih lembar kerja yang ingin diimpor.",
      "Periksa kartu 'Hasil Deteksi' setelah upload untuk melihat ringkasan baris dan perbaikan otomatis.",
    ],
    actionButton: {
      label: "Mulai Impor Berkas",
      href: "/",
    },
  },
  {
    id: "langkah-5",
    stepNumber: 5,
    title: "Periksa Pratinjau",
    shortDescription: "Tinjau data sebelum dan sesudah perbaikan, lalu sesuaikan kolom.",
    fullText: [
      "Setelah berkas terunggah, buka halaman Tidy untuk meninjau pratinjau tabel secara interaktif.",
      "Tampilan komparasi menunjukkan kondisi data mentah versus hasil pembersihan secara berdampingan.",
      "Anda dapat mengubah nama kolom, memilih tipe data (STRING, BIGINT, DOUBLE, DATE, TIMESTAMP), atau menandai aturan validasi khusus.",
    ],
    checklist: [
      "Periksa apakah baris header dan nama kolom sudah tepat.",
      "Ubah tipe data kolom sesuai kebutuhan analitik Anda.",
      "Tinjau rekomendasi pembersihan otomatis pada kartu rencana pembersihan.",
    ],
  },
  {
    id: "langkah-6",
    stepNumber: 6,
    title: "Kirim ke Databricks",
    shortDescription: "Pilih tabel target, mode tulis, dan terbitkan data ke Unity Catalog.",
    fullText: [
      "Langkah terakhir adalah mempublikasikan data bersih menjadi Delta Lake Table resmi di Databricks Unity Catalog.",
      "Tentukan nama tabel tujuan dan tentukan mode penulisan: Buat Baru (membuat tabel baru), Tambah Data (append ke tabel ada), atau Timpa (overwrite seluruh data lama).",
      "Setelah proses selesai, klik tautan tabel untuk langsung membukanya di Databricks Data Explorer.",
    ],
    checklist: [
      "Pilih mode tulis yang sesuai: Buat Baru, Tambah Data, atau Timpa.",
      "Pastikan nama tabel tujuan valid (hanya huruf, angka, dan underscore).",
      "Klik tombol 'Eksekusi Pembersihan & Simpan ke Databricks'.",
      "Buka tautan tabel Databricks untuk mulai menganalisis data dengan SQL atau notebook.",
    ],
  },
];

export const GUIDE_FAQS: GuideFaqItem[] = [
  {
    id: "faq-token",
    errorCode: "ERR_AUTH_FAILED",
    title: "Token Tidak Valid atau Kadaluarsa",
    cause: "Personal Access Token salah ketik, telah dicabut di Databricks, atau melewati masa aktif (expired).",
    solution: "Buka halaman Pengaturan, klik 'Ganti token', masukkan token baru yang masih aktif dari Databricks (Settings > Developer > Access tokens), lalu klik Simpan.",
  },
  {
    id: "faq-warehouse",
    errorCode: "ERR_WAREHOUSE_STOPPED",
    title: "SQL Warehouse Berhenti (Stopped)",
    cause: "SQL Warehouse dalam status mati untuk menghemat biaya komputasi.",
    solution: "Buka Databricks Workspace > SQL Warehouses, klik tombol 'Start' pada warehouse Anda, atau tunggu 1-2 menit karena Databricks akan menyalakan warehouse secara otomatis saat query masuk.",
  },
  {
    id: "faq-permission",
    errorCode: "ERR_PERMISSION_DENIED",
    title: "Izin Akses Ditolak (Permission Denied)",
    cause: "Akun Databricks Anda belum memiliki izin USE CATALOG, USE SCHEMA, READ/WRITE VOLUME, atau CREATE TABLE.",
    solution: "Minta admin workspace menjalankan perintah SQL pada Langkah 2 di atas untuk memberikan hak akses kepada akun atau service principal Anda.",
  },
  {
    id: "faq-volume",
    errorCode: "ERR_TARGET_NOT_FOUND",
    title: "Volume atau Skema Tidak Ditemukan",
    cause: "Nama Katalog, Skema, atau Volume yang diisi di Pengaturan salah eja atau belum dibuat di Databricks.",
    solution: "Periksa kembali ejaan nama di halaman Pengaturan. Jika belum ada, buat volume baru di Databricks dengan perintah: CREATE VOLUME IF NOT EXISTS `katalog`.`skema`.`volume`;",
  },
  {
    id: "faq-format",
    errorCode: "ERR_UNSUPPORTED_FORMAT / ERR_NO_HEADER",
    title: "Format Berkas atau Header Tidak Dikenali",
    cause: "Ekstensi berkas bukan .csv, .tsv, atau .xlsx, isi berkas kosong, atau tidak terdapat baris yang dapat diidentifikasi sebagai nama kolom.",
    solution: "Pastikan berkas berformat .csv, .tsv, atau .xlsx. Buka berkas Anda di spreadsheet dan pastikan baris pertama atau kedua berisi nama-nama kolom yang jelas tanpa sel kosong menyeluruh.",
  },
];
