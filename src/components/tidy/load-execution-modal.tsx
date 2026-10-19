"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  Database,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface LoadExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: "idle" | "running" | "succeeded" | "failed";
  progressPercent: number;
  timeline: Array<{
    id: string;
    title: string;
    status: string;
    time: string;
  }>;
  rowsClean: number;
  rowsQuarantine: number;
  tableUrl?: string;
  quarantineTableUrl?: string;
  errorMessage?: string | null;
  targetCatalog: string;
  targetSchema: string;
  targetTable: string;
  writeMode: string;
}

export function LoadExecutionModal({
  isOpen,
  onClose,
  status,
  progressPercent,
  timeline,
  rowsClean,
  rowsQuarantine,
  tableUrl,
  quarantineTableUrl,
  errorMessage,
  targetCatalog,
  targetSchema,
  targetTable,
  writeMode,
}: LoadExecutionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider">
            <Database className="h-4 w-4" />
            Unity Catalog Ingestion
          </div>
          <DialogTitle className="text-base font-semibold text-zinc-900">
            {status === "succeeded"
              ? "Pemuatan Berhasil"
              : status === "failed"
              ? "Gagal Memuat ke Databricks"
              : "Memproses Data..."}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Target: <code className="font-mono text-zinc-800">{targetCatalog}.{targetSchema}.{targetTable}</code> ({writeMode.toUpperCase()})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Kemajuan</span>
              <span className="font-mono text-zinc-900">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
            {timeline.map((step) => {
              const isStepDone = step.status === "succeeded";
              const isStepRunning = step.status === "running";

              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isStepDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isStepRunning ? (
                      <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <span
                      className={`font-medium ${
                        isStepDone
                          ? "text-zinc-900"
                          : isStepRunning
                          ? "text-indigo-600 font-semibold"
                          : "text-zinc-400"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {isStepDone && (
                    <Badge variant="success" className="text-xs">
                      Selesai
                    </Badge>
                  )}
                  {isStepRunning && (
                    <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">
                      Berjalan...
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {status === "succeeded" && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-zinc-200 bg-white">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    Baris Bersih
                  </div>
                  <div className="text-xl font-semibold font-mono text-zinc-900 mt-1">
                    {rowsClean.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-200 bg-white">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    Baris Karantina
                  </div>
                  <div className="text-xl font-semibold font-mono text-zinc-900 mt-1">
                    {rowsQuarantine.toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {tableUrl && (
                  <Button
                    variant="outline"
                    className="w-full text-xs justify-between"
                    onClick={() => window.open(tableUrl, "_blank")}
                  >
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Buka Tabel di Databricks
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}

                {quarantineTableUrl && rowsQuarantine > 0 && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs justify-between text-zinc-600 hover:text-zinc-900"
                    onClick={() => window.open(quarantineTableUrl, "_blank")}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      Buka Tabel Karantina di Databricks
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50 text-rose-800 text-xs space-y-1 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Kesalahan Eksekusi Databricks:</p>
                <p className="font-mono text-xs text-rose-700 leading-relaxed mt-0.5">
                  {errorMessage || "Pemuatan query gagal dieksekusi di SQL Warehouse."}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant={status === "succeeded" ? "default" : "secondary"}
              size="sm"
              onClick={onClose}
              disabled={status === "running"}
            >
              {status === "succeeded" ? "Selesai" : "Tutup"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
