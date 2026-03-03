/**
 * Iskandar Diagnosis Engine V1 — Shared Types
 * Adapted for Next.js dashboard (no Chrome Extension deps)
 */

export interface VitalSigns {
  systolic?: number;
  diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  spo2?: number;
  gcs?: number;
  glucose?: number;
}

export interface AnonymizedClinicalContext {
  keluhan_utama: string;
  keluhan_tambahan?: string;
  usia_tahun: number;
  jenis_kelamin: 'L' | 'P';
  vital_signs?: VitalSigns;
  lama_sakit?: { hari: number; bulan: number; tahun: number };
  chronic_diseases?: string[];
  allergies?: string[];
  is_pregnant?: boolean;
}

export type AlertSeverity = 'emergency' | 'high' | 'medium' | 'low' | 'info';
export type CDSSAlertType =
  | 'red_flag'
  | 'vital_sign'
  | 'validation_warning'
  | 'low_confidence'
  | 'guideline';

export type DDISeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  drug_a: string;
  drug_b: string;
  severity: DDISeverity;
  description: string;
  recommendation: string;
  source: string;
}

export interface AIDiagnosisSuggestion {
  rank: number;
  diagnosis_name: string;
  icd10_code: string;
  confidence: number;
  reasoning: string;
  red_flags?: string[];
  recommended_actions?: string[];
}
