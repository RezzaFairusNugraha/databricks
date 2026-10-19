import { NextRequest, NextResponse } from "next/server";
import { generateCleaningSql } from "@/lib/cleaning/sql-generator";
import { CleaningPlanSchema } from "@/lib/cleaning/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedPlan = CleaningPlanSchema.parse(rawBody);
    const generated = generateCleaningSql(validatedPlan);

    return NextResponse.json({
      success: true,
      plan: validatedPlan,
      ...generated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Plan generation failed",
      },
      { status: 400 }
    );
  }
}
