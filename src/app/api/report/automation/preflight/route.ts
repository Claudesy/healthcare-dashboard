import { NextResponse } from "next/server";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import {
  getDataSourceDir,
  getTemplatePath,
  getMappingPath,
  loadLb1Config,
  resolveProjectPath,
  pathExists,
} from "@/lib/lb1/config";
import { parseExportFile } from "@/lib/lb1/io";
import { isCrewAuthorizedRequest } from "@/lib/server/crew-access-auth";

export const runtime = "nodejs";

type RunMode = "full-cycle" | "pipeline";

function parseMode(input: string): RunMode {
  return input === "pipeline" ? "pipeline" : "full-cycle";
}

function parseYearMonth(url: URL): { year: number; month: number } {
  const now = new Date();
  const year = Number(url.searchParams.get("year") || now.getFullYear());
  const month = Number(url.searchParams.get("month") || now.getMonth() + 1);
  return {
    year: Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

function resolveLb1Paths(config: ReturnType<typeof loadLb1Config>): {
  dataDir: string;
  templatePath: string;
  mappingPath: string;
} {
  const lb1 =
    config?.lb1 && typeof config.lb1 === "object"
      ? (config.lb1 as Record<string, unknown>)
      : {};

  return {
    dataDir: getDataSourceDir(),
    templatePath: process.env.LB1_TEMPLATE_PATH || resolveProjectPath(lb1.template_path, getTemplatePath()),
    mappingPath: process.env.LB1_MAPPING_PATH || resolveProjectPath(lb1.mapping_path, getMappingPath()),
  };
}

async function listExportCandidates(dir: string, year: number, month: number): Promise<string[]> {
  if (!(await pathExists(dir))) return [];

  const files = await readdir(dir);
  const mm = String(month).padStart(2, "0");
  const exportCandidates = files.filter((f) => f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".csv"));
  if (exportCandidates.length === 0) return [];

  const filesWithMeta = (
    await Promise.all(
      exportCandidates.map(async (name) => {
        const fullPath = path.join(dir, name);
        try {
          const fileStat = await stat(fullPath);
          return { name, fullPath, mtimeMs: fileStat.mtimeMs };
        } catch {
          return null;
        }
      }),
    )
  ).filter((entry): entry is { name: string; fullPath: string; mtimeMs: number } => Boolean(entry));

  if (filesWithMeta.length === 0) return [];

  const patterns = [
    `rme_export_${year}_${mm}`,
    `encounters_${year}_${mm}`,
    `export_${year}_${mm}`,
    `kunjungan_${year}_${mm}`,
  ];

  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (fullPath: string) => {
    if (seen.has(fullPath)) return;
    seen.add(fullPath);
    ordered.push(fullPath);
  };

  for (const pattern of patterns) {
    filesWithMeta
      .filter((f) => f.name.startsWith(pattern))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .forEach((entry) => pushUnique(entry.fullPath));
  }

  filesWithMeta
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .forEach((entry) => pushUnique(entry.fullPath));

  return ordered;
}

export async function GET(request: Request) {
  if (!isCrewAuthorizedRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const mode = parseMode((url.searchParams.get("mode") || "full-cycle").trim().toLowerCase());
    const { year, month } = parseYearMonth(url);

    const config = loadLb1Config();
    const { dataDir, templatePath, mappingPath } = resolveLb1Paths(config);
    const [dataDirExists, templateExists, mappingExists] = await Promise.all([
      pathExists(dataDir),
      pathExists(templatePath),
      pathExists(mappingPath),
    ]);

    const exportCandidates = await listExportCandidates(dataDir, year, month);
    const limitedCandidates = exportCandidates.slice(0, 10);

    let parserOk = false;
    let parserError = "";
    let parserFile = "";
    let parserRows = 0;

    for (const filePath of limitedCandidates.slice(0, 3)) {
      try {
        const parsed = parseExportFile(filePath);
        parserOk = true;
        parserFile = filePath;
        parserRows = parsed.rows.length;
        break;
      } catch (error) {
        parserError = error instanceof Error ? error.message : String(error);
      }
    }

    const rmeBaseUrl = config?.rme?.base_url?.trim() ?? "";
    const usernameEnv = config?.rme?.username_env?.trim() || "LB1_RME_USERNAME";
    const passwordEnv = config?.rme?.password_env?.trim() || "LB1_RME_PASSWORD";
    const rmeCredentialsAvailable = Boolean(
      process.env[usernameEnv]?.trim() && process.env[passwordEnv]?.trim(),
    );

    const issues: string[] = [];
    const warnings: string[] = [];
    const rmeFallbackAvailable = Boolean(rmeBaseUrl && rmeCredentialsAvailable);

    if (!templateExists) {
      issues.push(`Template LB1 tidak ditemukan: ${templatePath}`);
    }
    if (!mappingExists) {
      warnings.push(`Mapping diagnosis tidak ditemukan: ${mappingPath}`);
    }

    if (mode === "pipeline") {
      if (!dataDirExists) issues.push(`Data source dir tidak ditemukan: ${dataDir}`);
      if (limitedCandidates.length === 0) {
        if (rmeFallbackAvailable) {
          warnings.push("Tidak ada file export lokal. Engine akan mencoba RPA live export sebagai fallback.");
        } else {
          issues.push("Tidak ada file export untuk mode pipeline.");
        }
      }
      if (limitedCandidates.length > 0 && !parserOk) {
        if (rmeFallbackAvailable) {
          warnings.push(`File export lokal gagal diparsing. Engine akan mencoba RPA live export: ${parserError || "unknown parse error"}`);
        } else {
          issues.push(`File export ada tetapi gagal diparsing: ${parserError || "unknown parse error"}`);
        }
      }
    } else {
      if (!rmeBaseUrl) issues.push("RME base_url belum dikonfigurasi untuk mode full-cycle.");
      if (!rmeCredentialsAvailable) {
        issues.push(`Credential RME belum tersedia di env (${usernameEnv}, ${passwordEnv}).`);
      }
      if (limitedCandidates.length > 0 && !parserOk) {
        warnings.push(`Export lokal gagal diparsing, akan mengandalkan RPA live export: ${parserError || "unknown parse error"}`);
      }
    }

    return NextResponse.json({
      ok: issues.length === 0,
      mode,
      period: { year, month },
      paths: {
        dataDir,
        templatePath,
        mappingPath,
      },
      existence: {
        dataDirExists,
        templateExists,
        mappingExists,
      },
      rme: {
        configured: Boolean(rmeBaseUrl),
        baseUrl: rmeBaseUrl || "",
        usernameEnv,
        passwordEnv,
        credentialsAvailable: rmeCredentialsAvailable,
      },
      export: {
        candidateCount: limitedCandidates.length,
        candidates: limitedCandidates,
        parserOk,
        parserFile,
        parserRows,
        parserError,
      },
      issues,
      warnings,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Preflight check failed" },
      { status: 500 },
    );
  }
}
