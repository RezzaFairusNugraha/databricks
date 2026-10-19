import { NextResponse } from "next/server";
import { generateCleaningSql } from "@/lib/cleaning/sql-generator";
import { CleaningPlan, CleaningPlanSchema } from "@/lib/cleaning/schema";
import { runSql } from "@/lib/databricks/client";
import { getDatabricksConfig } from "@/lib/databricks/config";
import fs from "fs";
import path from "path";
import { parseCsvLines, splitCsvLine } from "@/lib/detector/delimiter";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan: CleaningPlan = CleaningPlanSchema.parse(body.plan);

    const generated = generateCleaningSql(plan);
    const config = getDatabricksConfig();

    const hasLiveDatabricks = Boolean(config.host && config.warehouseId && (config.token || config.clientId));

    if (hasLiveDatabricks && !plan.jobId.startsWith("sample-")) {
      try {
        const [rawResult, cleanResult] = await Promise.all([
          runSql(generated.rawPreviewSql, { maxRows: 50 }),
          runSql(generated.previewSql, { maxRows: 50 }),
        ]);

        const rowsIn = rawResult.rowCount || rawResult.rows.length;
        const rowsOut = cleanResult.rowCount || cleanResult.rows.length;
        const rowsInQuarantine = Math.max(0, rowsIn - rowsOut);

        return NextResponse.json({
          success: true,
          mode: "live_databricks",
          rawRows: rawResult.rows,
          cleanRows: cleanResult.rows,
          summary: {
            rowsIn,
            rowsOut,
            duplicatesRemoved: 0,
            rowsInQuarantine,
          },
          sql: generated,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Live Databricks preview failed, falling back to local simulation:", msg);
      }
    }

    let sampleFilePath = path.join(process.cwd(), "samples", "indonesian_sales_messy.csv");
    if (plan.jobId === "sample-2") {
      sampleFilePath = path.join(process.cwd(), "samples", "telco_customer_churn_messy.csv");
    } else if (plan.jobId === "sample-3") {
      sampleFilePath = path.join(process.cwd(), "samples", "ecommerce_orders_latin1.csv");
    }

    let rawLines: string[] = [];
    if (fs.existsSync(sampleFilePath)) {
      const content = fs.readFileSync(sampleFilePath, "utf8");
      rawLines = parseCsvLines(content);
    } else {
      rawLines = ["id;nama;total", "1;Budi Santoso;Rp 150.000", "2;Siti Rahma;Rp 250.000"];
    }

    const delimiter = plan.sourceOptions?.delimiter || ";";
    const headerRowIdx = plan.sourceOptions?.headerRowIndex || 0;
    const rawHeaders = splitCsvLine(rawLines[headerRowIdx] || "", delimiter);

    const rawRows: Array<Record<string, string>> = [];
    for (let i = headerRowIdx + 1; i < Math.min(rawLines.length, headerRowIdx + 51); i++) {
      const parts = splitCsvLine(rawLines[i], delimiter);
      const row: Record<string, string> = {};
      rawHeaders.forEach((h, idx) => {
        row[h.trim() || `col_${idx}`] = parts[idx] ?? "";
      });
      rawRows.push(row);
    }

    const cleanRows: Array<Record<string, unknown>> = [];
    let quarantineCount = 0;

    rawRows.forEach((raw) => {
      let isQuarantine = false;
      const cleanRow: Record<string, unknown> = {};

      if (plan.targetColumns && plan.targetColumns.length > 0 && plan.columnMappings) {
        for (const tc of plan.targetColumns) {
          const mappingItem = plan.columnMappings.find((m) => m.targetColumnName === tc.name);
          let val: unknown = null;

          if (!mappingItem || mappingItem.mapping.type === "empty") {
            val = null;
          } else if (mappingItem.mapping.type === "constant") {
            val = mappingItem.mapping.value;
          } else if (mappingItem.mapping.type === "csv_column") {
            val = raw[mappingItem.mapping.sourceColumn] ?? null;
          } else if (mappingItem.mapping.type === "split") {
            const rawVal = String(raw[mappingItem.mapping.sourceColumn] ?? "");
            const parts = rawVal.split(mappingItem.mapping.delimiter);
            val = parts[mappingItem.mapping.partIndex - 1] ?? null;
          } else if (mappingItem.mapping.type === "merge") {
            const vals = mappingItem.mapping.sourceColumns.map((col) => raw[col] ?? "").filter(Boolean);
            val = vals.join(mappingItem.mapping.separator);
          }

          if (typeof val === "string") {
            val = val.trim();
            if (val === "N/A" || val === "-" || (val as string).toLowerCase() === "null") val = null;
          }

          if (tc.type === "DECIMAL" && typeof val === "string") {
            const numStr = val.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
            const num = parseFloat(numStr);
            val = isNaN(num) ? null : num;
          } else if (tc.type === "INT" && typeof val === "string") {
            const num = parseInt(val.replace(/[^0-9-]/g, ""), 10);
            val = isNaN(num) ? null : num;
          }

          if (!tc.nullable && val === null) {
            isQuarantine = true;
          }

          cleanRow[tc.name] = val;
        }
      } else {
        Object.entries(raw).forEach(([k, v]) => {
          let cleaned: unknown = v.trim();
          if (cleaned === "N/A" || cleaned === "-" || (typeof cleaned === "string" && cleaned.toLowerCase() === "null")) cleaned = null;
          cleanRow[k] = cleaned;
        });
      }

      if (isQuarantine) {
        quarantineCount++;
      } else {
        cleanRows.push(cleanRow);
      }
    });

    const rowsIn = rawRows.length;
    const rowsOut = cleanRows.length;

    return NextResponse.json({
      success: true,
      mode: "sample_simulated",
      rawRows,
      cleanRows,
      summary: {
        rowsIn,
        rowsOut,
        duplicatesRemoved: 0,
        rowsInQuarantine: quarantineCount,
      },
      sql: generated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate preview";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
