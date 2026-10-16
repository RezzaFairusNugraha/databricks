"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import {
  FileSpreadsheet,
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { JobRecord } from "@/lib/jobs";

export default function HistoryPage() {
  const t = useTranslations("history");
  const tCommon = useTranslations("common");

  const [data, setData] = React.useState<JobRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const fetchJobs = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (json.jobs) {
        setData(json.jobs);
      }
    } catch {
      toast.error("Gagal memuat riwayat pekerjaan.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const copyText = React.useCallback(
    (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(tCommon("copied"));
      setTimeout(() => setCopiedId(null), 2000);
    },
    [tCommon]
  );

  const columns = React.useMemo<ColumnDef<JobRecord>[]>(
    () => [
      {
        accessorKey: "jobId",
        header: t("table.jobId"),
        cell: ({ row }) => {
          const jobId = row.getValue("jobId") as string;
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-semibold text-primary">
                {jobId.substring(0, 12)}...
              </span>
              <button
                type="button"
                onClick={() => copyText(jobId, jobId)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Salin Job ID"
              >
                {copiedId === jobId ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "fileName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 text-xs font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("table.fileName")}</span>
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium">
            <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate max-w-[200px]">{row.getValue("fileName")}</span>
          </div>
        ),
      },
      {
        accessorKey: "fileSize",
        header: t("table.fileSize"),
        cell: ({ row }) => {
          const bytes = row.getValue("fileSize") as number;
          if (!bytes) return "—";
          const mb = bytes / (1024 * 1024);
          return (
            <span className="text-xs text-muted-foreground font-mono">
              {mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`}
            </span>
          );
        },
      },
      {
        accessorKey: "volumeFilePath",
        header: t("table.volumePath"),
        cell: ({ row }) => {
          const path = row.getValue("volumeFilePath") as string;
          return (
            <div className="flex items-center gap-1.5 max-w-xs">
              <span className="truncate font-mono text-xs text-muted-foreground" title={path}>
                {path}
              </span>
              <button
                type="button"
                onClick={() => copyText(path, `path-${row.original.jobId}`)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
                title="Salin Volume Path"
              >
                {copiedId === `path-${row.original.jobId}` ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("table.status"),
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge
              variant={
                status === "ready"
                  ? "success"
                  : status === "uploaded"
                  ? "info"
                  : status === "processing"
                  ? "warning"
                  : "destructive"
              }
              className="text-[10px] uppercase font-semibold"
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: t("table.createdAt"),
        cell: ({ row }) => {
          const dateStr = row.getValue("createdAt") as string;
          const d = new Date(dateStr);
          return (
            <span className="text-xs text-muted-foreground">
              {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
      },
    ],
    [t, copiedId, copyText]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchJobs}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{tCommon("refresh")}</span>
        </Button>
      </div>

      {/* TanStack Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("filterPlaceholder")}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Total {data.length} berkas
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="p-3 font-semibold">
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
              <tbody className="divide-y divide-border/40">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                      {loading ? tCommon("loading") : t("noJobs")}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {table.getPageCount() > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
                {table.getPageCount()}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Sebelumnya</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="h-8 gap-1 text-xs"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
