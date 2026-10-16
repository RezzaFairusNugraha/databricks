"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "@/i18n/routing";
import {
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Palette,
  ShieldCheck,
  Languages,
  Check,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useThemeStore,
  ACCENT_PRESETS,
  FONT_PRESETS,
  AccentColor,
  BorderRadius,
  FontFamily,
} from "@/store/useThemeStore";
import { toast } from "sonner";

interface ConfigStatusData {
  isConfigured: boolean;
  maskedHost: string;
  maskedWarehouseId: string;
  authMode: string;
  defaultCatalog: string;
  defaultSchema: string;
  defaultVolume: string;
  volumePath: string;
  maxUploadSizeMb: number;
  warnings: string[];
}

interface TestResultData {
  success: boolean;
  latencyMs: number;
  warehouseStatus?: string;
  warehouseName?: string;
  catalogCount?: number;
  message: string;
  diagnostics: Array<{ step: string; status: "success" | "warning" | "error"; detail: string }>;
  error?: string;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Theme preferences from store
  const {
    accentColor,
    radius,
    fontFamily,
    setAccentColor,
    setRadius,
    setFontFamily,
  } = useThemeStore();

  const [config, setConfig] = React.useState<ConfigStatusData | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResultData | null>(null);

  // Fetch server configuration status (masked)
  const fetchConfig = React.useCallback(async () => {
    try {
      const res = await fetch("/api/databricks/config-status");
      const data = await res.json();
      setConfig(data);
    } catch {
      toast.error("Gagal memuat status konfigurasi Databricks.");
    }
  }, []);

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Run Test Connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/databricks/test-connection", {
        method: "POST",
      });
      const data: TestResultData = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success(t("databricksCard.testSuccess"));
      } else {
        toast.error(t("databricksCard.testFailed") + ": " + data.message);
      }
    } catch {
      toast.error("Gagal menjalankan uji koneksi ke server.");
    } finally {
      setTesting(false);
    }
  };

  const handleLanguageChange = (newLocale: "id" | "en") => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* 1. Databricks Unity Catalog Connection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {t("databricksCard.title")}
                </CardTitle>
                <CardDescription>
                  {t("databricksCard.description")}
                </CardDescription>
              </div>
            </div>
            {config?.isConfigured ? (
              <Badge variant="success" className="gap-1 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Terkonfigurasi</span>
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1 py-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Belum Lengkap</span>
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Config Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div>
              <span className="text-xs text-muted-foreground">
                {t("databricksCard.host")}
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                {config?.maskedHost || "—"}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                {t("databricksCard.warehouseId")}
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                {config?.maskedWarehouseId || "—"}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                {t("databricksCard.authMode")}
              </span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {config?.authMode === "pat"
                  ? t("databricksCard.authPat")
                  : config?.authMode === "oauth_m2m"
                  ? t("databricksCard.authM2M")
                  : "Belum Diatur"}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="text-xs text-muted-foreground">
                {t("databricksCard.defaultVolume")}
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-primary">
                {config?.volumePath || "—"}
              </p>
            </div>
          </div>

          {/* Test Connection Button & Latency */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={testing}
              className="gap-2 shadow-sm"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{t("databricksCard.testing")}</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  <span>{t("databricksCard.testButton")}</span>
                </>
              )}
            </Button>

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Badge variant="success" className="gap-1.5 py-1 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {t("databricksCard.latency")}: {testResult.latencyMs}ms
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1.5 py-1 text-xs">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Uji Gagal</span>
                  </Badge>
                )}

                {testResult.warehouseStatus && (
                  <Badge variant="outline" className="text-xs font-mono">
                    Status: {testResult.warehouseStatus}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Diagnostics Log Output */}
          {testResult && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                {t("databricksCard.diagnostics")}
              </h4>
              <div className="space-y-2">
                {testResult.diagnostics.map((diag, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-foreground/90"
                  >
                    {diag.status === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    {diag.status === "warning" && (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    {diag.status === "error" && (
                      <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold">{diag.step}: </span>
                      <span className="text-muted-foreground">{diag.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Theme & Appearance Customization Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t("themeCard.title")}
              </CardTitle>
              <CardDescription>
                {t("themeCard.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Accent Color Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("themeCard.accentColor")}
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
              {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((key) => {
                const preset = ACCENT_PRESETS[key];
                const isSelected = accentColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccentColor(key)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="truncate">{preset.label}</span>
                    {isSelected && (
                      <Check className="h-3 w-3 text-primary ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Border Radius Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("themeCard.radius")}
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { value: "0.25rem", label: t("themeCard.radiusSharp") },
                { value: "0.5rem", label: t("themeCard.radiusSubtle") },
                { value: "0.75rem", label: t("themeCard.radiusSoft") },
                { value: "1rem", label: t("themeCard.radiusRound") },
              ].map((item) => {
                const isSelected = radius === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRadius(item.value as BorderRadius)}
                    className={`flex items-center justify-between rounded-md border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Family Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("themeCard.font")}
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(Object.keys(FONT_PRESETS) as FontFamily[]).map((key) => {
                const preset = FONT_PRESETS[key];
                const isSelected = fontFamily === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFontFamily(key)}
                    className={`flex items-center justify-between rounded-md border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode Toggle (Light / Dark / System) */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("themeCard.themeMode")}
            </label>
            <div className="grid grid-cols-3 gap-2.5 max-w-md">
              {[
                { value: "light", label: t("themeCard.light") },
                { value: "dark", label: t("themeCard.dark") },
                { value: "system", label: t("themeCard.system") },
              ].map((item) => {
                const isSelected = theme === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value)}
                    className={`flex items-center justify-center gap-2 rounded-md border p-2 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Language Selection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {t("languageCard.title")}
              </CardTitle>
              <CardDescription>
                {t("languageCard.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <button
              type="button"
              onClick={() => handleLanguageChange("id")}
              className={`flex items-center justify-between rounded-lg border p-3.5 text-xs font-medium transition-all cursor-pointer ${
                locale === "id"
                  ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                  : "border-border/70 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🇮🇩</span>
                <span>{t("languageCard.indonesian")}</span>
              </div>
              {locale === "id" && <Check className="h-4 w-4 text-primary" />}
            </button>

            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`flex items-center justify-between rounded-lg border p-3.5 text-xs font-medium transition-all cursor-pointer ${
                locale === "en"
                  ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                  : "border-border/70 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">🇺🇸</span>
                <span>{t("languageCard.english")}</span>
              </div>
              {locale === "en" && <Check className="h-4 w-4 text-primary" />}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
