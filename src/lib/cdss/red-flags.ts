/**
 * Iskandar Diagnosis Engine V1 — Red Flag Safety Rules
 * Hardcoded deterministic rules, NO API dependency.
 * Sources: qSOFA (JAMA 2016), AHA/ACC 2021, ACOG 222
 */

import type { VitalSigns, AnonymizedClinicalContext } from './types';

export interface RedFlag {
  id: string;
  severity: 'emergency' | 'urgent' | 'warning';
  condition: string;
  action: string;
  icd_codes: string[];
  criteria_met: string[];
  source?: string;
}

export interface RedFlagContext {
  keluhan: string;
  vitals?: VitalSigns;
  age?: number;
  gender?: 'L' | 'P';
  pregnant?: boolean;
  chronic_diseases?: string[];
  allergies?: string[];
}

export function checkSepsis(vitals: VitalSigns | undefined): RedFlag | null {
  if (!vitals) return null;
  let score = 0;
  const criteria: string[] = [];
  if (vitals.respiratory_rate && vitals.respiratory_rate >= 22) { score++; criteria.push(`RR ${vitals.respiratory_rate} x/menit (>=22)`); }
  if (vitals.systolic && vitals.systolic <= 100) { score++; criteria.push(`Sistolik ${vitals.systolic} mmHg (<=100)`); }
  if (vitals.gcs && vitals.gcs < 15) { score++; criteria.push(`GCS ${vitals.gcs} (<15)`); }
  if (score >= 2) {
    return { id: 'RF-SEPSIS', severity: 'emergency', condition: `SUSPEK SEPSIS - qSOFA Score ${score}/3`, action: 'RUJUK SEGERA ke IGD RS. Pasang IV line, ambil kultur darah, berikan antibiotik empiris.', icd_codes: ['A41.9', 'R65.20'], criteria_met: criteria, source: 'qSOFA (JAMA 2016)' };
  }
  return null;
}

const ACS_KEYWORDS = ['nyeri dada', 'dada terasa berat', 'dada seperti ditekan', 'dada seperti ditindih', 'menjalar ke lengan', 'menjalar ke rahang', 'menjalar ke punggung', 'keringat dingin', 'sesak napas', 'dada seperti terbakar'];

export function checkACS(keluhan: string, vitals: VitalSigns | undefined): RedFlag | null {
  const keluhanLower = keluhan.toLowerCase();
  const criteria: string[] = [];
  const hasChestPain = ACS_KEYWORDS.some(k => { if (keluhanLower.includes(k)) { criteria.push(`Keluhan: "${k}"`); return true; } return false; });
  if (!hasChestPain) return null;
  let vitalConcern = false;
  if (vitals) {
    if (vitals.heart_rate && vitals.heart_rate > 100) { criteria.push(`Takikardia (HR ${vitals.heart_rate} bpm)`); vitalConcern = true; }
    if (vitals.systolic && vitals.systolic > 160) { criteria.push(`Hipertensi (TD ${vitals.systolic} mmHg)`); vitalConcern = true; }
    if (vitals.spo2 && vitals.spo2 < 94) { criteria.push(`Hipoksia (SpO2 ${vitals.spo2}%)`); vitalConcern = true; }
  }
  if (vitalConcern || criteria.length >= 2) {
    return { id: 'RF-ACS', severity: 'emergency', condition: 'SUSPEK SINDROM KORONER AKUT (ACS)', action: 'EKG 12-lead SEGERA. Aspirin 320mg kunyah. Oksigen jika SpO2 <94%. RUJUK RS.', icd_codes: ['I21.9', 'I20.0', 'I20.9'], criteria_met: criteria, source: 'AHA/ACC Guidelines 2021' };
  }
  return null;
}

const PREECLAMPSIA_SYMPTOMS = ['sakit kepala hebat', 'sakit kepala berat', 'pandangan kabur', 'penglihatan kabur', 'nyeri ulu hati', 'nyeri epigastrium', 'mual muntah hebat', 'bengkak wajah', 'bengkak tangan', 'edema'];

