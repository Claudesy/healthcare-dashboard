// ============================================================
// PKM Dashboard — Telemedicine Types
// ============================================================

import type {
  TelemedicineAppointment,
  TelemedicineSession,
  AppointmentStatus,
  ConsultationType,
  SessionParticipantRole,
} from "@prisma/client";

// ─── RE-EXPORTS ───────────────────────────────────────────────
export type { AppointmentStatus, ConsultationType, SessionParticipantRole };

// ─── API RESPONSE WRAPPER ─────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  timestamp: string;
}

// ─── APPOINTMENT ──────────────────────────────────────────────
export interface CreateAppointmentInput {
  patientId: string;
  patientPhone?: string; // No HP pasien untuk WhatsApp
  doctorId: string;
  scheduledAt: string; // ISO 8601
  durationMinutes?: number;
  consultationType?: ConsultationType;
  keluhanUtama?: string;
  riwayatPenyakit?: string;
  bpjsNomorSEP?: string;
}

export interface AppointmentWithDetails extends TelemedicineAppointment {
  session: TelemedicineSession | null;
}

// ─── LIVEKIT TOKEN ────────────────────────────────────────────
export interface LiveKitTokenRequest {
  appointmentId: string;
  participantRole: SessionParticipantRole;
}

export interface LiveKitTokenResponse {
  token: string;
  roomName: string;
  serverUrl: string;
  participantIdentity: string;
  expiresAt: string;
}

// ─── SESSION ──────────────────────────────────────────────────
export interface SessionState {
  isConnected: boolean;
  isConnecting: boolean;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  participantCount: number;
  networkQuality: "excellent" | "good" | "poor" | "unknown";
  elapsedSeconds: number;
}

export interface SessionParticipantInfo {
  identity: string;
  name: string;
  role: SessionParticipantRole;
  isSpeaking: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  networkQuality: number; // 0-5
}

// ─── E-PRESCRIPTION ───────────────────────────────────────────
export interface PrescriptionItem {
  namaObat: string;
  bentukSediaan: string;
  dosis: string;
  aturanMinum: string;
  jumlah: number;
  catatan?: string;
}

export interface EPrescription {
  appointmentId: string;
  nomorResep: string;
  tanggal: string;
  dokterNama: string;
  dokterSIP: string;
  pasienNama: string;
  pasienTanggalLahir: string;
  obatList: PrescriptionItem[];
  diagnosa: string;
  paraf?: string;
}

// ─── BOOKING SLOT ─────────────────────────────────────────────
export interface DoctorScheduleSlot {
  doctorId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  isAvailable: boolean;
  appointmentId?: string;
}

// ─── SATUSEHAT INTEGRATION ────────────────────────────────────
export interface SatuSehatEncounterPayload {
  resourceType: "Encounter";
  identifier: Array<{ system: string; value: string }>;
  status: "in-progress" | "finished" | "cancelled";
  class: { system: string; code: string; display: string };
  type: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  subject: { reference: string };
  participant: Array<{ individual: { reference: string } }>;
  period: { start: string; end?: string };
  serviceProvider: { reference: string };
}
