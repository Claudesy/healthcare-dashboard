/**
 * Iskandar Diagnosis Engine V1 — Traffic Light Safety Gate
 * 8 deterministic rules, escalation-only.
 */

import type { MatchedCandidate } from './symptom-matcher';
import type { RedFlag } from './red-flags';

export type TrafficLightLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface TrafficLightInput {
  candidates: MatchedCandidate[];
  redFlags: RedFlag[];
  patientAge?: number;
  patientGender?: 'L' | 'P';
  ddiSeverityMax?: 'minor' | 'moderate' | 'major' | 'contraindicated';
  chronicDiseases?: string[];
  confidence: number;
}

export interface TrafficLightOutput {
  level: TrafficLightLevel;
  reason: string;
  gateResults: Array<{ rule: string; triggered: boolean; detail: string }>;
  overrideApplied: boolean;
}

const LEVEL_ORDER: Record<TrafficLightLevel, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

function escalate(current: TrafficLightLevel, target: TrafficLightLevel): TrafficLightLevel {
  return LEVEL_ORDER[target] > LEVEL_ORDER[current] ? target : current;
}

export function classifyTrafficLight(input: TrafficLightInput): TrafficLightOutput {
  let level: TrafficLightLevel = 'GREEN';
  const reasons: string[] = [];
  const gateResults: Array<{ rule: string; triggered: boolean; detail: string }> = [];
  let overrideApplied = false;

  const top = input.candidates[0];

  // Rule 1: KB Red Flags
  const hasKBRedFlags = top?.redFlags && top.redFlags.length > 0;
  if (hasKBRedFlags) { level = escalate(level, 'YELLOW'); overrideApplied = true; reasons.push(`Red flags: ${top.redFlags.slice(0, 2).join('; ')}`); }
  gateResults.push({ rule: 'Rule 1: KB Red Flags', triggered: !!hasKBRedFlags, detail: hasKBRedFlags ? `${top.redFlags.length} red flag(s)` : 'No KB red flags' });

  // Rule 2: Rujukan criteria
  const hasRujukan = top?.kriteria_rujukan && top.kriteria_rujukan.trim().length > 0 && top.kompetensi !== '4A';
  if (hasRujukan) { level = escalate(level, 'YELLOW'); overrideApplied = true; reasons.push(`Kompetensi ${top.kompetensi}: ${top.kriteria_rujukan.substring(0, 100)}`); }
  gateResults.push({ rule: 'Rule 2: Rujukan Criteria', triggered: !!hasRujukan, detail: hasRujukan ? `Requires referral (${top.kompetensi})` : 'No referral criteria' });

  // Rule 3: Low confidence
  const isLowConf = input.confidence < 0.3;
  if (isLowConf) { level = escalate(level, 'YELLOW'); overrideApplied = true; reasons.push(`Low confidence: ${(input.confidence * 100).toFixed(0)}%`); }
  gateResults.push({ rule: 'Rule 3: Low Confidence', triggered: isLowConf, detail: `Confidence ${(input.confidence * 100).toFixed(0)}%` });

  // Rule 4: Extreme age + acute
  const isExtremeAge = input.patientAge !== undefined && (input.patientAge < 2 || input.patientAge > 70);
  const hasAcute = input.candidates.some(c => c.redFlags.length > 0 || c.bodySystem === 'SISTEM KARDIOVASKULAR' || c.bodySystem === 'SISTEM SARAF');
  const ageRisk = isExtremeAge && hasAcute;
  if (ageRisk) { level = escalate(level, 'RED'); overrideApplied = true; reasons.push(`Extreme age (${input.patientAge} yr) with acute presentation`); }
  gateResults.push({ rule: 'Rule 4: Extreme Age + Acute', triggered: ageRisk, detail: ageRisk ? `Age ${input.patientAge} + acute` : 'No age escalation' });

  // Rule 5: No KB match
  const noMatch = input.candidates.length === 0;
  if (noMatch) { level = escalate(level, 'YELLOW'); overrideApplied = true; reasons.push('No KB match — unknown presentation'); }
  gateResults.push({ rule: 'Rule 5: No KB Match', triggered: noMatch, detail: noMatch ? 'No match' : `${input.candidates.length} candidates` });

  // Rule 6: DDI
  const ddiCritical = input.ddiSeverityMax === 'major' || input.ddiSeverityMax === 'contraindicated';
  if (ddiCritical) { level = escalate(level, 'RED'); overrideApplied = true; reasons.push(`DDI: ${input.ddiSeverityMax}`); }
  gateResults.push({ rule: 'Rule 6: DDI Severity', triggered: ddiCritical, detail: ddiCritical ? `DDI ${input.ddiSeverityMax}` : 'No critical DDI' });

  // Rule 7: Cardiometabolic cluster
  const ncdIcds = ['I10', 'E11', 'E10', 'I25', 'I50', 'E78'];
  const ncdMatches = input.candidates.filter(c => ncdIcds.some(n => c.icd10.startsWith(n)));
  const hasNcdCluster = ncdMatches.length >= 2;
  if (hasNcdCluster && LEVEL_ORDER[level] < LEVEL_ORDER['YELLOW']) { level = escalate(level, 'YELLOW'); overrideApplied = true; reasons.push(`Cardiometabolic cluster: ${ncdMatches.length} NCD candidates`); }
  gateResults.push({ rule: 'Rule 7: Cardiometabolic Cluster', triggered: hasNcdCluster, detail: hasNcdCluster ? `${ncdMatches.length} NCD candidates` : 'No NCD cluster' });

  // Rule 8: Acute-on-chronic
  const chronicIcds = (input.chronicDiseases ?? []).map(d => d.toUpperCase().trim());
  const acuteOnChronic = chronicIcds.length > 0 && input.candidates.some(c => {
    const prefix = c.icd10.split('.')[0];
    return chronicIcds.some(ch => ch.startsWith(prefix)) && c.redFlags.length > 0;
  });
  if (acuteOnChronic) { level = escalate(level, 'RED'); overrideApplied = true; reasons.push('Acute-on-chronic detected'); }
  gateResults.push({ rule: 'Rule 8: Acute-on-Chronic', triggered: acuteOnChronic, detail: acuteOnChronic ? 'Acute on chronic' : 'No acute-on-chronic' });

  // Existing red flags
  if (input.redFlags.length > 0) {
    const hasEmergency = input.redFlags.some(r => r.severity === 'emergency');
    const hasUrgent = input.redFlags.some(r => r.severity === 'urgent');
    if (hasEmergency) { level = escalate(level, 'RED'); overrideApplied = true; reasons.push(`Emergency: ${input.redFlags.filter(r => r.severity === 'emergency').map(r => r.condition).join('; ')}`); }
    else if (hasUrgent) { level = escalate(level, 'RED'); overrideApplied = true; reasons.push(`Urgent: ${input.redFlags.filter(r => r.severity === 'urgent').map(r => r.condition).join('; ')}`); }
  }

  return {
    level,
    reason: reasons.length > 0 ? reasons.join(' | ') : 'No safety concerns detected',
    gateResults,
    overrideApplied,
  };
}
