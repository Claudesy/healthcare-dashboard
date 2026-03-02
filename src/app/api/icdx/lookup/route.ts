import { NextResponse } from "next/server";
import { lookupIcdDynamically } from "@/lib/icd/dynamic-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const payload = lookupIcdDynamically(q);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load ICD database",
      },
      { status: 500 },
    );
  }
}
