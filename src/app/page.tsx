"use client";

import * as React from "react";
import Link from "next/link";
import {
  UploadCloud,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Database,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Sparkles,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface DetectionResult {
  encoding: string;
  delimiter: string;
  headerRowIndex: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  fixesApplied: string[];
  sheetName?: string;
  availableSheets?: string[];
}

interface UploadResponse {
  success: boolean;
  jobId: string;
  fileName: string;
  fileSize: number;
  volumeFilePath: string;
  fullVolumePath: string;
  catalog: string;
  schema: string;
  volume: string;
  uploadedAt: string;
  detection?: DetectionResult;
  error?: string;
  suggestion?: string;
}

function getDelimiterLabel(d: string): string {
  switch (d) {
    case ",":
      return "Koma (,)";
    case ";":
      return "Titik Koma (;)";
    case "\t":
      return "Tab (\\t)";
    case "|":
      return "Pipe (|)";
    default:
      return d;
  }
}

export default function ImportPage() {
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [inspectingSheets, setInspectingSheets] = React.useState(false);
  const [sheetOptions, setSheetOptions] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState<string>("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  const [progress, setProgress] = React.useState(0);
  const [uploadSpeed, setUploadSpeed] = React.useState<string>("");
  const [uploadResult, setUploadResult] = React.useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<{ text: string; suggestion?: string } | null>(null);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const [catalog, setCatalog] = React.useState("");
  const [schema, setSchema] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [maxSizeMb, setMaxSizeMb] = React.useState(500);
  const [isConfigured, setIsConfigured] = React.useState<boolean | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/databricks/config-status");
        if (res.ok) {
          const data = await res.json();
          setIsConfigured(Boolean(data.isConfigured));
          if (data.defaultCatalog) setCatalog(data.defaultCatalog);
          if (data.defaultSchema) setSchema(data.defaultSchema);
          if (data.defaultVolume) setVolume(data.defaultVolume);
          if (data.maxUploadSizeMb) setMaxSizeMb(data.maxUploadSizeMb);
        }
      } catch {
      }
    }
    loadConfig();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "tsv", "xlsx"].includes(ext || "")) {
      toast.error("Format berkas tidak didukung. Harap unggah CSV, TSV, atau XLSX.");
      setErrorMessage({
        text: "Format berkas tidak didukung.",
        suggestion: "Pilih berkas dengan ekstensi .csv, .tsv, atau .xlsx.",
      });
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > maxSizeMb) {
      toast.error(`Ukuran berkas (${sizeInMb.toFixed(1)} MB) melebihi batas maksimum ${maxSizeMb} MB.`);
      setErrorMessage({
        text: `Ukuran berkas (${sizeInMb.toFixed(1)} MB) melebihi batas maksimum.`,
        suggestion: `Batas upload saat ini adalah ${maxSizeMb} MB. Perkecil ukuran berkas atau ubah konfigurasi pada halaman Pengaturan.`,
      });
      return;
    }

    if (ext === "xlsx") {
      setInspectingSheets(true);
      try {
        const res = await fetch("/api/upload/sheets", {
          method: "POST",
          body: file,
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.sheets) && data.sheets.length > 1) {
            setPendingFile(file);
            setSheetOptions(data.sheets);
            setSelectedSheet(data.sheets[0]);
            setInspectingSheets(false);
            return;
          } else if (Array.isArray(data.sheets) && data.sheets.length === 1) {
            setInspectingSheets(false);
            setSelectedFile(file);
            startUpload(file, data.sheets[0]);
            return;
          }
        }
      } catch {
      }
      setInspectingSheets(false);
    }

    setSelectedFile(file);
    startUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const startUpload = (file: File, sheetName?: string) => {
    setUploading(true);
    setProgress(0);
    setUploadResult(null);
    setErrorMessage(null);

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({
      filename: encodeURIComponent(file.name),
      catalog,
      schema,
      volume,
    });
    if (sheetName) {
      query.set("sheet", encodeURIComponent(sheetName));
    }

    xhr.open("POST", `/api/upload?${query.toString()}`, true);
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-catalog", catalog);
    xhr.setRequestHeader("x-schema", schema);
    xhr.setRequestHeader("x-volume", volume);
    if (sheetName) {
      xhr.setRequestHeader("x-sheet", encodeURIComponent(sheetName));
    }
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);

        const currentTime = Date.now();
        const timeDiff = (currentTime - lastTime) / 1000;
        if (timeDiff >= 0.5) {
          const loadedDiff = event.loaded - lastLoaded;
          const speedBytesPerSec = loadedDiff / timeDiff;
          const speedMb = (speedBytesPerSec / (1024 * 1024)).toFixed(1);
          setUploadSpeed(`${speedMb} MB/s`);
          lastLoaded = event.loaded;
          lastTime = currentTime;
        }
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const response: UploadResponse = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.success) {
          setUploadResult(response);
          toast.success("Berkas berhasil dinormalisasi dan diunggah ke Unity Catalog Volume.");
        } else {
          setErrorMessage({
            text: response.error || "Gagal memproses berkas.",
            suggestion: response.suggestion,
          });
          toast.error(response.error || "Gagal memproses berkas.");
        }
      } catch {
        setErrorMessage({
          text: "Terjadi galat pada server saat memproses berkas.",
          suggestion: "Periksa log server atau ulangi beberapa saat lagi.",
        });
        toast.error("Terjadi galat respons server.");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setErrorMessage({
        text: "Koneksi jaringan terputus saat pengunggahan.",
        suggestion: "Periksa koneksi internet Anda dan coba lagi.",
      });
      toast.error("Koneksi jaringan terputus saat pengunggahan.");
    };

    xhr.send(file);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success("Tersalin ke clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setPendingFile(null);
    setSheetOptions([]);
    setSelectedSheet("");
    setUploadResult(null);
    setErrorMessage(null);
    setProgress(0);
    setUploadSpeed("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmSheetAndUpload = () => {
    if (!pendingFile) return;
    const file = pendingFile;
    const sheet = selectedSheet;
    setPendingFile(null);
    setSelectedFile(file);
    startUpload(file, sheet);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Impor Berkas Data
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Normalisasi cerdas dan alirkan berkas CSV, TSV, atau Excel langsung ke Databricks Unity Catalog Volume.
          </p>
        </div>
        <Link
          href="/guide#langkah-4"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 self-start sm:self-center"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Butuh bantuan?</span>
        </Link>
      </div>

      {isConfigured === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Koneksi Databricks belum diatur</span>
          </div>
          <p className="text-amber-800 pl-6 leading-relaxed">
            Atur koneksi Databricks terlebih dahulu agar berkas dapat diunggah dan disimpan langsung ke Unity Catalog Volume.
          </p>
          <div className="flex items-center gap-2 pl-6 pt-1">
            <Button asChild size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link href="/settings">Pengaturan</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100">
              <Link href="/guide#langkah-3">Panduan</Link>
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
            <Database className="h-4 w-4 text-indigo-600" />
            <span>Target Penyimpanan Unity Catalog</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium">Katalog</label>
              <input
                type="text"
                value={catalog}
                onChange={(e) => setCatalog(e.target.value)}
                disabled={uploading || inspectingSheets}
                className="mt-1 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                placeholder="main"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Skema</label>
              <input
                type="text"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                disabled={uploading || inspectingSheets}
                className="mt-1 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                placeholder="csv_tidy"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Volume</label>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                disabled={uploading || inspectingSheets}
                className="mt-1 h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                placeholder="raw_uploads"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <HardDrive className="h-3.5 w-3.5 text-indigo-600" />
            <span>Path Volume:</span>
            <code className="rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-mono text-indigo-600 font-medium">
              /Volumes/{catalog}/{schema}/{volume}
            </code>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-800 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage.text}</span>
          </div>
          {errorMessage.suggestion && (
            <p className="text-rose-700 pl-6">
              Saran: {errorMessage.suggestion}
            </p>
          )}
          <div className="pl-6 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={resetUpload}
              className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
            >
              Coba Berkas Lain
            </Button>
          </div>
        </div>
      )}

      {pendingFile && sheetOptions.length > 1 && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Pilih Lembar Kerja (Sheet) Excel
                </h3>
                <p className="text-xs text-zinc-500">
                  Berkas &quot;{pendingFile.name}&quot; memiliki {sheetOptions.length} lembar kerja. Pilih sheet yang ingin diimpor:
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                Sheet Target
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {sheetOptions.map((sh) => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={confirmSheetAndUpload}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Lanjutkan Impor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetUpload}
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!uploadResult && !pendingFile && (
        <Card
          className={`border-2 border-dashed transition-all ${
            dragActive
              ? "border-indigo-600 bg-indigo-50/50"
              : "border-zinc-300 hover:border-zinc-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.xlsx"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all ${
                dragActive
                  ? "bg-indigo-100 border-indigo-600 text-indigo-600 scale-105"
                  : "bg-zinc-100 border-zinc-200 text-zinc-600"
              }`}
            >
              <UploadCloud className="h-7 w-7" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              Tarik & Letakkan Berkas di Sini
            </h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-md">
              Mendukung CSV, TSV, dan Excel (.xlsx). Encoding (UTF-8, Latin-1, Windows-1252), tanda kutip, dan header dinormalisasi otomatis.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || inspectingSheets}
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Pilih Berkas (.csv, .tsv, .xlsx)</span>
            </Button>

            <p className="mt-3 text-xs text-zinc-400">
              Maksimum {maxSizeMb} MB per berkas.
            </p>

            {inspectingSheets && (
              <div className="mt-6 flex items-center gap-2 text-xs text-indigo-600">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Memeriksa lembar kerja Excel...</span>
              </div>
            )}

            {uploading && (
              <div className="mt-6 w-full max-w-md space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-600 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Menormalisasi & mengalirkan ke Databricks...
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progress}%
                  </span>
                </div>

                <Progress value={progress} className="h-2" />

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="truncate max-w-[200px]">{selectedFile?.name}</span>
                  {uploadSpeed && (
                    <span className="font-mono text-indigo-600 font-medium">
                      {uploadSpeed}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Pengunggahan Berhasil
                </h3>
                <p className="text-xs text-zinc-500">
                  Berkas telah dinormalisasi menjadi UTF-8 CSV dan dialirkan utuh ke Unity Catalog Volume.
                </p>
              </div>
            </div>

            {uploadResult.detection && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-zinc-900">Hasil Deteksi & Normalisasi</h4>
                  </div>
                  <span className="text-xs font-mono font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                    Bersih & Siap
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                    <span className="text-zinc-500 block">Encoding Sumber</span>
                    <span className="font-semibold text-zinc-900 font-mono mt-0.5 block">
                      {uploadResult.detection.encoding}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                    <span className="text-zinc-500 block">Pemisah (Delimiter)</span>
                    <span className="font-semibold text-zinc-900 font-mono mt-0.5 block">
                      {getDelimiterLabel(uploadResult.detection.delimiter)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                    <span className="text-zinc-500 block">Baris Data</span>
                    <span className="font-semibold text-zinc-900 font-mono mt-0.5 block">
                      {uploadResult.detection.rowCount.toLocaleString("id-ID")} baris
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
                    <span className="text-zinc-500 block">Jumlah Kolom</span>
                    <span className="font-semibold text-zinc-900 font-mono mt-0.5 block">
                      {uploadResult.detection.columnCount} kolom
                    </span>
                  </div>
                </div>

                {uploadResult.detection.sheetName && (
                  <div className="text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2.5 border border-zinc-200">
                    <span className="text-zinc-500 font-medium">Sheet Terpilih:</span>{" "}
                    <span className="font-semibold text-zinc-900">{uploadResult.detection.sheetName}</span>
                  </div>
                )}

                {uploadResult.detection.fixesApplied && uploadResult.detection.fixesApplied.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-medium text-zinc-700">Perbaikan yang diterapkan:</span>
                    <ul className="space-y-1 text-xs text-zinc-600">
                      {uploadResult.detection.fixesApplied.map((fix, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  ID Pekerjaan (Job ID)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => copyToClipboard(uploadResult.jobId, "jobId")}
                >
                  {copiedField === "jobId" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedField === "jobId" ? "Tersalin" : "Salin"}</span>
                </Button>
              </div>
              <p className="font-mono text-xs font-bold text-indigo-600 break-all">
                {uploadResult.jobId}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Path Berkas Volume
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => copyToClipboard(uploadResult.volumeFilePath, "path")}
                >
                  {copiedField === "path" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedField === "path" ? "Tersalin" : "Salin"}</span>
                </Button>
              </div>
              <p className="font-mono text-xs text-zinc-700 break-all">
                {uploadResult.volumeFilePath}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <span className="text-zinc-500">Ukuran Asli</span>
                <p className="font-semibold text-zinc-900 mt-0.5">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <span className="text-zinc-500">Waktu Pengunggahan</span>
                <p className="font-semibold text-zinc-900 mt-0.5">
                  {new Date(uploadResult.uploadedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetUpload}
                className="gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Unggah Berkas Lain</span>
              </Button>

              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/history">
                  <span>Lihat Riwayat</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="sm" className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
                <Link href={`/tidy/${uploadResult.jobId}`}>
                  <Sparkles className="h-4 w-4" />
                  <span>Bersihkan CSV Sekarang</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
