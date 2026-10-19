"use client";

import * as React from "react";
import Link from "next/link";
import {
  UploadCloud,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  HardDrive,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
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
        suggestion: "Pilih berkas dengan format .csv, .tsv, atau .xlsx.",
      });
      return;
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > maxSizeMb) {
      toast.error(`Ukuran berkas (${sizeInMb.toFixed(1)} MB) melebihi batas maksimum ${maxSizeMb} MB.`);
      setErrorMessage({
        text: `Ukuran berkas (${sizeInMb.toFixed(1)} MB) melebihi batas maksimum.`,
        suggestion: `Batas upload adalah ${maxSizeMb} MB. Perkecil berkas atau ubah batas di Pengaturan.`,
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
          toast.success("Berkas berhasil dinormalisasi dan diunggah.");
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
    toast.success("Tersalin ke papan klip.");
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
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10">
      <PageHeader
        title="Impor"
        description="Normalisasi cerdas dan alirkan berkas CSV, TSV, atau Excel langsung ke Databricks Unity Catalog."
      >
        <Link
          href="/guide#langkah-4"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Butuh bantuan?</span>
        </Link>
      </PageHeader>

      {isConfigured === false && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-zinc-900">Koneksi Databricks belum diatur</h3>
              <p className="text-[13px] text-zinc-600">
                Atur koneksi terlebih dahulu agar berkas dapat diunggah langsung ke Unity Catalog Volume.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button asChild size="sm">
              <Link href="/settings">Pengaturan</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/guide#langkah-3">Panduan</Link>
            </Button>
          </div>
        </div>
      )}

      <Section
        title="Target Penyimpanan"
        description="Volume Unity Catalog yang menjadi lokasi penyimpanan berkas hasil streaming."
        card
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Katalog" htmlFor="catalog">
              <Input
                id="catalog"
                type="text"
                value={catalog}
                onChange={(e) => setCatalog(e.target.value)}
                disabled={uploading || inspectingSheets}
                placeholder="main"
                className="font-mono text-[13px]"
              />
            </Field>

            <Field label="Skema" htmlFor="schema">
              <Input
                id="schema"
                type="text"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                disabled={uploading || inspectingSheets}
                placeholder="csv_tidy"
                className="font-mono text-[13px]"
              />
            </Field>

            <Field label="Volume" htmlFor="volume">
              <Input
                id="volume"
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                disabled={uploading || inspectingSheets}
                placeholder="raw_uploads"
                className="font-mono text-[13px]"
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
            <HardDrive className="h-3.5 w-3.5 text-zinc-400" />
            <span>Lokasi:</span>
            <code className="font-mono text-zinc-800">
              /Volumes/{catalog || "main"}/{schema || "csv_tidy"}/{volume || "raw_uploads"}
            </code>
          </div>
        </div>
      </Section>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-white p-5 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-rose-900">{errorMessage.text}</h4>
              {errorMessage.suggestion && (
                <p className="text-[13px] text-zinc-600 leading-normal">{errorMessage.suggestion}</p>
              )}
            </div>
          </div>
          <div className="pl-8">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetUpload}
            >
              Coba Berkas Lain
            </Button>
          </div>
        </div>
      )}

      {pendingFile && sheetOptions.length > 1 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-zinc-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-900">
                Pilih Lembar Kerja (Sheet)
              </h3>
              <p className="text-[13px] text-zinc-600">
                Berkas &quot;{pendingFile.name}&quot; memiliki {sheetOptions.length} sheet. Pilih sheet yang ingin diimpor:
              </p>
            </div>
          </div>

          <div className="max-w-xs">
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors shadow-xs"
            >
              {sheetOptions.map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
            <Button size="sm" onClick={confirmSheetAndUpload}>
              Lanjutkan Impor
            </Button>
            <Button variant="secondary" size="sm" onClick={resetUpload}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {!uploadResult && !pendingFile && (
        <div
          className={`relative rounded-xl border border-dashed transition-colors duration-150 bg-white p-12 text-center cursor-pointer select-none ${
            dragActive
              ? "border-indigo-600 bg-indigo-50/20"
              : "border-zinc-300 hover:border-zinc-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!uploading && !inspectingSheets) {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.xlsx"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 transition-transform duration-150">
              <UploadCloud className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-900">
                Pilih atau seret berkas ke sini
              </h3>
              <p className="text-[13px] text-zinc-500 max-w-sm mx-auto">
                Mendukung .csv, .tsv, dan .xlsx hingga {maxSizeMb} MB.
              </p>
            </div>
          </div>

          {inspectingSheets && (
            <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-zinc-600">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
              <span>Memeriksa lembar kerja Excel...</span>
            </div>
          )}

          {uploading && (
            <div
              className="mt-6 max-w-md mx-auto space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900 truncate max-w-[240px]">
                  {selectedFile?.name}
                </span>
                <span className="font-mono text-zinc-600">{progress}%</span>
              </div>

              <Progress value={progress} className="h-1.5" />

              <div className="flex items-center justify-between text-[13px] text-zinc-500">
                <span>Mengalirkan ke Databricks...</span>
                {uploadSpeed && <span className="font-mono text-xs">{uploadSpeed}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {uploadResult && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-zinc-900">
                  Pengunggahan Berhasil
                </h3>
                <p className="text-[13px] text-zinc-600">
                  Berkas telah dinormalisasi dan dialirkan ke Unity Catalog Volume.
                </p>
              </div>
            </div>
          </div>

          {uploadResult.detection && (
            <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-zinc-900">Hasil Deteksi & Normalisasi</h4>
                </div>
                <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                  Siap Diproses
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-zinc-500 block">Encoding</span>
                  <span className="font-mono font-semibold text-zinc-900 mt-0.5 block">
                    {uploadResult.detection.encoding}
                  </span>
                </div>
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-zinc-500 block">Pemisah</span>
                  <span className="font-mono font-semibold text-zinc-900 mt-0.5 block">
                    {getDelimiterLabel(uploadResult.detection.delimiter)}
                  </span>
                </div>
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-zinc-500 block">Jumlah Baris</span>
                  <span className="font-mono font-semibold text-zinc-900 mt-0.5 block">
                    {uploadResult.detection.rowCount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="rounded-md border border-zinc-200 bg-white p-2.5">
                  <span className="text-zinc-500 block">Jumlah Kolom</span>
                  <span className="font-mono font-semibold text-zinc-900 mt-0.5 block">
                    {uploadResult.detection.columnCount}
                  </span>
                </div>
              </div>

              {uploadResult.detection.sheetName && (
                <div className="text-xs text-zinc-600">
                  <span className="text-zinc-500">Sheet:</span>{" "}
                  <span className="font-medium text-zinc-900">{uploadResult.detection.sheetName}</span>
                </div>
              )}

              {uploadResult.detection.fixesApplied && uploadResult.detection.fixesApplied.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-medium text-zinc-700">Perbaikan otomatis:</span>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5">
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-500">ID Pekerjaan</span>
                <p className="font-mono text-xs font-semibold text-zinc-900">{uploadResult.jobId}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2.5"
                onClick={() => copyToClipboard(uploadResult.jobId, "jobId")}
              >
                {copiedField === "jobId" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedField === "jobId" ? "Tersalin" : "Salin"}</span>
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5">
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-500">Lokasi Volume</span>
                <p className="font-mono text-xs text-zinc-700 break-all">{uploadResult.volumeFilePath}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2.5"
                onClick={() => copyToClipboard(uploadResult.volumeFilePath, "path")}
              >
                {copiedField === "path" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedField === "path" ? "Tersalin" : "Salin"}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
            <Button variant="secondary" size="sm" onClick={resetUpload}>
              Unggah Berkas Lain
            </Button>

            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/history">
                  <span>Riwayat</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="sm">
                <Link href={`/tidy/${uploadResult.jobId}`}>
                  <span>Bersihkan CSV</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
