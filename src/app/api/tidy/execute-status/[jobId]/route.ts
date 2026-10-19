import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/lib/db";
import { jobExecutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pollSqlStatementStatus } from "@/lib/databricks/client";
import { getDatabricksConfig } from "@/lib/databricks/config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    await ensureDbInitialized();
    const { jobId } = await params;

    const records = await db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.id, jobId));

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pekerjaan pemuatan tidak ditemukan." },
        { status: 404 }
      );
    }

    const exec = records[0];
    const config = getDatabricksConfig();

    if (exec.status === "running" && exec.cleanStatementId) {
      try {
        const pollRes = await pollSqlStatementStatus(exec.cleanStatementId);

        if (pollRes.isComplete) {
          const newStatus = pollRes.isSuccess ? "succeeded" : "failed";
          const now = new Date().toISOString();

          await db
            .update(jobExecutions)
            .set({
              status: newStatus,
              rowsClean: pollRes.rowCount || 0,
              errorMessage: pollRes.errorMessage || null,
              updatedAt: now,
            })
            .where(eq(jobExecutions.id, jobId));

          exec.status = newStatus;
          exec.rowsClean = pollRes.rowCount || 0;
          exec.errorMessage = pollRes.errorMessage || null;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Polling statement status failed:", msg);
      }
    }

    const hostClean = config.host?.replace(/\/$/, "") || "https://dbc.cloud.databricks.com";
    const tableUrl = `${hostClean}/explore/data/${encodeURIComponent(exec.targetCatalog)}/${encodeURIComponent(exec.targetSchema)}/${encodeURIComponent(exec.targetTable)}`;
    const quarantineTableUrl = `${hostClean}/explore/data/${encodeURIComponent(exec.targetCatalog)}/${encodeURIComponent(exec.targetSchema)}/${encodeURIComponent(`${exec.targetTable}_quarantine`)}`;

    const timeline = [
      {
        id: "validate",
        title: "Validasi Skema & Rencana Pembersihan",
        status: "succeeded",
        time: exec.createdAt,
      },
      {
        id: "source",
        title: "Persiapan Source Volume via read_files",
        status: "succeeded",
        time: exec.createdAt,
      },
      {
        id: "quarantine",
        title: `Eksekusi Tabel Karantina (${exec.targetTable}_quarantine)`,
        status: exec.status === "pending" ? "pending" : "succeeded",
        time: exec.updatedAt,
      },
      {
        id: "target",
        title: `Penulisan Tabel Target (${exec.targetCatalog}.${exec.targetSchema}.${exec.targetTable})`,
        status: exec.status,
        time: exec.updatedAt,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        jobId: exec.id,
        idempotencyKey: exec.idempotencyKey,
        targetCatalog: exec.targetCatalog,
        targetSchema: exec.targetSchema,
        targetTable: exec.targetTable,
        writeMode: exec.writeMode,
        status: exec.status,
        rowsClean: exec.rowsClean,
        rowsQuarantine: exec.rowsQuarantine,
        tableUrl,
        quarantineTableUrl,
        errorMessage: exec.errorMessage,
        timeline,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to poll status";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
