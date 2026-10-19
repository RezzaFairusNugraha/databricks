"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
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
        toast.success("Pengaturan koneksi berhasil disimpan.");
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
        toast.success("Koneksi ke Databricks berhasil terhubung.");
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
        <RefreshCw className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi kredensial Databricks Unity Catalog dan lokasi penyimpanan berkas."
      >
        <Link
          href="/guide#langkah-3"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Butuh bantuan?</span>
        </Link>
      </PageHeader>

      <form onSubmit={handleSave} className="space-y-8 md:space-y-10">
        <Section
          title="Koneksi Workspace & Warehouse"
          description="Kredensial disimpan lokal di server dan token dienkripsi dengan AES-256-GCM."
          card
        >
          <div className="space-y-5">
            <Field
              label="Workspace URL"
              htmlFor="host"
              helperText="Contoh: https://dbc-xxxx.cloud.databricks.com"
              required
            >
              <Input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="https://dbc-xxxx.cloud.databricks.com"
                required
                className="font-mono text-[13px]"
              />
            </Field>

            <Field
              label="SQL Warehouse ID"
              htmlFor="warehouseId"
              helperText="ID SQL Warehouse pada tab Connection Details di Databricks."
              required
            >
              <Input
                id="warehouseId"
                type="text"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                placeholder="5e6af75272a52041"
                required
                className="font-mono text-[13px]"
              />
            </Field>

            <Field
              label="Personal Access Token"
              htmlFor="token"
              helperText="Token disimpan write-only dan tidak pernah dikembalikan ke peramban."
              required
            >
              {!isChangingToken && hasToken ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center justify-between h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3">
                    <span className="font-mono text-[13px] tracking-wider text-zinc-600">
                      {tokenMasked || "••••••••••••••••"}
                    </span>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                      Tersimpan
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsChangingToken(true);
                      setNewToken("");
                    }}
                    className="shrink-0"
                  >
                    Ganti Token
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      id="token"
                      type={showNewToken ? "text" : "password"}
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      placeholder="dapixxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      required={!hasToken}
                      className="font-mono text-[13px] pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowNewToken(!showNewToken)}
                        className="text-zinc-400 hover:text-zinc-600 p-1"
                        title={showNewToken ? "Sembunyikan" : "Tampilkan"}
                      >
                        {showNewToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      {hasToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingToken(false);
                            setNewToken("");
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded hover:bg-zinc-100"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Field>
          </div>
        </Section>

        <Section
          title="Target Unity Catalog"
          description="Katalog, skema, dan volume default untuk unggahan berkas dan tabel."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={loadCatalogs}
              disabled={loadingMetadata || !host || !warehouseId}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingMetadata ? "animate-spin" : ""}`} />
              <span>Muat dari Databricks</span>
            </Button>
          }
          card
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-zinc-900">Katalog</label>
                  <button
                    type="button"
                    onClick={() => setManualCatalog(!manualCatalog)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {manualCatalog ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualCatalog || catalogsList.length === 0 ? (
                  <Input
                    type="text"
                    value={catalog}
                    onChange={(e) => setCatalog(e.target.value)}
                    required
                    placeholder="main"
                    className="font-mono text-[13px]"
                  />
                ) : (
                  <select
                    value={catalog}
                    onChange={(e) => setCatalog(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors shadow-xs"
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
                  <label className="text-sm font-medium text-zinc-900">Skema</label>
                  <button
                    type="button"
                    onClick={() => setManualSchema(!manualSchema)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {manualSchema ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualSchema || schemasList.length === 0 ? (
                  <Input
                    type="text"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    required
                    placeholder="csv_tidy"
                    className="font-mono text-[13px]"
                  />
                ) : (
                  <select
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors shadow-xs"
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
                  <label className="text-sm font-medium text-zinc-900">Volume</label>
                  <button
                    type="button"
                    onClick={() => setManualVolume(!manualVolume)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {manualVolume ? "Pilih Dropdown" : "Ketik Manual"}
                  </button>
                </div>

                {manualVolume || volumesList.length === 0 ? (
                  <Input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    required
                    placeholder="raw_uploads"
                    className="font-mono text-[13px]"
                  />
                ) : (
                  <select
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors shadow-xs"
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

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs">
              <span className="text-zinc-600">Lokasi Volume Unity Catalog:</span>
              <code className="font-mono font-medium text-indigo-600">
                /Volumes/{catalog || "main"}/{schema || "csv_tidy"}/{volume || "raw_uploads"}
              </code>
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>
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
            variant="secondary"
            onClick={handleTestConnection}
            disabled={testing || !host || !warehouseId}
            className="gap-2"
          >
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <Activity className="h-4 w-4" />
                <span>Tes Koneksi</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {testResult && (
        <div className={`rounded-xl border p-6 space-y-4 ${testResult.success ? "border-emerald-200 bg-white" : "border-rose-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-zinc-900">
                  {testResult.success ? "Koneksi Berhasil" : "Uji Koneksi Gagal"}
                </h3>
                <p className="text-sm text-zinc-600">
                  {testResult.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={testResult.success ? "success" : "destructive"}>
                {testResult.latencyMs} ms
              </Badge>
              {testResult.warehouseStatus && (
                <Badge variant="outline" className="font-mono text-xs">
                  {testResult.warehouseStatus}
                </Badge>
              )}
            </div>
          </div>

          {!testResult.success && testResult.suggestion && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-rose-900">Langkah penyelesaian:</h4>
                  <p className="text-xs text-rose-700 leading-relaxed">{testResult.suggestion}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <h4 className="text-xs font-semibold text-zinc-700">Rincian Verifikasi</h4>
            <div className="divide-y divide-zinc-100">
              {testResult.diagnostics.map((diag, i) => (
                <div key={i} className="flex items-start gap-3 py-2 text-xs">
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
                    <span className="font-medium text-zinc-900">{diag.step}</span>
                    <p className="text-zinc-600">{diag.detail}</p>
                    {diag.action && (
                      <p className="text-[13px] text-indigo-600 font-medium pt-0.5">
                        &rarr; {diag.action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
