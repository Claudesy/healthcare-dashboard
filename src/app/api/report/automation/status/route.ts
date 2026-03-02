import { NextResponse } from "next/server";
import { getDataSourceDir, getHistoryFile, pathExists } from "@/lib/lb1/config";
import path from "node:path";
import { isCrewAuthorizedRequest } from "@/lib/server/crew-access-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCrewAuthorizedRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dataSourceDir = getDataSourceDir();
    const historyFile = getHistoryFile();
    const outputDir = path.join(process.cwd(), "runtime", "lb1-output");

    const [dataSourceExists, historyExists, outputExists] = await Promise.all([
      pathExists(dataSourceDir),
      pathExists(historyFile),
      pathExists(outputDir),
    ]);

    return NextResponse.json({
      ok: true,
      engine: "typescript",          // tidak butuh Python
      pythonRequired: false,
      dataSourceDir,
      dataSourceExists,
      historyFile,
      historyExists,
      outputDir,
      outputExists,
      status: "ready",
      message: "LB1 Engine berjalan dalam TypeScript native — tidak memerlukan Python.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 },
    );
  }
}
