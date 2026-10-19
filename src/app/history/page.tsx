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
  Inbox,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "uploaded":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "processing":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  const columns = React.useMemo<ColumnDef<JobRecord>[]>(
    () => [
      {
        accessorKey: "jobId",
        header: "ID Pekerjaan",
        cell: ({ row }) => {
          const jobId = row.getValue("jobId") as string;
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-semibold text-zinc-900">
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
            className="-ml-3 h-8 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Nama Berkas</span>
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-zinc-900">
            <FileSpreadsheet className="h-4 w-4 text-zinc-400 shrink-0" />
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
            <span className="text-xs text-zinc-600 font-mono">
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
              <span className="truncate font-mono text-xs text-zinc-600" title={path}>
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
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase ${getStatusBadge(
                status
              )}`}
            >
              {status}
            </span>
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
            <span className="text-xs text-zinc-600">
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
            <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50">
              <Link href={`/tidy/${jobId}`}>
                <span>Bersihkan</span>
                <ArrowRight className="h-3 w-3" />
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
    <div className="max-w-5xl mx-auto space-y-8 animate-page-in">
      <PageHeader
        title="Riwayat Berkas"
        description="Daftar seluruh berkas CSV yang telah dialirkan ke Unity Catalog Volume."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchJobs}
          disabled={loading}
          className="gap-2 text-xs h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Muat Ulang</span>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3 border-b border-zinc-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Cari berdasarkan nama berkas..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 text-xs h-10 rounded-lg"
              />
            </div>
            <div className="text-xs text-zinc-500">
              Total {data.length} berkas
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {data.length === 0 && !loading ? (
            <div className="p-6">
              <EmptyState
                icon={Inbox}
                title="Belum ada berkas CSV"
                description="Unggah berkas CSV pertama Anda untuk memulai proses profiling dan pembersihan data."
                action={
                  <Button asChild size="sm">
                    <Link href="/">Impor CSV Sekarang</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="py-2.5 px-3.5 font-medium">
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
                      <td colSpan={columns.length} className="py-8 text-center text-zinc-500">
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
                          <td key={cell.id} className="py-3 px-3.5">
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
            <div className="p-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
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
