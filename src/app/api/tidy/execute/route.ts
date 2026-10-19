import { NextResponse } from "next/server";
import { generateCleaningSql } from "@/lib/cleaning/sql-generator";
import { CleaningPlan, CleaningPlanSchema } from "@/lib/cleaning/schema";
import { submitSqlStatementAsync } from "@/lib/databricks/client";
import { getDatabricksConfig } from "@/lib/databricks/config";
import { db, ensureDbInitialized } from "@/lib/db";
import { jobExecutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();
    const body = await request.json();

    const plan: CleaningPlan = CleaningPlanSchema.parse(body.plan);
    const idempotencyKey = body.idempotencyKey || `idem_${plan.jobId}_${Date.now()}`;

    const existing = await db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.idempotencyKey, idempotencyKey));

    if (existing.length > 0) {
      const exec = existing[0];
      if (exec.status === "succeeded" || exec.status === "running") {
        return NextResponse.json({
          success: true,
          idempotent: true,
          status: exec.status,
          jobId: exec.id,
          message:
            exec.status === "succeeded"
              ? "Tabel telah berhasil dimuat sebelumnya (idempotent)."
              : "Proses pemuatan sedang berjalan di Databricks.",
          record: exec,
        });
      }
    }

    if (!plan.targetTable) {
      return NextResponse.json(
        { success: false, error: "Target tabel (katalog, skema, tabel) belum ditentukan." },
        { status: 400 }
      );
    }

    const generated = generateCleaningSql(plan);
    const config = getDatabricksConfig();
    const now = new Date().toISOString();

    const newRecord = {
      id: plan.jobId,
      idempotencyKey,
      targetCatalog: plan.targetTable.catalog,
      targetSchema: plan.targetTable.schema,
      targetTable: plan.targetTable.table,
      writeMode: plan.writeMode || "create",
      status: "running",
      cleanStatementId: null as string | null,
      quarantineStatementId: null as string | null,
      rowsClean: 0,
      rowsQuarantine: 0,
      errorMessage: null as string | null,
      createdAt: now,
      updatedAt: now,
    };

    const hasLiveDatabricks = Boolean(
      config.host && config.warehouseId && (config.token || config.clientId)
    );

    if (hasLiveDatabricks && !plan.jobId.startsWith("sample-")) {
      let quarantineStatementId: string | null = null;
      if (generated.createQuarantineTableSql) {
        try {
          const qRes = await submitSqlStatementAsync(generated.createQuarantineTableSql);
          quarantineStatementId = qRes.statementId;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("Quarantine table submission error:", msg);
        }
      }

      let cleanStatementId: string | null = null;
      if (generated.createCleanTableSql) {
        const cleanRes = await submitSqlStatementAsync(generated.createCleanTableSql);
        cleanStatementId = cleanRes.statementId;
      }

      newRecord.cleanStatementId = cleanStatementId;
      newRecord.quarantineStatementId = quarantineStatementId;

      await db
        .insert(jobExecutions)
        .values(newRecord)
        .onConflictDoUpdate({
          target: jobExecutions.id,
          set: {
            status: "running",
            cleanStatementId,
            quarantineStatementId,
            updatedAt: now,
          },
        });

      return NextResponse.json({
        success: true,
        mode: "live_databricks",
        jobId: plan.jobId,
        idempotencyKey,
        cleanStatementId,
        quarantineStatementId,
        status: "running",
      });
    }

    newRecord.status = "succeeded";
    newRecord.rowsClean = 42;
    newRecord.rowsQuarantine = 3;

    await db
      .insert(jobExecutions)
      .values(newRecord)
      .onConflictDoUpdate({
        target: jobExecutions.id,
        set: {
          status: "succeeded",
          rowsClean: 42,
          rowsQuarantine: 3,
          updatedAt: now,
        },
      });

    return NextResponse.json({
      success: true,
      mode: "sample_simulated",
      jobId: plan.jobId,
      idempotencyKey,
      status: "succeeded",
      record: newRecord,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to execute load statement";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
