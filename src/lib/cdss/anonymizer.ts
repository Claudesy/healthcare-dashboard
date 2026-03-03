/**
 * Iskandar Diagnosis Engine V1 — PII Anonymizer
 * Adapted for Next.js (no browser/Chrome Extension deps)
 */

import type { AnonymizedClinicalContext, VitalSigns } from './types';

const PII_PATTERNS = {
  NIK: /\b\d{16}\b/g,
  PHONE_08: /\b08\d{8,11}\b/g,
  PHONE_62: /\+?62\d{9,12}\b/g,
  PHONE_GENERAL: /\b(?:\+62|62|0)[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
  HONORIFIC_NAME: /\b(?:Tn\.|Ny\.|Nn\.|An\.|dr\.|Dr\.|Bpk\.|Ibu)\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/gi,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ADDRESS_JL: /\b(?:Jl\.|Jalan)\s+[A-Za-z0-9\s]+(?:No\.?\s*\d+)?/gi,
  ADDRESS_RT_RW: /\bRT\s*\.?\s*\d+\s*\/?\s*RW\s*\.?\s*\d+/gi,
  ADDRESS_KEL: /\b(?:Kel\.|Kelurahan|Desa)\s+[A-Za-z]+/gi,
  ADDRESS_KEC: /\b(?:Kec\.|Kecamatan)\s+[A-Za-z]+/gi,
  BPJS: /\b\d{13}\b/g,
  RM_NUMBER: /\b(?:RM|No\.?\s*RM)\s*:?\s*[A-Z0-9-]+\b/gi,
};

export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  result = result.replace(PII_PATTERNS.NIK, '[NIK_DIHAPUS]');
  result = result.replace(PII_PATTERNS.PHONE_62, '[TELEPON_DIHAPUS]');
  result = result.replace(PII_PATTERNS.PHONE_08, '[TELEPON_DIHAPUS]');
  result = result.replace(PII_PATTERNS.PHONE_GENERAL, '[TELEPON_DIHAPUS]');
  result = result.replace(PII_PATTERNS.EMAIL, '[EMAIL_DIHAPUS]');
  result = result.replace(PII_PATTERNS.HONORIFIC_NAME, '[NAMA_DIHAPUS]');
  result = result.replace(PII_PATTERNS.ADDRESS_JL, '[ALAMAT_DIHAPUS]');
  result = result.replace(PII_PATTERNS.ADDRESS_RT_RW, '[ALAMAT_DIHAPUS]');
  result = result.replace(PII_PATTERNS.ADDRESS_KEL, '[ALAMAT_DIHAPUS]');
  result = result.replace(PII_PATTERNS.ADDRESS_KEC, '[ALAMAT_DIHAPUS]');
  result = result.replace(PII_PATTERNS.BPJS, '[BPJS_DIHAPUS]');
  result = result.replace(PII_PATTERNS.RM_NUMBER, '[RM_DIHAPUS]');
  return result;
}

export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(text)) { pattern.lastIndex = 0; return true; }
    pattern.lastIndex = 0;
  }
  return false;
}

export function anonymize(input: {
  keluhanUtama: string;
  keluhanTambahan?: string;
  usia?: number;
  jenisKelamin?: 'L' | 'P';
  vitals?: VitalSigns;
  chronicDiseases?: string[];
  allergies?: string[];
  isPregnant?: boolean;
}): AnonymizedClinicalContext {
  return {
    keluhan_utama: redactPII(input.keluhanUtama),
    keluhan_tambahan: input.keluhanTambahan ? redactPII(input.keluhanTambahan) : undefined,
    usia_tahun: input.usia ?? 30,
    jenis_kelamin: input.jenisKelamin ?? 'L',
    vital_signs: input.vitals,
    chronic_diseases: input.chronicDiseases?.map(d => redactPII(d)).filter(Boolean),
    allergies: input.allergies?.map(a => redactPII(a)).filter(Boolean),
    is_pregnant: input.isPregnant ?? false,
  };
}

export function validateAnonymization(context: AnonymizedClinicalContext): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (containsPII(context.keluhan_utama)) violations.push('PII in keluhan_utama');
  if (context.keluhan_tambahan && containsPII(context.keluhan_tambahan)) violations.push('PII in keluhan_tambahan');
  return { valid: violations.length === 0, violations };
}
