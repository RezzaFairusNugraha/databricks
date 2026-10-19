"use client";

import * as React from "react";
import Link from "next/link";
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
  Sparkles,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { JobRecord } from "@/lib/jobs";

export default function HistoryPage() {
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

  const copyText = React.useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Tersalin ke clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const columns = React.useMemo<ColumnDef<JobRecord>[]>(
    () => [
      {
        accessorKey: "jobId",
        header: "ID Pekerjaan",
        cell: ({ row }) => {
          const jobId = row.getValue("jobId") as string;
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-semibold text-indigo-600">
                {jobId.substring(0, 12)}...
              </span>
              <button
                type="button"
                onClick={() => copyText(jobId, jobId)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                title="Salin Job ID"
              >
                {copiedId === jobId ? (
                  <Check className="h-3 w-3 text-emerald-600" />
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
            className="-ml-3 h-8 text-xs font-medium text-zinc-700"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Nama Berkas</span>
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-zinc-900">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="truncate max-w-[200px]">{row.getValue("fileName")}</span>
          </div>
        ),
      },
      {
        accessorKey: "fileSize",
        header: "Ukuran",
        cell: ({ row }) => {
          const bytes = row.getValue("fileSize") as number;
          if (!bytes) return "—";
          const mb = bytes / (1024 * 1024);
          return (
            <span className="text-xs text-zinc-500 font-mono">
              {mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`}
            </span>
          );
        },
      },
      {
        accessorKey: "volumeFilePath",
        header: "Path Volume",
        cell: ({ row }) => {
          const path = row.getValue("volumeFilePath") as string;
          return (
            <div className="flex items-center gap-1.5 max-w-xs">
              <span className="truncate font-mono text-xs text-zinc-500" title={path}>
                {path}
              </span>
              <button
                type="button"
                onClick={() => copyText(path, `path-${row.original.jobId}`)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 shrink-0"
                title="Salin Path"
              >
                {copiedId === `path-${row.original.jobId}` ? (
                  <Check className="h-3 w-3 text-emerald-600" />
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
        header: "Status",
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
        header: "Waktu Unggah",
        cell: ({ row }) => {
          const dateStr = row.getValue("createdAt") as string;
          const d = new Date(dateStr);
          return (
            <span className="text-xs text-zinc-500">
              {d.toLocaleDateString("id-ID")} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
          const jobId = row.original.jobId;
          return (
            <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              <Link href={`/tidy/${jobId}`}>
                <Sparkles className="h-3 w-3" />
                <span>Bersihkan</span>
              </Link>
            </Button>
          );
        },
      },
    ],
    [copiedId, copyText]
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Riwayat Berkas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Daftar seluruh berkas CSV yang telah dialirkan ke Unity Catalog Volume.
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
          <span>Muat Ulang</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Cari berdasarkan nama berkas..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="text-xs text-zinc-500">
              Total {data.length} berkas
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {data.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Belum ada berkas CSV</h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4 max-w-xs">
                Unggah berkas CSV pertama Anda untuk memulai proses profiling dan pembersihan data.
              </p>
              <Button asChild size="sm">
                <Link href="/">Impor CSV Sekarang</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
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
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="p-8 text-center text-zinc-500">
                        {loading ? "Memuat riwayat..." : "Tidak ada berkas yang cocok dengan filter."}
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-zinc-50 transition-colors"
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
          )}

          {table.getPageCount() > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Halaman {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()}
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
