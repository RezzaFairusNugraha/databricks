"use client";

import * as React from "react";
import Link from "next/link";
import {
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  FolderTree,
  Edit2,
  Eye,
  EyeOff,
  Check,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConnectionTestResult } from "@/lib/databricks/types";

interface SafeSettingsData {
  host: string;
  warehouseId: string;
  tokenMasked: string;
  hasToken: boolean;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  volumePath: string;
  maxUploadSizeMb: number;
  isConfigured: boolean;
}

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const [host, setHost] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [tokenMasked, setTokenMasked] = React.useState("");
  const [hasToken, setHasToken] = React.useState(false);

  const [isChangingToken, setIsChangingToken] = React.useState(false);
  const [newToken, setNewToken] = React.useState("");
  const [showNewToken, setShowNewToken] = React.useState(false);

  const [catalog, setCatalog] = React.useState("main");
  const [schema, setSchema] = React.useState("csv_tidy");
  const [volume, setVolume] = React.useState("raw_uploads");
  const [maxUploadSizeMb, setMaxUploadSizeMb] = React.useState(500);

  const [catalogsList, setCatalogsList] = React.useState<string[]>([]);
  const [schemasList, setSchemasList] = React.useState<string[]>([]);
  const [volumesList, setVolumesList] = React.useState<string[]>([]);
  const [loadingMetadata, setLoadingMetadata] = React.useState(false);

  const [manualCatalog, setManualCatalog] = React.useState(false);
  const [manualSchema, setManualSchema] = React.useState(false);
  const [manualVolume, setManualVolume] = React.useState(false);

  const [testResult, setTestResult] = React.useState<ConnectionTestResult | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/databricks/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s: SafeSettingsData = data.settings;
        setHost(s.host || "");
        setWarehouseId(s.warehouseId || "");
        setTokenMasked(s.tokenMasked || "");
        setHasToken(s.hasToken);
        setCatalog(s.defaultCatalog || "main");
        setSchema(s.defaultSchema || "csv_tidy");
        setVolume(s.defaultVolume || "raw_uploads");
        setMaxUploadSizeMb(s.maxUploadSizeMb || 500);

        if (!s.hasToken) {
          setIsChangingToken(true);
        }
      }
    } catch {
      toast.error("Gagal memuat pengaturan Databricks.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadCatalogs = React.useCallback(async () => {
    setLoadingMetadata(true);
    try {
      const res = await fetch("/api/databricks/catalogs");
      const data = await res.json();
      if (data.success && Array.isArray(data.catalogs)) {
        const names = data.catalogs.map((c: { name: string }) => c.name);
        setCatalogsList(names);
        if (names.length > 0 && !names.includes(catalog)) {
          if (!manualCatalog) setCatalog(names[0]);
        }
      }
    } catch {
    } finally {
      setLoadingMetadata(false);
    }
  }, [catalog, manualCatalog]);

  const loadSchemas = React.useCallback(async (targetCatalog: string) => {
    if (!targetCatalog) return;
    try {
      const res = await fetch(`/api/databricks/schemas?catalog=${encodeURIComponent(targetCatalog)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.schemas)) {
        const names = data.schemas.map((s: { name: string }) => s.name);
        setSchemasList(names);
        if (names.length > 0 && !names.includes(schema)) {
          if (!manualSchema) setSchema(names[0]);
        }
      }
    } catch {}
  }, [schema, manualSchema]);

  const loadVolumes = React.useCallback(async (targetCatalog: string, targetSchema: string) => {
    if (!targetCatalog || !targetSchema) return;
    try {
      const res = await fetch(
        `/api/databricks/volumes?catalog=${encodeURIComponent(targetCatalog)}&schema=${encodeURIComponent(targetSchema)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.volumes)) {
        const names = data.volumes.map((v: { name: string }) => v.name);
        setVolumesList(names);
        if (names.length > 0 && !names.includes(volume)) {
          if (!manualVolume) setVolume(names[0]);
        }
      }
    } catch {}
  }, [volume, manualVolume]);

  React.useEffect(() => {
    if (catalog) {
      loadSchemas(catalog);
    }
  }, [catalog, loadSchemas]);

  React.useEffect(() => {
    if (catalog && schema) {
      loadVolumes(catalog, schema);
    }
  }, [catalog, schema, loadVolumes]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        host,
        warehouseId,
        defaultCatalog: catalog,
        defaultSchema: schema,
        defaultVolume: volume,
        maxUploadSizeMb: Number(maxUploadSizeMb) || 500,
      };

      if (isChangingToken && newToken.trim()) {
        payload.token = newToken.trim();
      }

      const res = await fetch("/api/databricks/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.settings) {
        toast.success("Pengaturan koneksi Databricks berhasil disimpan!");
        setTokenMasked(data.settings.tokenMasked);
        setHasToken(data.settings.hasToken);
        setIsChangingToken(false);
        setNewToken("");
        window.dispatchEvent(new Event("databricks-status-changed"));
        loadCatalogs();
      } else {
        toast.error(data.error || "Gagal menyimpan pengaturan.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/databricks/test-connection", {
        method: "POST",
      });
      const data: ConnectionTestResult = await res.json();
      setTestResult(data);

      window.dispatchEvent(new Event("databricks-status-changed"));

      if (data.success) {
        toast.success("Uji koneksi berhasil diverifikasi!");
        loadCatalogs();
      } else {
        toast.error("Uji koneksi gagal: " + data.message);
      }
    } catch {
      toast.error("Gagal menjalankan uji koneksi ke server.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Pengaturan Databricks
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kelola kredensial koneksi Databricks Unity Catalog dan target penyimpanan langsung dari antarmuka web.
          </p>
        </div>
        <Link
          href="/guide#langkah-3"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 self-start sm:self-center"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Butuh bantuan?</span>
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Kredensial Workspace & Warehouse</CardTitle>
                  <CardDescription>
                    Kredensial disimpan secara aman di server (token dienkripsi dengan AES-256-GCM).
                  </CardDescription>
                </div>
              </div>
              {hasToken && host && warehouseId ? (
                <Badge variant="success" className="gap-1 py-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Tersimpan</span>
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1 py-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Belum Lengkap</span>
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                Workspace URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="https://dbc-xxxx.cloud.databricks.com"
                required
                className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Contoh: <code className="text-zinc-700">https://dbc-xxxx.cloud.databricks.com</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                SQL Warehouse ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                placeholder="5e6af75272a52041"
                required
                className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                ID SQL Warehouse pada tab Connection Details di konsol Databricks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                Personal Access Token (PAT) <span className="text-rose-500">*</span>
              </label>

              {!isChangingToken && hasToken ? (
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="flex-1 flex items-center justify-between h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5">
                    <span className="font-mono text-xs tracking-wider text-zinc-600">
                      {tokenMasked || "••••••••••••••••"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      Tersimpan & Terenkripsi
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingToken(true);
                      setNewToken("");
                    }}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Ganti Token</span>
                  </Button>
                </div>
              ) : (
                <div className="mt-1.5 space-y-2">
                  <div className="relative">
                    <input
                      type={showNewToken ? "text" : "password"}
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      placeholder="dapixxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      required={!hasToken}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-3.5 pr-20 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowNewToken(!showNewToken)}
                        className="text-zinc-400 hover:text-zinc-600 p-1"
                        title={showNewToken ? "Sembunyikan" : "Tampilkan"}
                      >
                        {showNewToken ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {hasToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingToken(false);
                            setNewToken("");
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5 py-0.5 rounded hover:bg-zinc-100"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Token hanya disimpan secara write-only dan dienkripsi AES-256-GCM.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FolderTree className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Target Unity Catalog & Volume Unggahan</CardTitle>
                  <CardDescription>
                    Tentukan katalog, skema, dan volume default untuk streaming berkas CSV dan tabel hasil bersih.
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadCatalogs}
                disabled={loadingMetadata || !host || !warehouseId}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingMetadata ? "animate-spin" : ""}`} />
                <span>Muat dari Databricks</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Katalog</label>
                  <button
                    type="button"
                    onClick={() => setManualCatalog(!manualCatalog)}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    {manualCatalog ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualCatalog || catalogsList.length === 0 ? (
                  <input
                    type="text"
                    value={catalog}
                    onChange={(e) => setCatalog(e.target.value)}
                    required
                    placeholder="main"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                ) : (
                  <select
                    value={catalog}
                    onChange={(e) => setCatalog(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    {catalogsList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Skema</label>
                  <button
                    type="button"
                    onClick={() => setManualSchema(!manualSchema)}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    {manualSchema ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualSchema || schemasList.length === 0 ? (
                  <input
                    type="text"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    required
                    placeholder="csv_tidy"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                ) : (
                  <select
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    {schemasList.map((sch) => (
                      <option key={sch} value={sch}>
                        {sch}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Volume</label>
                  <button
                    type="button"
                    onClick={() => setManualVolume(!manualVolume)}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    {manualVolume ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualVolume || volumesList.length === 0 ? (
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    required
                    placeholder="raw_uploads"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                ) : (
                  <select
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    {volumesList.map((vol) => (
                      <option key={vol} value={vol}>
                        {vol}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Path Penuh Unity Catalog Volume:</span>
              <code className="font-mono font-semibold text-indigo-600">
                /Volumes/{catalog || "main"}/{schema || "csv_tidy"}/{volume || "raw_uploads"}
              </code>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Pengaturan</span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !host || !warehouseId}
              className="gap-2"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Menguji Koneksi...</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  <span>Tes Koneksi</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {testResult && (
        <Card className={`border-2 ${testResult.success ? "border-emerald-200 bg-emerald-50/20" : "border-rose-200 bg-rose-50/20"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {testResult.success ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <XCircle className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-base text-zinc-900">
                    {testResult.success ? "Koneksi Berhasil Diverifikasi" : "Uji Koneksi Gagal"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {testResult.message}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={testResult.success ? "success" : "destructive"}>
                  {testResult.latencyMs} ms
                </Badge>
                {testResult.warehouseStatus && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Status: {testResult.warehouseStatus}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!testResult.success && testResult.suggestion && (
              <div className="rounded-xl border border-rose-200 bg-white p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-rose-900">Apa yang harus dilakukan:</h5>
                    <p className="text-xs text-rose-700 leading-relaxed">{testResult.suggestion}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
              <h5 className="text-xs font-semibold text-zinc-700 mb-2">Rincian Tahapan Verifikasi:</h5>
              {testResult.diagnostics.map((diag, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-zinc-100 last:border-b-0 text-xs">
                  {diag.status === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {diag.status === "warning" && (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  {diag.status === "error" && (
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="font-semibold text-zinc-900">{diag.step}</div>
                    <div className="text-zinc-600">{diag.detail}</div>
                    {diag.action && (
                      <div className="text-[11px] text-indigo-700 font-medium mt-1">
                        &rarr; {diag.action}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
