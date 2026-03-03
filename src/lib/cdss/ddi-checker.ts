/**
 * Iskandar Diagnosis Engine V1 — Drug-Drug Interaction Checker
 * Adapted for Next.js: uses fs.readFileSync instead of dynamic import('@/data/...').
 * DDInter 2.0 database (173,071 clinical interactions).
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type DDISeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: DDISeverity;
  description: string;
  recommendation: string;
  source: string;
}

interface DDIDatabase {
  version: string;
  source: string;
  stats: { drugs: number; interactions: number; byLevel: { major: number; moderate: number } };
  severityCodes: Record<string, number>;
  drugs: Record<string, number>;
  drugNames: string[];
  interactions: [number, number, number][];
}

interface DDICheckResult {
  interactions: DrugInteraction[];
  hasBlocking: boolean;
  stats: { major: number; moderate: number; total: number };
}

// ── Database Loader ───────────────────────────────────────────────────────────

let ddiDatabase: DDIDatabase | null = null;
let interactionIndex: Map<string, Map<string, number>> | null = null;

function normalizeDrugName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildInteractionIndex(db: DDIDatabase): Map<string, Map<string, number>> {
  const index = new Map<string, Map<string, number>>();
  for (const [idxA, idxB, severity] of db.interactions) {
    const drugA = db.drugNames[idxA];
    const drugB = db.drugNames[idxB];
    if (!drugA || !drugB) continue;
    if (!index.has(drugA)) index.set(drugA, new Map());
    if (!index.has(drugB)) index.set(drugB, new Map());
    index.get(drugA)!.set(drugB, severity);
    index.get(drugB)!.set(drugA, severity);
  }
  return index;
}

export function loadDDIDatabase(): boolean {
  if (ddiDatabase && interactionIndex) return true;
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'ddi-clinical.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    ddiDatabase = JSON.parse(raw) as DDIDatabase;
    interactionIndex = buildInteractionIndex(ddiDatabase);
    console.log(`[DDI] Database loaded: ${ddiDatabase.stats.drugs} drugs, ${ddiDatabase.stats.interactions} interactions`);
    return true;
  } catch (error) {
    console.error('[DDI] Failed to load database:', error);
    return false;
  }
}

export function getDDIStatus(): { loaded: boolean; drugs: number; interactions: number; version: string } {
  if (!ddiDatabase) return { loaded: false, drugs: 0, interactions: 0, version: 'not loaded' };
  return { loaded: true, drugs: ddiDatabase.stats.drugs, interactions: ddiDatabase.stats.interactions, version: ddiDatabase.version };
}

// ── Severity Mapping ──────────────────────────────────────────────────────────

const SEVERITY_CODE_TO_NAME: Record<number, DDISeverity> = { 2: 'moderate', 3: 'major' };

const SEVERITY_DESCRIPTIONS: Record<DDISeverity, string> = {
  contraindicated: 'Kombinasi ini kontraindikasi dan harus dihindari.',
  major: 'Interaksi signifikan yang dapat menyebabkan efek samping serius. Monitor ketat diperlukan.',
  moderate: 'Interaksi yang memerlukan perhatian. Pertimbangkan penyesuaian dosis atau monitoring.',
  minor: 'Interaksi ringan. Umumnya tidak memerlukan perubahan terapi.',
};

const SEVERITY_RECOMMENDATIONS: Record<DDISeverity, string> = {
  contraindicated: 'Hindari kombinasi ini. Konsultasikan dengan dokter spesialis.',
  major: 'Evaluasi kebutuhan terapi. Monitor efek samping dan pertimbangkan alternatif.',
  moderate: 'Monitor pasien untuk efek samping. Sesuaikan dosis jika diperlukan.',
  minor: 'Lanjutkan terapi dengan monitoring standar.',
};

// ── Drug Aliases (Indonesian brand/generic mappings) ─────────────────────────

const DRUG_ALIASES: Record<string, string[]> = {
  aspirin: ['asam asetilsalisilat', 'acetylsalicylic acid', 'asa'],
  paracetamol: ['acetaminophen', 'parasetamol'],
  ibuprofen: ['proris', 'brufen', 'advil'],
  meloxicam: ['mobic'],
  diclofenac: ['voltaren', 'cataflam', 'natrium diklofenak'],
  amlodipine: ['norvasc', 'amlodipin'],
  captopril: ['capoten'],
  lisinopril: ['zestril'],
  losartan: ['cozaar'],
  simvastatin: ['zocor'],
  atorvastatin: ['lipitor'],
  metformin: ['glucophage', 'glumin'],
  glibenclamide: ['daonil', 'glyburide'],
  glimepiride: ['amaryl'],
  amoxicillin: ['amoxil', 'amoksisilin'],
  ciprofloxacin: ['ciproxin', 'cipro'],
  metronidazole: ['flagyl'],
  omeprazole: ['losec', 'prilosec'],
  ranitidine: ['zantac', 'ranitidin'],
  diazepam: ['valium'],
  alprazolam: ['xanax'],
  amitriptyline: ['elavil'],
  sertraline: ['zoloft'],
  fluoxetine: ['prozac'],
  warfarin: ['coumadin', 'simarc'],
  clopidogrel: ['plavix'],
  prednisone: ['deltasone'],
  prednisolone: ['prelone'],
  dexamethasone: ['decadron'],
};

function findDrugMatch(drugName: string): string | null {
  if (!interactionIndex) return null;
  const normalized = normalizeDrugName(drugName);
  if (!normalized) return null;
  if (interactionIndex.has(normalized)) return normalized;
  for (const [canonical, aliases] of Object.entries(DRUG_ALIASES)) {
    const canonicalNorm = normalizeDrugName(canonical);
    if (normalized === canonicalNorm || aliases.some(a => normalizeDrugName(a) === normalized)) {
      if (interactionIndex.has(canonicalNorm)) return canonicalNorm;
    }
  }
  for (const dbDrug of interactionIndex.keys()) {
    if (dbDrug.includes(normalized) || normalized.includes(dbDrug)) return dbDrug;
  }
  return null;
}

// ── Main Checker ──────────────────────────────────────────────────────────────

export function checkDrugInteractions(drugs: string[]): DDICheckResult {
  loadDDIDatabase();

  const result: DDICheckResult = { interactions: [], hasBlocking: false, stats: { major: 0, moderate: 0, total: 0 } };
  if (!interactionIndex || drugs.length < 2) return result;

  const matchedDrugs: { original: string; matched: string }[] = [];
  for (const drug of drugs) {
    const matched = findDrugMatch(drug);
    if (matched) matchedDrugs.push({ original: drug, matched });
  }

  const checkedPairs = new Set<string>();

  for (let i = 0; i < matchedDrugs.length; i++) {
    for (let j = i + 1; j < matchedDrugs.length; j++) {
      const drugA = matchedDrugs[i];
      const drugB = matchedDrugs[j];
      const pairKey = [drugA.matched, drugB.matched].sort().join('|');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      const severityCode = interactionIndex.get(drugA.matched)?.get(drugB.matched);
      if (severityCode !== undefined) {
        const severity = SEVERITY_CODE_TO_NAME[severityCode] ?? 'moderate';
        result.interactions.push({
          drug_a: drugA.original,
          drug_b: drugB.original,
          severity,
          description: SEVERITY_DESCRIPTIONS[severity],
          recommendation: SEVERITY_RECOMMENDATIONS[severity],
          source: 'DDInter 2.0',
        });
        if (severity === 'major' || severity === 'contraindicated') { result.stats.major++; result.hasBlocking = true; }
        else if (severity === 'moderate') result.stats.moderate++;
        result.stats.total++;
      }
    }
  }

  const severityOrder: Record<DDISeverity, number> = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
  result.interactions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return result;
}

export function hasBlockingInteractions(drugs: string[]): boolean {
  return checkDrugInteractions(drugs).hasBlocking;
}

export function getSeverityLabel(severity: DDISeverity): string {
  const labels: Record<DDISeverity, string> = { contraindicated: 'KONTRAINDIKASI', major: 'MAYOR', moderate: 'MODERAT', minor: 'MINOR' };
  return labels[severity] ?? severity.toUpperCase();
}

export function getSeverityColor(severity: DDISeverity): string {
  const colors: Record<DDISeverity, string> = { contraindicated: '#DC2626', major: '#EA580C', moderate: '#CA8A04', minor: '#16A34A' };
  return colors[severity] ?? '#6B7280';
}
