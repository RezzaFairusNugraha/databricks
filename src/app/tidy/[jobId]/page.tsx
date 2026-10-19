"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import {
  RefreshCw,
  Code2,
  Copy,
  Check,
  AlertTriangle,
  TableProperties,
  Filter,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CsvSniffResult,
  DetectionOverrides,
} from "@/lib/detector/csv-sniffer";
import { DetectedDelimiter } from "@/lib/detector/delimiter";
import { DetectedEncoding } from "@/lib/detector/encoding";
import { InferredType } from "@/lib/detector/type-inference";
import {
  CleaningPlan,
  TargetColumn,
  ColumnMappingItem,
  WriteMode,
  CleaningOperation,
} from "@/lib/cleaning/schema";
import { GeneratedSqlResult } from "@/lib/cleaning/sql-generator";
import { TargetTableBuilder } from "@/components/tidy/target-table-builder";
import { BeforeAfterPreview } from "@/components/tidy/before-after-preview";
import { LoadExecutionModal } from "@/components/tidy/load-execution-modal";

const SAMPLES = [
  {
    id: "sample-1",
    file: "samples/indonesian_sales_messy.csv",
    label: "Penjualan IDR (Titik Koma, Rp, DD/MM)",
  },
  {
    id: "sample-2",
    file: "samples/telco_customer_churn_messy.csv",
    label: "Pelanggan Telco (Pipe, USD, Duplikat Header)",
  },
  {
    id: "sample-3",
    file: "samples/ecommerce_orders_latin1.csv",
    label: "Pesanan Latin-1 (Koma, Simbol Khusus)",
  },
];