export function checkPreeclampsia(keluhan: string, vitals: VitalSigns | undefined, isPregnant: boolean): RedFlag | null {
  if (!isPregnant) return null;
  const keluhanLower = keluhan.toLowerCase();
  const criteria: string[] = ['Status: Hamil'];
  let hasHTN = false;
  if (vitals) {
    if (vitals.systolic && vitals.systolic >= 140) { criteria.push(`Hipertensi sistolik (${vitals.systolic} mmHg)`); hasHTN = true; }
    if (vitals.diastolic && vitals.diastolic >= 90) { criteria.push(`Hipertensi diastolik (${vitals.diastolic} mmHg)`); hasHTN = true; }
  }
  const symptoms = PREECLAMPSIA_SYMPTOMS.filter(s => keluhanLower.includes(s));
  if (symptoms.length > 0) symptoms.forEach(s => criteria.push(`Gejala: ${s}`));
  if (hasHTN && symptoms.length > 0) {
    return { id: 'RF-PREEC', severity: 'emergency', condition: 'SUSPEK PREEKLAMPSIA', action: 'Pasang IV line. Cek proteinuria. Berikan MgSO4 loading dose jika tersedia. RUJUK SEGERA.', icd_codes: ['O14.9', 'O14.1', 'O15.0'], criteria_met: criteria, source: 'ACOG Practice Bulletin No. 222' };
  }
  if (vitals && ((vitals.systolic && vitals.systolic >= 160) || (vitals.diastolic && vitals.diastolic >= 110))) {
    criteria.push('Hipertensi berat dalam kehamilan');
    return { id: 'RF-PREEC-HTN', severity: 'emergency', condition: 'HIPERTENSI BERAT DALAM KEHAMILAN', action: 'Berikan antihipertensi (Nifedipine 10mg oral). Monitor ketat. RUJUK SEGERA.', icd_codes: ['O14.1', 'O13'], criteria_met: criteria, source: 'ACOG Practice Bulletin No. 222' };
  }
  return null;
}

const STROKE_KEYWORDS = {
  face: ['wajah merot', 'mulut mencong', 'senyum tidak simetris', 'wajah tidak simetris'],
  arm: ['lengan lemah', 'tangan lemah', 'tidak bisa angkat tangan', 'kelemahan satu sisi'],
  speech: ['bicara pelo', 'bicara tidak jelas', 'sulit bicara', 'cadel mendadak'],
  time: ['mendadak', 'tiba-tiba', 'secara tiba-tiba'],
};

export function checkStroke(keluhan: string): RedFlag | null {
  const keluhanLower = keluhan.toLowerCase();
  const criteria: string[] = [];
  let fastScore = 0;
  for (const [component, keywords] of Object.entries(STROKE_KEYWORDS)) {
    const matched = keywords.filter(k => keluhanLower.includes(k));
    if (matched.length > 0) { fastScore++; criteria.push(`${component.toUpperCase()}: ${matched.join(', ')}`); }
  }
  if (fastScore >= 2) {
    return { id: 'RF-STROKE', severity: 'emergency', condition: 'SUSPEK STROKE AKUT', action: 'Catat waktu onset gejala. JANGAN berikan makan/minum. RUJUK SEGERA ke RS Stroke Center.', icd_codes: ['I63.9', 'I64', 'I61.9'], criteria_met: criteria, source: 'AHA/ASA Stroke Guidelines' };
  }
  return null;
}

const HYPOGLYCEMIA_KEYWORDS = ['keringat dingin', 'gemetar', 'lemas mendadak', 'pusing', 'bingung', 'tidak sadar', 'kejang'];

