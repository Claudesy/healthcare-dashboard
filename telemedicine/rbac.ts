// ============================================================
// PKM Dashboard — Telemedicine RBAC Helper
// src/lib/telemedicine/rbac.ts
// ============================================================

import type { TelemedicineAppointment } from "@prisma/client";
import type { SessionParticipantRole } from "@/types/telemedicine.types";

interface HasAccessParams {
  userId: string;
  userRole: string;
  appointment: TelemedicineAppointment & {
    patient: { id: string };
    doctor: { id: string };
  };
  participantRole: SessionParticipantRole;
}

/**
 * Validasi apakah user boleh bergabung ke sesi telemedicine.
 *
 * Rules:
 * - DOKTER hanya bisa join sebagai DOCTOR dan harus dokter yang bertugas
 * - PERAWAT bisa join sebagai NURSE
 * - PASIEN hanya bisa join sebagai PATIENT dan harus pasien yang bersangkutan
 * - KEPALA_PUSKESMAS dan ADMIN bisa join sebagai OBSERVER
 */
export async function hasTelemedicineAccess({
  userId,
  userRole,
  appointment,
  participantRole,
}: HasAccessParams): Promise<boolean> {
  switch (userRole) {
    case "DOKTER":
      return (
        participantRole === "DOCTOR" && appointment.doctorId === userId
      );

    case "PERAWAT":
      return participantRole === "NURSE";

    case "PASIEN":
      return (
        participantRole === "PATIENT" && appointment.patientId === userId
      );

    case "KEPALA_PUSKESMAS":
    case "ADMIN":
      return participantRole === "OBSERVER";

    default:
      return false;
  }
}

/**
 * Daftar aksi yang diizinkan per role
 */
export const TELEMEDICINE_PERMISSIONS = {
  DOKTER: [
    "CREATE_APPOINTMENT",
    "JOIN_AS_DOCTOR",
    "WRITE_DIAGNOSIS",
    "CREATE_PRESCRIPTION",
    "REQUEST_REFERRAL",
    "VIEW_PATIENT_RECORD",
  ],
  PERAWAT: [
    "CREATE_APPOINTMENT",
    "JOIN_AS_NURSE",
    "VIEW_APPOINTMENT",
    "UPDATE_VITAL_SIGNS",
  ],
  PASIEN: [
    "VIEW_OWN_APPOINTMENT",
    "JOIN_AS_PATIENT",
    "VIEW_OWN_PRESCRIPTION",
  ],
  KEPALA_PUSKESMAS: [
    "VIEW_ALL_APPOINTMENTS",
    "JOIN_AS_OBSERVER",
    "VIEW_STATISTICS",
    "EXPORT_REPORT",
  ],
  ADMIN: [
    "CREATE_APPOINTMENT",
    "CANCEL_APPOINTMENT",
    "VIEW_ALL_APPOINTMENTS",
    "JOIN_AS_OBSERVER",
    "MANAGE_SCHEDULES",
  ],
} as const;

export type TelemedicinePermission =
  (typeof TELEMEDICINE_PERMISSIONS)[keyof typeof TELEMEDICINE_PERMISSIONS][number];

export function canPerform(
  userRole: string,
  permission: TelemedicinePermission
): boolean {
  const allowed =
    TELEMEDICINE_PERMISSIONS[userRole as keyof typeof TELEMEDICINE_PERMISSIONS] ?? [];
  return (allowed as readonly string[]).includes(permission);
}
