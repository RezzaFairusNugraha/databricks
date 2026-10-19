import { NextRequest, NextResponse } from "next/server";
import { fetchVolumeFileChunk, runSql } from "@/lib/databricks/client";
import { getDatabricksConfig } from "@/lib/databricks/config";
import { buildProfileQuery } from "@/lib/databricks/sql-builder";
import { sniffCsvBuffer, DetectionOverrides } from "@/lib/detector/csv-sniffer";
import { getJobById } from "@/lib/jobs";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, volumeFilePath, sampleFile, overrides } = body as {
      jobId?: string;
      volumeFilePath?: string;
      sampleFile?: string;
      overrides?: DetectionOverrides;
    };

    let targetPath = volumeFilePath;

    const config = getDatabricksConfig();
    let jobCatalog = config.defaultCatalog || "main";
    let jobSchema = config.defaultSchema || "csv_tidy";
    let jobVolume = config.defaultVolume || "raw_uploads";

    if (sampleFile) {
      targetPath = `sample:${sampleFile}`;
    } else if (jobId) {
      const job = getJobById(jobId);
      if (job) {
        if (!targetPath) {
          targetPath = job.volumeFilePath;
        }
        if (job.catalog) jobCatalog = job.catalog;
        if (job.schema) jobSchema = job.schema;
        if (job.volume) jobVolume = job.volume;
      }
    }

    if (!targetPath) {
      targetPath = "sample:samples/indonesian_sales_messy.csv";
    }

    let chunk: Buffer;
    try {
      chunk = await fetchVolumeFileChunk(targetPath, 65536);
    } catch (fetchErr) {
      const fallbackLocal = path.join(
        process.cwd(),
        "samples",
        "indonesian_sales_messy.csv"
      );
      if (fs.existsSync(fallbackLocal)) {
        chunk = fs.readFileSync(fallbackLocal).subarray(0, 65536);
      } else {
        throw fetchErr;
      }
    }

    const sniffResult = sniffCsvBuffer(chunk, overrides || {});

    const hasLiveDatabricks = Boolean(
      config.host && config.warehouseId && (config.token || config.clientId)
    );
    let databricksProfile: Record<string, unknown> | null = null;

    if (hasLiveDatabricks && targetPath.startsWith("/Volumes/")) {
      try {
        const profileSql = buildProfileQuery(targetPath, {
          delimiter: sniffResult.detectedDelimiter,
          header: sniffResult.structure.headerRowIndex >= 0,
          columns: sniffResult.columns.map((c) => c.rawHeader),
        });
        const profileRes = await runSql(profileSql, { timeoutSecs: 30 });
        if (profileRes.rows.length > 0) {
          databricksProfile = profileRes.rows[0];
        }
      } catch (profileErr) {
        console.warn(
          "Databricks read_files profiling fallback:",
          profileErr instanceof Error ? profileErr.message : profileErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      targetPath,
      catalog: jobCatalog,
      schema: jobSchema,
      volume: jobVolume,
      data: sniffResult,
      result: sniffResult,
      databricksProfile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Detection failed",
      },
      { status: 200 }
    );
  }
}