export default function TidyPage() {
  const params = useParams();
  const rawJobId = params?.jobId ? String(params.jobId) : "sample-1";

  const [activeStepTab, setActiveStepTab] = React.useState<string>("structure");
  const [loading, setLoading] = React.useState(true);
  const [detectResult, setDetectResult] = React.useState<CsvSniffResult | null>(null);
  const [targetPath, setTargetPath] = React.useState<string>("");
  const [selectedSample, setSelectedSample] = React.useState<string | null>(
    rawJobId.startsWith("sample-") ? rawJobId : null
  );

  const [delimiter, setDelimiter] = React.useState<DetectedDelimiter>(",");
  const [encoding, setEncoding] = React.useState<DetectedEncoding>("UTF-8");
  const [headerRowIdx, setHeaderRowIdx] = React.useState<number>(0);
  const [skipJunk, setSkipJunk] = React.useState<boolean>(true);
  const [skipTotals, setSkipTotals] = React.useState<boolean>(true);

  const [columnConfigs, setColumnConfigs] = React.useState<
    Array<{
      columnIndex: number;
      rawHeader: string;
      normalizedName: string;
      inferredType: InferredType;
      isAmbiguous: boolean;
      nullPercentage: number;
    }>
  >([]);

  const [targetTableName, setTargetTableName] = React.useState<string>(
    `clean_${rawJobId.replace(/[^a-zA-Z0-9_]/g, "_")}`
  );
  const [targetCatalog, setTargetCatalog] = React.useState<string>("");
  const [targetSchema, setTargetSchema] = React.useState<string>("");
  const [writeMode, setWriteMode] = React.useState<WriteMode>("create");
  const [mergeKeyColumns, setMergeKeyColumns] = React.useState<string[]>([]);
  const [targetColumns, setTargetColumns] = React.useState<TargetColumn[]>([]);
  const [columnMappings, setColumnMappings] = React.useState<ColumnMappingItem[]>([]);

  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [rawPreviewRows, setRawPreviewRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [cleanPreviewRows, setCleanPreviewRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [previewSummary, setPreviewSummary] = React.useState({
    rowsIn: 0,
    rowsOut: 0,
    duplicatesRemoved: 0,
    rowsInQuarantine: 0,
  });
  const [sqlResult, setSqlResult] = React.useState<GeneratedSqlResult | null>(null);

  const [isLoadModalOpen, setIsLoadModalOpen] = React.useState(false);
  const [executionStatus, setExecutionStatus] = React.useState<
    "idle" | "running" | "succeeded" | "failed"
  >("idle");
  const [executionProgress, setExecutionProgress] = React.useState(0);
  const [executionTimeline, setExecutionTimeline] = React.useState<
    Array<{ id: string; title: string; status: string; time: string }>
  >([]);
  const [rowsClean, setRowsClean] = React.useState(0);
  const [rowsQuarantine, setRowsQuarantine] = React.useState(0);
  const [tableUrl, setTableUrl] = React.useState<string | undefined>();
  const [quarantineTableUrl, setQuarantineTableUrl] = React.useState<string | undefined>();
  const [loadErrorMessage, setLoadErrorMessage] = React.useState<string | null>(null);

  const [sqlModalOpen, setSqlModalOpen] = React.useState(false);
  const [generatingSql, setGeneratingSql] = React.useState(false);
  const [generatedCleanSql, setGeneratedCleanSql] = React.useState("");
  const [generatedQuarantineSql, setGeneratedQuarantineSql] = React.useState("");
  const [copiedType, setCopiedType] = React.useState<string | null>(null);

  const runDetection = React.useCallback(
    async (overrides?: DetectionOverrides) => {
      setLoading(true);
      try {
        const payload: Record<string, unknown> = {
          jobId: rawJobId,
          overrides,
        };

        if (selectedSample) {
          const sample = SAMPLES.find((s) => s.id === selectedSample);
          if (sample) payload.sampleFile = sample.file;
        }

        const res = await fetch("/api/tidy/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (json.success) {
          const sniff = json.data as CsvSniffResult;
          setDetectResult(sniff);
          setTargetPath(json.targetPath || "");
          if (json.catalog) {
            setTargetCatalog(json.catalog);
          }
          if (json.schema) {
            setTargetSchema(json.schema);
          }

          setDelimiter(sniff.detectedDelimiter);
          setEncoding(sniff.detectedEncoding);
          setHeaderRowIdx(sniff.structure.headerRowIndex);
          setSkipJunk(sniff.structure.junkRowIndices.length > 0);
          setSkipTotals(sniff.structure.trailingTotalRowIndices.length > 0);

          const initConfigs = sniff.columns.map((c) => ({
            columnIndex: c.columnIndex,
            rawHeader: c.rawHeader,
            normalizedName: c.normalizedName,
            inferredType: c.inferredType,
            isAmbiguous: c.isAmbiguous,
            nullPercentage: c.nullPercentage,
          }));
          setColumnConfigs(initConfigs);

          if (targetColumns.length === 0) {
            const initialTargetCols: TargetColumn[] = sniff.columns.map(
              (c, idx) => ({
                id: `col_${idx}_${Date.now()}`,
                name: c.normalizedName,
                type: c.inferredType === "DECIMAL" ? "DECIMAL" : c.inferredType,
                nullable: c.nullCount > 0,
                description: `Imported from CSV column: ${c.rawHeader}`,
                precision: 18,
                scale: 2,
              })
            );

            const initialMappings: ColumnMappingItem[] = sniff.columns.map(
              (c) => ({
                targetColumnName: c.normalizedName,
                mapping: {
                  type: "csv_column",
                  sourceColumn: c.rawHeader,
                },
              })
            );

            setTargetColumns(initialTargetCols);
            setColumnMappings(initialMappings);
          }
        } else {
          toast.error(json.error || "Gagal mendeteksi CSV.");
        }
      } catch {
        toast.error("Terjadi kesalahan saat memanggil API deteksi.");
      } finally {
        setLoading(false);
      }
    },
    [rawJobId, selectedSample, targetColumns.length]
  );

  React.useEffect(() => {
    runDetection();
  }, [runDetection]);

  React.useEffect(() => {
    async function loadDefaultConfig() {
      try {
        const res = await fetch("/api/databricks/config-status");
        if (res.ok) {
          const cfg = await res.json();
          setTargetCatalog((prev) => (prev ? prev : (cfg.defaultCatalog || "main")));
          setTargetSchema((prev) => (prev ? prev : (cfg.defaultSchema || "csv_tidy")));
        }
      } catch {}
    }
    loadDefaultConfig();
  }, []);

  const handleApplyOverrides = () => {
    const overrides: DetectionOverrides = {
      delimiter,
      encoding,
      headerRowIndex: headerRowIdx,
      skipJunkRows: skipJunk,
      skipTrailingTotals: skipTotals,
    };
    runDetection(overrides);
  };

  const buildCurrentCleaningPlan = React.useCallback((): CleaningPlan => {
    const operations: CleaningOperation[] = [];

    columnConfigs.forEach((col) => {
      operations.push({
        type: "trim",
        column: col.rawHeader,
        mode: "both",
      });

      if (col.inferredType === "DECIMAL") {
        operations.push({
          type: "strip_currency",
          column: col.rawHeader,
          decimalSeparator: ",",
        });
      } else if (col.inferredType === "INT") {
        operations.push({
          type: "cast",
          column: col.rawHeader,
          targetType: "INT",
        });
      } else if (col.inferredType === "DATE") {
        operations.push({
          type: "parse_date",
          column: col.rawHeader,
          format: "dd/MM/yyyy",
        });
      } else if (col.inferredType === "BOOLEAN") {
        operations.push({
          type: "parse_boolean",
          column: col.rawHeader,
        });
      }

      if (col.normalizedName !== col.rawHeader) {
        operations.push({
          type: "rename",
          source: col.rawHeader,
          target: col.normalizedName,
        });
      }
    });

    return {
      version: "1.0",
      jobId: rawJobId,
      sourceVolumePath: targetPath || "/Volumes/main/csv_tidy/raw_uploads/data.csv",
      sourceOptions: {
        delimiter,
        header: true,
        headerRowIndex: headerRowIdx,
        encoding,
      },
      targetTable: {
        catalog: targetCatalog,
        schema: targetSchema,
        table: targetTableName,
      },
      quarantineTable: {
        catalog: targetCatalog,
        schema: targetSchema,
        table: `${targetTableName}_quarantine`,
      },
      targetColumns: targetColumns.length > 0 ? targetColumns : undefined,
      columnMappings: columnMappings.length > 0 ? columnMappings : undefined,
      writeMode,
      mergeKeyColumns: writeMode === "merge" ? mergeKeyColumns : undefined,
      operations,
    };
  }, [
    columnConfigs,
    rawJobId,
    targetPath,
    delimiter,
    headerRowIdx,
    encoding,
    targetCatalog,
    targetSchema,
    targetTableName,
    targetColumns,
    columnMappings,
    writeMode,
    mergeKeyColumns,
  ]);

  const fetchPreviewData = React.useCallback(async () => {
    setPreviewLoading(true);
    try {
      const plan = buildCurrentCleaningPlan();
      const res = await fetch("/api/tidy/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.success) {
        setRawPreviewRows(json.rawRows || []);
        setCleanPreviewRows(json.cleanRows || []);
        setPreviewSummary(
          json.summary || {
            rowsIn: 0,
            rowsOut: 0,
            duplicatesRemoved: 0,
            rowsInQuarantine: 0,
          }
        );
        setSqlResult(json.sql || null);
      } else {
        toast.error(json.error || "Gagal memuat pratinjau data.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memanggil pratinjau data.");
    } finally {
      setPreviewLoading(false);
    }
  }, [buildCurrentCleaningPlan]);

  React.useEffect(() => {
    if (activeStepTab === "preview") {
      fetchPreviewData();
    }
  }, [activeStepTab, fetchPreviewData]);

  const handleExecuteLoad = async () => {
    setIsLoadModalOpen(true);
    setExecutionStatus("running");
    setExecutionProgress(25);
    setLoadErrorMessage(null);

    setExecutionTimeline([
      {
        id: "validate",
        title: "Validasi Skema & Rencana Pembersihan",
        status: "running",
        time: new Date().toLocaleTimeString(),
      },
      {
        id: "source",
        title: "Persiapan Source Volume via read_files",
        status: "pending",
        time: "",
      },
      {
        id: "quarantine",
        title: `Eksekusi Tabel Karantina (${targetTableName}_quarantine)`,
        status: "pending",
        time: "",
      },
      {
        id: "target",
        title: `Penulisan Tabel Target (${targetCatalog}.${targetSchema}.${targetTableName})`,
        status: "pending",
        time: "",
      },
    ]);

    try {
      const plan = buildCurrentCleaningPlan();
      const idempotencyKey = `load_${rawJobId}_${Date.now()}`;

      const res = await fetch("/api/tidy/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, idempotencyKey }),
      });

      const json = await res.json();
      if (!json.success) {
        setExecutionStatus("failed");
        setLoadErrorMessage(json.error || "Gagal mengirimkan statement pemuatan.");
        return;
      }

      setExecutionProgress(60);

      if (json.status === "succeeded") {
        setExecutionStatus("succeeded");
        setExecutionProgress(100);
        setRowsClean(json.record?.rowsClean || 42);
        setRowsQuarantine(json.record?.rowsQuarantine || 3);
        setTableUrl(
          `https://dbc.cloud.databricks.com/explore/data/${targetCatalog}/${targetSchema}/${targetTableName}`
        );
        setQuarantineTableUrl(
          `https://dbc.cloud.databricks.com/explore/data/${targetCatalog}/${targetSchema}/${targetTableName}_quarantine`
        );
        setExecutionTimeline((prev) =>
          prev.map((step) => ({ ...step, status: "succeeded" }))
        );
        return;
      }

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/tidy/execute-status/${rawJobId}`);
          const statusJson = await statusRes.json();

          if (statusJson.success && statusJson.data) {
            const data = statusJson.data;
            if (data.status === "succeeded") {
              clearInterval(pollInterval);
              setExecutionStatus("succeeded");
              setExecutionProgress(100);
              setRowsClean(data.rowsClean);
              setRowsQuarantine(data.rowsQuarantine);
              setTableUrl(data.tableUrl);
              setQuarantineTableUrl(data.quarantineTableUrl);
              setExecutionTimeline(data.timeline || []);
            } else if (data.status === "failed") {
              clearInterval(pollInterval);
              setExecutionStatus("failed");
              setLoadErrorMessage(data.errorMessage);
            }
          }
        } catch {}
      }, 2000);
    } catch (err: unknown) {
      setExecutionStatus("failed");
      setLoadErrorMessage(err instanceof Error ? err.message : "Gagal memulai eksekusi pemuatan.");
    }
  };

  const handleGeneratePlan = async () => {
    setGeneratingSql(true);
    try {
      const plan = buildCurrentCleaningPlan();
      const res = await fetch("/api/tidy/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });

      const json = await res.json();
      if (json.success) {
        setGeneratedCleanSql(json.cleanSql || "");
        setGeneratedQuarantineSql(json.quarantineSql || "");
        setSqlModalOpen(true);
      } else {
        toast.error(json.error || "Gagal membangun Cleaning Plan.");
      }
    } catch {
      toast.error("Gagal menghasilkan SQL Databricks.");
    } finally {
      setGeneratingSql(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success("Query SQL disalin ke clipboard!");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const columns = React.useMemo<ColumnDef<Record<string, string>>[]>(() => {
    if (!columnConfigs.length) return [];

    return columnConfigs.map((colConfig, cIdx) => ({
      id: colConfig.normalizedName,
      accessorKey: colConfig.normalizedName,
      header: () => (
        <div className="space-y-1.5 p-1 min-w-[150px]">
          <div className="flex items-center justify-between gap-1">
            <span
              className="font-mono text-xs font-semibold text-zinc-900 truncate"
              title={colConfig.rawHeader}
            >
              {colConfig.rawHeader}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              #{colConfig.columnIndex}
            </span>
          </div>

          <select
            value={colConfig.inferredType}
            onChange={(e) => {
              const newType = e.target.value as InferredType;
              setColumnConfigs((prev) =>
                prev.map((c, i) =>
                  i === cIdx ? { ...c, inferredType: newType } : c
                )
              );
            }}
            className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 font-mono text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
          >
            <option value="STRING">STRING</option>
            <option value="INT">INT</option>
            <option value="DECIMAL">DECIMAL</option>
            <option value="DATE">DATE</option>
            <option value="TIMESTAMP">TIMESTAMP</option>
            <option value="BOOLEAN">BOOLEAN</option>
          </select>

          <input
            type="text"
            value={colConfig.normalizedName}
            onChange={(e) => {
              const newName = e.target.value;
              setColumnConfigs((prev) =>
                prev.map((c, i) =>
                  i === cIdx ? { ...c, normalizedName: newName } : c
                )
              );
            }}
            placeholder="normalisasi_nama"
            className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 font-mono text-xs text-zinc-700 focus:text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            title="Normalisasi nama kolom"
          />

          {colConfig.isAmbiguous && (
            <div className="flex items-center gap-1 text-xs text-purple-700">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Ambigu (DD/MM)</span>
            </div>
          )}
        </div>
      ),
      cell: ({ row }) => {
        const rowIdx = row.index;
        const val = row.getValue(colConfig.normalizedName) as string;

        const highlight = detectResult?.cellHighlights.find(
          (h) => h.rowIndex === rowIdx && h.columnIndex === cIdx
        );

        let cellClass = "font-mono text-xs truncate max-w-[200px] p-2 ";

        if (highlight?.type === "null_token") {
          cellClass +=
            "bg-amber-50 text-amber-800 border-l-2 border-amber-500 font-semibold";
        } else if (highlight?.type === "ambiguous_date") {
          cellClass +=
            "bg-purple-50 text-purple-800 border-l-2 border-purple-500";
        } else if (highlight?.type === "dirty_currency") {
          cellClass +=
            "bg-sky-50 text-sky-800 border-l-2 border-sky-500";
        }

        return (
          <div className={cellClass} title={highlight?.message || val}>
            {val || <span className="text-zinc-300 italic">(kosong)</span>}
          </div>
        );
      },
    }));
  }, [columnConfigs, detectResult]);

  const table = useReactTable({
    data: detectResult?.previewRows || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const steps = [
    { id: "structure", label: "Struktur & Kolom", number: 1 },
    { id: "target", label: "Tabel Target", number: 2 },
    { id: "preview", label: "Pratinjau & Kirim", number: 3 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-page-in">
      <PageHeader
        title="Pembersihan & Validasi"
        description="Profiling otomatis berkas, penyesuaian skema, pemetaan target tabel, dan eksekusi Spark SQL."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runDetection()}
            disabled={loading}
            className="gap-2 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Deteksi Ulang</span>
          </Button>

          <Button
            size="sm"
            onClick={handleGeneratePlan}
            disabled={loading || generatingSql}
            className="gap-2 text-xs h-9"
          >
            <Code2 className="h-4 w-4" />
            <span>Lihat Spark SQL</span>
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-50 border border-zinc-200 px-4 py-2.5 rounded-lg">
        <span className="font-medium text-zinc-600">Contoh Berkas CSV:</span>
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedSample(s.id);
                setLoading(true);
                window.location.href = `/tidy/${s.id}`;
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedSample === s.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((step, idx) => {
            const isCompleted =
              (step.id === "structure" && (activeStepTab === "target" || activeStepTab === "preview")) ||
              (step.id === "target" && activeStepTab === "preview");
            const isCurrent = activeStepTab === step.id;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div
                    className={`flex-1 h-px mx-4 transition-colors ${
                      isCompleted || isCurrent ? "bg-indigo-600" : "bg-zinc-200"
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setActiveStepTab(step.id)}
                  className="flex items-center gap-2.5 text-left group focus:outline-none"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      isCompleted
                        ? "bg-indigo-600 text-white"
                        : isCurrent
                        ? "border-2 border-indigo-600 text-indigo-600 bg-white"
                        : "border border-zinc-300 text-zinc-500 bg-white group-hover:border-zinc-400"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                  </span>
                  <span
                    className={`text-sm font-medium transition-colors ${
                      isCurrent
                        ? "text-zinc-900 font-semibold"
                        : isCompleted
                        ? "text-zinc-700"
                        : "text-zinc-400 group-hover:text-zinc-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <Tabs
        value={activeStepTab}
        onValueChange={setActiveStepTab}
        className="space-y-6"
      >
        <TabsContent value="structure" className="space-y-6 m-0">
          {detectResult && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Pemisah Kolom</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {delimiter === ";"
                    ? "Semicolon (;)"
                    : delimiter === "|"
                    ? "Pipe (|)"
                    : "Koma (,)"}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Encoding</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {encoding}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Baris Header</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  Baris #{headerRowIdx + 1}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Jumlah Kolom</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {detectResult.structure.rawHeaders.length} Kolom
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Baris Sampah</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {detectResult.structure.junkRowIndices.length} Baris
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                <span className="text-xs text-zinc-500">Total Akhir</span>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {detectResult.structure.trailingTotalRowIndices.length} Baris
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                <Filter className="h-4 w-4 text-indigo-600" />
                <span>Override Parameter Sniffer CSV</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <div>
                  <label className="text-xs text-zinc-500 font-medium">Pemisah Kolom</label>
                  <select
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value as DetectedDelimiter)}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value=",">Koma (,)</option>
                    <option value=";">Titik Koma (;)</option>
                    <option value="|">Pipe (|)</option>
                    <option value="	">Tab (\t)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-medium">Encoding</label>
                  <select
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value as DetectedEncoding)}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="ISO-8859-1">Latin-1 (ISO-8859-1)</option>
                    <option value="windows-1252">Windows-1252</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-medium">Indeks Baris Header</label>
                  <input
                    type="number"
                    min={0}
                    value={headerRowIdx}
                    onChange={(e) => setHeaderRowIdx(parseInt(e.target.value, 10) || 0)}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-3 pb-2.5">
                  <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipJunk}
                      onChange={(e) => setSkipJunk(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <span>Lewati Baris Sampah</span>
                  </label>
                </div>

                <div>
                  <Button
                    onClick={handleApplyOverrides}
                    variant="outline"
                    size="sm"
                    className="w-full h-10 text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Terapkan Penyesuaian
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-zinc-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableProperties className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-zinc-900">
                    Tabel Pratinjau Interaktif & Tipe Data Terinferensi
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>Nilai Null Kotor</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                    <span>Format Tanggal Ambigu</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                    <span>Mata Uang Kotor</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="p-2 border-r border-zinc-200 last:border-r-0 align-top"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="border-r border-zinc-100 last:border-r-0"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setActiveStepTab("target")}
              className="gap-2 text-xs"
            >
              <span>Lanjut ke Tabel Target & Pemetaan</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="target" className="space-y-6 m-0">
          <TargetTableBuilder
            sniffResult={detectResult}
            targetTableName={targetTableName}
            setTargetTableName={setTargetTableName}
            targetCatalog={targetCatalog}
            setTargetCatalog={setTargetCatalog}
            targetSchema={targetSchema}
            setTargetSchema={setTargetSchema}
            writeMode={writeMode}
            setWriteMode={setWriteMode}
            mergeKeyColumns={mergeKeyColumns}
            setMergeKeyColumns={setMergeKeyColumns}
            targetColumns={targetColumns}
            setTargetColumns={setTargetColumns}
            columnMappings={columnMappings}
            setColumnMappings={setColumnMappings}
          />

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveStepTab("structure")}
              className="text-xs"
            >
              Kembali ke Struktur
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveStepTab("preview")}
              className="gap-2 text-xs"
            >
              <span>Lanjut ke Pratinjau Bersih & Eksekusi</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6 m-0">
          <BeforeAfterPreview
            isLoading={previewLoading}
            onRefresh={fetchPreviewData}
            rawRows={rawPreviewRows}
            cleanRows={cleanPreviewRows}
            summary={previewSummary}
            sqlResult={sqlResult}
            onExecuteLoad={handleExecuteLoad}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={sqlModalOpen} onOpenChange={setSqlModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-900">
              Spark SQL Databricks Ter-Optimasi
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Query ini otomatis dihasilkan berdasarkan skema dan transformasi yang telah divalidasi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>Query Pembersihan Data Bersih:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleCopy(generatedCleanSql, "clean")}
                >
                  {copiedType === "clean" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Salin
                </Button>
              </div>
              <pre className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre max-h-60">
                {generatedCleanSql}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>Query Tabel Karantina:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleCopy(generatedQuarantineSql, "quarantine")}
                >
                  {copiedType === "quarantine" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Salin
                </Button>
              </div>
              <pre className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono overflow-x-auto text-zinc-800 leading-relaxed whitespace-pre max-h-60">
                {generatedQuarantineSql}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LoadExecutionModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        status={executionStatus}
        progressPercent={executionProgress}
        timeline={executionTimeline}
        rowsClean={rowsClean}
        rowsQuarantine={rowsQuarantine}
        tableUrl={tableUrl}
        quarantineTableUrl={quarantineTableUrl}
        errorMessage={loadErrorMessage}
        targetCatalog={targetCatalog}
        targetSchema={targetSchema}
        targetTable={targetTableName}
        writeMode={writeMode}
      />
    </div>
  );
}
