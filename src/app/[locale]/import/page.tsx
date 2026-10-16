"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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
  error?: string;
  suggestion?: string;
}

export default function ImportPage() {
  const t = useTranslations("import");
  const tCommon = useTranslations("common");

  // State
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadSpeed, setUploadSpeed] = React.useState<string>("");
  const [uploadResult, setUploadResult] = React.useState<UploadResponse | null>(null);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Unity Catalog Target
  const [catalog, setCatalog] = React.useState("main");
  const [schema, setSchema] = React.useState("csv_tidy");
  const [volume, setVolume] = React.useState("raw_uploads");
  const [maxSizeMb, setMaxSizeMb] = React.useState(500);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load config defaults on mount
  React.useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/databricks/config-status");
        if (res.ok) {
          const data = await res.json();
          if (data.defaultCatalog) setCatalog(data.defaultCatalog);
          if (data.defaultSchema) setSchema(data.defaultSchema);
          if (data.defaultVolume) setVolume(data.defaultVolume);
          if (data.maxUploadSizeMb) setMaxSizeMb(data.maxUploadSizeMb);
        }
      } catch {
        // Fallback to defaults
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

  const validateAndSetFile = (file: File) => {
    // Validate extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "tsv", "txt"].includes(ext || "")) {
      toast.error(t("invalidFileType"));
      return false;
    }

    // Validate size
    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > maxSizeMb) {
      toast.error(
        t("fileSizeExceeded", {
          size: sizeInMb.toFixed(1),
          maxSize: maxSizeMb,
        })
      );
      return false;
    }

    setSelectedFile(file);
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateAndSetFile(file)) {
        startUpload(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateAndSetFile(file)) {
        startUpload(file);
      }
    }
  };

  // Direct streaming upload to route handler using XMLHttpRequest for real-time byte tracking
  const startUpload = (file: File) => {
    setUploading(true);
    setProgress(0);
    setUploadResult(null);

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

    xhr.open("POST", `/api/upload?${query.toString()}`, true);
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-catalog", catalog);
    xhr.setRequestHeader("x-schema", schema);
    xhr.setRequestHeader("x-volume", volume);
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
          toast.success(t("uploadSuccess"));
        } else {
          toast.error(response.error || t("uploadError"));
          if (response.suggestion) {
            toast.info(response.suggestion);
          }
        }
      } catch {
        toast.error(t("uploadError"));
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      toast.error(t("uploadError"));
    };

    // Send raw file stream directly
    xhr.send(file);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success(tCommon("copied"));
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setProgress(0);
    setUploadSpeed("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Unity Catalog Destination Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Database className="h-4 w-4 text-primary" />
            <span>{t("destinationSettings")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                {t("catalog")}
              </label>
              <input
                type="text"
                value={catalog}
                onChange={(e) => setCatalog(e.target.value)}
                disabled={uploading}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background/50 px-3 text-xs font-mono font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="main"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                {t("schema")}
              </label>
              <input
                type="text"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                disabled={uploading}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background/50 px-3 text-xs font-mono font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="csv_tidy"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                {t("volume")}
              </label>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                disabled={uploading}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background/50 px-3 text-xs font-mono font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="raw_uploads"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5 text-primary" />
            <span>Target Volume Path: </span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-primary font-semibold">
              /Volumes/{catalog}/{schema}/{volume}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Main Upload / Drag-and-Drop Area */}
      <AnimatePresence mode="wait">
        {!uploadResult ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className={`relative overflow-hidden border-2 border-dashed transition-all ${
                dragActive
                  ? "border-primary bg-primary/5 shadow-lg scale-[1.005]"
                  : "border-border/80 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all ${
                    dragActive
                      ? "bg-primary/20 border-primary text-primary scale-110"
                      : "bg-primary/10 border-primary/20 text-primary"
                  }`}
                >
                  <UploadCloud className="h-8 w-8" />
                </div>

                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {t("dropzoneTitle")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dropzoneSubtitle")}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Pilih Berkas CSV</span>
                </Button>

                <p className="mt-4 text-xs text-muted-foreground/80">
                  {t("dropzoneHint", { maxSize: maxSizeMb })}
                </p>

                {/* Streaming Progress Bar */}
                {uploading && (
                  <div className="mt-8 w-full max-w-md space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        {t("uploading")}
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {progress}%
                      </span>
                    </div>

                    <Progress value={progress} className="h-2.5" />

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{selectedFile?.name}</span>
                      {uploadSpeed && (
                        <span className="font-mono text-primary font-medium">
                          {uploadSpeed}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Success Screen with Job ID and Volume details */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 mb-2">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-emerald-600 dark:text-emerald-400">
                  {t("uploadSuccess")}
                </CardTitle>
                <CardDescription>
                  Berkas telah dialirkan utuh ke Unity Catalog Volume tanpa konsumsi memori server.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 max-w-2xl mx-auto">
                {/* Job ID Display */}
                <div className="rounded-lg border border-border/70 bg-card p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("jobIdLabel")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => copyToClipboard(uploadResult.jobId, "jobId")}
                    >
                      {copiedField === "jobId" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedField === "jobId" ? tCommon("copied") : tCommon("copy")}</span>
                    </Button>
                  </div>
                  <p className="font-mono text-sm font-bold text-primary break-all">
                    {uploadResult.jobId}
                  </p>
                </div>

                {/* Volume Path Display */}
                <div className="rounded-lg border border-border/70 bg-card p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("filePathLabel")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() =>
                        copyToClipboard(uploadResult.volumeFilePath, "path")
                      }
                    >
                      {copiedField === "path" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedField === "path" ? tCommon("copied") : tCommon("copy")}</span>
                    </Button>
                  </div>
                  <p className="font-mono text-xs font-medium text-foreground break-all">
                    {uploadResult.volumeFilePath}
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <span className="text-muted-foreground">{t("fileSizeLabel")}</span>
                    <p className="font-semibold mt-0.5">
                      {selectedFile
                        ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <span className="text-muted-foreground">{t("uploadedAtLabel")}</span>
                    <p className="font-semibold mt-0.5">
                      {new Date(uploadResult.uploadedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={resetUpload}
                    className="gap-2 text-xs"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>{t("uploadAnother")}</span>
                  </Button>

                  <Button asChild className="gap-2 text-xs">
                    <Link href="/history">
                      <span>{t("goToHistory")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
