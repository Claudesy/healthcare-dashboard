/**
 * Iskandar Diagnosis Engine V1 — Epidemiology Weights
 * Bayesian prior from 45,030 real cases. Adapted for Next.js (fs-based loading).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { MatchedCandidate } from './symptom-matcher';

interface EpiWeightEntry {
  weight: number;
  cases_per_month: number;
  prevalence_pct: number;
  total_annual: number;
  nama: string;
  male_pct: number;
  female_pct: number;
}

interface EpiWeightRegistry {
  meta: { source: string; period: string; totalCases: number; totalIcd10: number };
  weights: Record<string, EpiWeightEntry>;
}

let cachedRegistry: EpiWeightRegistry | null = null;

function loadRegistry(): EpiWeightRegistry {
  if (cachedRegistry) return cachedRegistry;
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'epidemiology_weights_v2.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    cachedRegistry = JSON.parse(raw) as EpiWeightRegistry;
  } catch {
    cachedRegistry = {
      meta: { source: 'fallback', period: 'N/A', totalCases: 0, totalIcd10: 0 },
      weights: {},
    };
  }
  return cachedRegistry;
}

const EPI_WEIGHT_CAP = 1.15;

export async function applyEpidemiologyWeights(
  candidates: MatchedCandidate[],
  patientGender?: 'L' | 'P',
): Promise<MatchedCandidate[]> {
  const registry = loadRegistry();

  const weighted = candidates.map(c => {
    const entry = registry.weights[c.icd10] ?? registry.weights[c.icd10.split('.')[0]];
    if (!entry) return c;

    const baseWeight = Math.min(entry.weight, EPI_WEIGHT_CAP);
    let genderAdjusted = baseWeight;

    if (patientGender && entry.cases_per_month >= 20) {
      if (patientGender === 'P' && entry.female_pct > 60) genderAdjusted = Math.min(baseWeight + 0.05, EPI_WEIGHT_CAP);
      else if (patientGender === 'L' && entry.male_pct > 60) genderAdjusted = Math.min(baseWeight + 0.05, EPI_WEIGHT_CAP);
    }

    return { ...c, matchScore: Math.min(1, c.rawMatchScore * genderAdjusted) };
  });

  weighted.sort((a, b) => b.matchScore - a.matchScore);
  return weighted;
}

export async function getEpidemiologyMeta() {
  const registry = loadRegistry();
  return { ...registry.meta };
}

export async function getLocalEpidemiologyContext(topN = 15): Promise<string> {
  const registry = loadRegistry();
  const entries = Object.entries(registry.weights)
    .filter(([, v]) => v.total_annual > 50)
    .sort((a, b) => b[1].total_annual - a[1].total_annual)
    .slice(0, topN);
  if (entries.length === 0) return '';
  const lines = entries.map(([code, v]) =>
    `- ${code} ${v.nama}: ${v.prevalence_pct.toFixed(1)}% (${v.total_annual} kasus/tahun, M:${v.male_pct}% F:${v.female_pct}%)`
  );
  return `EPIDEMIOLOGI LOKAL (Puskesmas Balowerti, Kediri — data 14 bulan):\n${lines.join('\n')}`;
}
