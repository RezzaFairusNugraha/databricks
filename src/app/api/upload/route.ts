import { NextRequest, NextResponse } from "next/server";
import { getDatabricksConfig, mapDatabricksError, uploadToVolume } from "@/lib/databricks";
import { addJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Increase max execution duration for large uploads if supported by the host
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const config = getDatabricksConfig();

    const url = new URL(request.url);
    const filenameHeader =
      request.headers.get("x-filename") ||
      url.searchParams.get("filename") ||
      "data.csv";
    const filename = decodeURIComponent(filenameHeader);

    const catalog =
      request.headers.get("x-catalog") ||
      url.searchParams.get("catalog") ||
      config.defaultCatalog;
    const schema =
      request.headers.get("x-schema") ||
      url.searchParams.get("schema") ||
      config.defaultSchema;
    const volume =
      request.headers.get("x-volume") ||
      url.searchParams.get("volume") ||
      config.defaultVolume;

    // Check content length against max size
    const contentLength = request.headers.get("content-length");
    const maxSizeBytes = config.maxUploadSizeMb * 1024 * 1024;
    const reportedSize = contentLength ? parseInt(contentLength, 10) : 0;

    if (reportedSize > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran berkas melebihi batas maksimum (${config.maxUploadSizeMb} MB).`,
          code: "ERR_FILE_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        {
          success: false,
          error: "Stream body permintaan kosong atau tidak terkirim.",
          code: "ERR_EMPTY_BODY",
        },
        { status: 400 }
      );
    }

    // Direct streaming to Databricks Unity Catalog Volume without loading into memory!
    const result = await uploadToVolume(request.body, filename, {
      catalog,
      schema,
      volume,
    });

    // Record job to history
    addJob({
      jobId: result.jobId,
      fileName: result.fileName,
      fileSize: reportedSize,
      volumeFilePath: result.volumeFilePath,
      fullVolumePath: result.fullVolumePath,
      catalog: result.catalog,
      schema: result.schema,
      volume: result.volume,
      createdAt: result.uploadedAt,
      status: "uploaded",
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      fileName: result.fileName,
      fileSize: reportedSize,
      volumeFilePath: result.volumeFilePath,
      fullVolumePath: result.fullVolumePath,
      catalog: result.catalog,
      schema: result.schema,
      volume: result.volume,
      uploadedAt: result.uploadedAt,
      message: "Berkas berhasil dialirkan ke Databricks Unity Catalog Volume.",
    });
  } catch (error) {
    const mapped = mapDatabricksError(error);
    return NextResponse.json(
      {
        success: false,
        error: mapped.friendlyMessageId,
        details: mapped.message,
        code: mapped.code,
        suggestion: mapped.suggestion,
      },
      { status: mapped.statusCode || 500 }
    );
  }
}
