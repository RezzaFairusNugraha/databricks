"use client";

import * as React from "react";
import {
  ArrowDownRight,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  Code2,
  Play,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { GeneratedSqlResult } from "@/lib/cleaning/sql-generator";

interface BeforeAfterPreviewProps {
  isLoading: boolean;
  onRefresh: () => void;
  rawRows: Array<Record<string, unknown>>;
  cleanRows: Array<Record<string, unknown>>;
  summary: {
    rowsIn: number;
    rowsOut: number;
    duplicatesRemoved: number;
    rowsInQuarantine: number;
  };
  sqlResult: GeneratedSqlResult | null;
  onExecuteLoad: () => void;
}

export function BeforeAfterPreview({
  isLoading,
  onRefresh,
  rawRows,
  cleanRows,
  summary,
  sqlResult,
  onExecuteLoad,
}: BeforeAfterPreviewProps) {
  const [activeTab, setActiveTab] = React.useState<"clean" | "raw">("clean");
  const [isSqlModalOpen, setIsSqlModalOpen] = React.useState(false);
  const [copiedType, setCopiedType] = React.useState<string | null>(null);

  const rawHeaders = React.useMemo(() => {
    if (rawRows.length === 0) return [];
    return Object.keys(rawRows[0]);
  }, [rawRows]);

  const cleanHeaders = React.useMemo(() => {
    if (cleanRows.length === 0) return [];
    return Object.keys(cleanRows[0]);
  }, [cleanRows]);

  const handleCopySql = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success("Query SQL disalin ke clipboard!");
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Baris Masuk (CSV)
            </span>
            <FileSpreadsheet className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900">
              {summary.rowsIn.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Baris data mentah dari CSV
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/20">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">
              Baris Lolos Validasi
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-700">
              {summary.rowsOut.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Baris lolos transformasi & validasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Duplikat Disaring
            </span>
            <ArrowDownRight className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900">
              {summary.duplicatesRemoved.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Baris ganda disaring otomatis
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/20">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-rose-700">
              Baris Karantina
            </span>
            <AlertOctagon className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-rose-700">
              {summary.rowsInQuarantine.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Diisolasi ke tabel _quarantine
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "clean" | "raw")}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="clean" className="text-xs">
                Data Bersih (Clean)
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs">
                Data Mentah (Raw)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Segarkan Pratinjau
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSqlModalOpen(true)}
            className="h-8 text-xs gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Code2 className="h-3.5 w-3.5" />
            Lihat Spark SQL
          </Button>

          <Button
            size="sm"
            onClick={onExecuteLoad}
            className="h-8 text-xs gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Muat ke Databricks
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          {activeTab === "clean" ? (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3 text-left font-mono font-medium text-zinc-500 w-12">
                    #
                  </th>
                  {cleanHeaders.map((header) => (
                    <th
                      key={header}
                      className="py-2.5 px-3 text-left font-mono font-semibold text-zinc-900 border-l border-zinc-200 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{header}</span>
                        <Sparkles className="h-3 w-3 text-indigo-600" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {cleanRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono text-[11px] text-zinc-400">
                      {rIdx + 1}
                    </td>
                    {cleanHeaders.map((header) => {
                      const val = row[header];
                      const isNull = val === null || val === undefined;
                      return (
                        <td
                          key={header}
                          className="py-2 px-3 font-mono text-xs border-l border-zinc-100 whitespace-nowrap text-zinc-900"
                        >
                          {isNull ? (
                            <span className="text-[10px] text-zinc-400 italic">
                              null
                            </span>
                          ) : typeof val === "number" ? (
                            <span className="text-emerald-700 font-semibold">
                              {val.toLocaleString()}
                            </span>
                          ) : typeof val === "boolean" ? (
                            <Badge
                              variant={val ? "success" : "destructive"}
                              className="text-[10px]"
                            >
                              {val ? "TRUE" : "FALSE"}
                            </Badge>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {cleanRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={cleanHeaders.length + 1}
                      className="py-8 text-center text-zinc-400 italic"
                    >
                      Tidak ada baris data bersih untuk ditampilkan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3 text-left font-mono font-medium text-zinc-500 w-12">
                    #
                  </th>
                  {rawHeaders.map((header) => (
                    <th
                      key={header}
                      className="py-2.5 px-3 text-left font-mono font-medium text-zinc-500 border-l border-zinc-200 whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {rawRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono text-[11px] text-zinc-400">
                      {rIdx + 1}
                    </td>
                    {rawHeaders.map((header) => (
                      <td
                        key={header}
                        className="py-2 px-3 font-mono text-xs border-l border-zinc-100 whitespace-nowrap text-zinc-600"
                      >
                        {row[header] !== null && row[header] !== undefined && String(row[header]) !== "" ? (
                          String(row[header])
                        ) : (
                          <span className="text-zinc-300 italic">
                            (kosong)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider">
              <Code2 className="h-4 w-4" />
              Generated Spark SQL
            </div>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              Kueri Databricks Spark SQL Ter-Optimasi
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Semua identifier dibungkus backtick secara ketat dari skema Zod untuk mencegah SQL injection.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="clean" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="clean" className="text-xs">
                Query Pembersihan
              </TabsTrigger>
              <TabsTrigger value="targetDdl" className="text-xs">
                Target Table DDL/DML
              </TabsTrigger>
              <TabsTrigger value="quarantine" className="text-xs">
                Query Karantina
              </TabsTrigger>
              <TabsTrigger value="quarantineDdl" className="text-xs">
                Quarantine DDL
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2">
              <TabsContent value="clean" className="m-0 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>SELECT data yang telah dibersihkan & dipetakan:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleCopySql(sqlResult?.cleanSql || "", "clean")}
                  >
                    {copiedType === "clean" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Salin
                  </Button>
                </div>
                <pre className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre">
                  {sqlResult?.cleanSql}
                </pre>
              </TabsContent>

              <TabsContent value="targetDdl" className="m-0 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Perintah Eksekusi / Pemuatan Tabel Target:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      handleCopySql(sqlResult?.createCleanTableSql || "", "targetDdl")
                    }
                  >
                    {copiedType === "targetDdl" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Salin
                  </Button>
                </div>
                <pre className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre">
                  {sqlResult?.createCleanTableSql || "-- Tentukan tabel target di Tab 2"}
                </pre>
              </TabsContent>

              <TabsContent value="quarantine" className="m-0 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>SELECT data kotor/gagal validasi dengan alasan:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      handleCopySql(sqlResult?.quarantineSql || "", "quarantine")
                    }
                  >
                    {copiedType === "quarantine" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Salin
                  </Button>
                </div>
                <pre className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre">
                  {sqlResult?.quarantineSql}
                </pre>
              </TabsContent>

              <TabsContent value="quarantineDdl" className="m-0 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Perintah Pembuatan Tabel Karantina:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      handleCopySql(
                        sqlResult?.createQuarantineTableSql || "",
                        "quarantineDdl"
                      )
                    }
                  >
                    {copiedType === "quarantineDdl" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Salin
                  </Button>
                </div>
                <pre className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre">
                  {sqlResult?.createQuarantineTableSql || "-- Tentukan tabel target di Tab 2"}
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