export function checkHypoglycemia(keluhan: string, chronicDiseases: string[] | undefined): RedFlag | null {
  const isDiabetic = chronicDiseases?.some(d => d.toLowerCase().includes('diabetes') || d.toLowerCase().includes('dm'));
  if (!isDiabetic) return null;
  const keluhanLower = keluhan.toLowerCase();
  const criteria: string[] = ['Riwayat: Diabetes'];
  const matched = HYPOGLYCEMIA_KEYWORDS.filter(k => keluhanLower.includes(k));
  if (matched.length >= 2) {
    matched.forEach(s => criteria.push(`Gejala: ${s}`));
    return { id: 'RF-HYPOGLYCEMIA', severity: 'emergency', condition: 'SUSPEK HIPOGLIKEMIA BERAT', action: 'Cek GDS SEGERA. Jika GDS <70 mg/dL: berikan D40% 25mL IV atau glukosa oral jika sadar.', icd_codes: ['E16.2', 'E11.65'], criteria_met: criteria, source: 'ADA Diabetes Care 2024' };
  }
  return null;
}

const ANAPHYLAXIS_KEYWORDS = ['sesak napas berat', 'tidak bisa bernapas', 'bengkak wajah', 'bengkak bibir', 'bengkak lidah', 'biduran seluruh tubuh', 'gatal seluruh badan', 'mual muntah', 'pusing'];

export function checkAnaphylaxis(keluhan: string, vitals: VitalSigns | undefined, allergies: string[] | undefined): RedFlag | null {
  const keluhanLower = keluhan.toLowerCase();
  const criteria: string[] = [];
  if (allergies && allergies.length > 0) criteria.push(`Riwayat alergi: ${allergies.slice(0, 3).join(', ')}`);
  const matched = ANAPHYLAXIS_KEYWORDS.filter(k => keluhanLower.includes(k));
  if (matched.length >= 2) {
    matched.forEach(s => criteria.push(`Gejala: ${s}`));
    if (vitals) {
      if (vitals.systolic && vitals.systolic < 90) criteria.push(`Hipotensi (TD ${vitals.systolic} mmHg)`);
      if (vitals.heart_rate && vitals.heart_rate > 120) criteria.push(`Takikardia (HR ${vitals.heart_rate} bpm)`);
    }
    return { id: 'RF-ANAPHYLAXIS', severity: 'emergency', condition: 'SUSPEK REAKSI ANAFILAKSIS', action: 'Epinefrin 0.3-0.5mg IM (paha lateral) SEGERA. Posisi trendelenburg. Oksigen. Pasang IV line.', icd_codes: ['T78.2', 'T88.6'], criteria_met: criteria, source: 'EAACI Anaphylaxis Guidelines 2021' };
  }
  return null;
}

export function runRedFlagChecks(context: RedFlagContext): RedFlag[] {
  const flags: RedFlag[] = [];
  const s = checkSepsis(context.vitals);
  if (s) flags.push(s);
  const acs = checkACS(context.keluhan, context.vitals);
  if (acs) flags.push(acs);
  const pe = checkPreeclampsia(context.keluhan, context.vitals, context.pregnant ?? false);
  if (pe) flags.push(pe);
  const st = checkStroke(context.keluhan);
  if (st) flags.push(st);
  const hg = checkHypoglycemia(context.keluhan, context.chronic_diseases);
  if (hg) flags.push(hg);
  const an = checkAnaphylaxis(context.keluhan, context.vitals, context.allergies);
  if (an) flags.push(an);
  const order = { emergency: 0, urgent: 1, warning: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function runRedFlagChecksFromContext(context: AnonymizedClinicalContext): RedFlag[] {
  return runRedFlagChecks({
    keluhan: context.keluhan_utama + ' ' + (context.keluhan_tambahan ?? ''),
    vitals: context.vital_signs,
    age: context.usia_tahun,
    gender: context.jenis_kelamin,
    pregnant: context.is_pregnant,
    chronic_diseases: context.chronic_diseases,
    allergies: context.allergies,
  });
}
