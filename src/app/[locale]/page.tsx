import * as React from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  UploadCloud,
  Settings,
  Database,
  Server,
  HardDrive,
  Activity,
  ArrowUpRight,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAllJobs } from "@/lib/jobs";
import { getConfigStatus } from "@/lib/databricks";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const jobs = getAllJobs();
  const config = getConfigStatus();

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Databricks Unity Catalog Engine Active</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span>{t("checkSettings")}</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9 gap-1.5 shadow-sm">
            <Link href="/import">
              <UploadCloud className="h-4 w-4" />
              <span>{t("startImport")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Warning Banner if unconfigured */}
      {!config.isConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 flex items-start justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Koneksi Databricks Belum Dikonfigurasi
            </h4>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              Environment variables seperti DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID, atau DATABRICKS_TOKEN belum lengkap.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs">
            <Link href="/settings">Buka Pengaturan</Link>
          </Button>
        </div>
      )}

      {/* 4 Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("stats.totalUploads")}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("stats.totalUploadsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("stats.activeWarehouse")}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Server className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {config.maskedWarehouseId || "Siap"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Serverless SQL Warehouse
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("stats.storageUsed")}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <HardDrive className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold truncate font-mono text-primary">
              /{config.defaultVolume}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate" title={config.volumePath}>
              {config.volumePath}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("stats.avgLatency")}
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              Fast
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Files API Direct Streaming
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Highlights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/import"
          className="group block rounded-xl border border-border/70 bg-gradient-to-br from-card/80 to-muted/30 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-5 w-5 transition-transform group-hover:scale-110" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground group-hover:text-primary transition-colors">
            {t("startImport")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("startImportDesc")}
          </p>
        </Link>

        <Link
          href="/settings"
          className="group block rounded-xl border border-border/70 bg-gradient-to-br from-card/80 to-muted/30 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Database className="h-5 w-5 transition-transform group-hover:scale-110" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-500" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground group-hover:text-emerald-500 transition-colors">
            {t("checkSettings")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("checkSettingsDesc")}
          </p>
        </Link>
      </div>

      {/* Recent Uploads Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("recentUploads")}</CardTitle>
            <CardDescription>{t("recentUploadsDesc")}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
            <Link href="/history">
              <span>{tNav("history")}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="py-12 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t("noUploads")}
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/import">{t("startImport")}</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
                    <th className="pb-3 font-medium">Job ID</th>
                    <th className="pb-3 font-medium">Nama Berkas</th>
                    <th className="pb-3 font-medium">Jalur Volume</th>
                    <th className="pb-3 font-medium">Ukuran</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {jobs.slice(0, 5).map((job) => (
                    <tr key={job.jobId} className="group hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {job.jobId.substring(0, 14)}...
                      </td>
                      <td className="py-3 font-medium text-foreground flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        {job.fileName}
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground max-w-xs truncate" title={job.volumeFilePath}>
                        {job.volumeFilePath}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {(job.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="py-3">
                        <Badge variant="success" className="text-[10px]">
                          {job.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
