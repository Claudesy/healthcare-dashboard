import { access } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";
import type { Lb1Config } from "./types";

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function getHistoryFile(): string {
  return (
    process.env.LB1_HISTORY_FILE ||
    path.join(process.cwd(), "runtime", "lb1-run-history.jsonl")
  );
}

export function getDataSourceDir(): string {
  return (
    process.env.LB1_DATA_SOURCE_DIR ||
    path.join(process.cwd(), "runtime", "lb1-data")
  );
}

export function getOutputDir(): string {
  return path.join(process.cwd(), "runtime", "lb1-output");
}

export function getTemplatePath(): string {
  return (
    process.env.LB1_TEMPLATE_PATH ||
    path.join(process.cwd(), "runtime", "Laporan SP3 LB1.xlsx")
  );
}

export function getMappingPath(): string {
  return (
    process.env.LB1_MAPPING_PATH ||
    path.join(process.cwd(), "runtime", "diagnosis_mapping.csv")
  );
}

export function resolveProjectPath(configValue: unknown, fallback: string): string {
  const raw = String(configValue ?? "").trim();
  if (!raw) return fallback;
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

export function getConfigPath(): string {
  return (
    process.env.LB1_CONFIG_PATH ||
    path.join(process.cwd(), "runtime", "lb1-config.yaml")
  );
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Load YAML config (lb1-config.yaml) ──────────────────────────────────────

export function loadLb1Config(): Lb1Config | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;

  try {
    // Lazy import js-yaml
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require("js-yaml") as { load: (s: string) => unknown };
    const content = fs.readFileSync(configPath, "utf-8");
    return yaml.load(content) as Lb1Config;
  } catch (error) {
    console.warn(
      `Gagal membaca config LB1 (${configPath}):`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
