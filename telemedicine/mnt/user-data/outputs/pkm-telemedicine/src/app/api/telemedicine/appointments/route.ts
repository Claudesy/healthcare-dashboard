// ============================================================
// PKM Dashboard — Telemedicine Appointments API
// src/app/api/telemedicine/appointments/route.ts
// GET  /api/telemedicine/appointments  — Daftar appointment
// POST /api/telemedicine/appointments  — Buat appointment baru
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "@/lib/telemedicine/audit";
import { sendWhatsAppNotification } from "@/lib/telemedicine/notifications";
import { generateNomorResep } from "@/lib/telemedicine/utils";
import type { ApiResponse, AppointmentWithDetails, CreateAppointmentInput } from "@/types/telemedicine.types";

// ─── VALIDATION SCHEMAS ───────────────────────────────────────
const createAppointmentSchema = z.object({
  patientId: z.string().cuid("ID pasien tidak valid"),
  doctorId: z.string().cuid("ID dokter tidak valid"),
  scheduledAt: z.string().datetime("Format tanggal tidak valid (gunakan ISO 8601)"),
  durationMinutes: z.number().int().min(5).max(60).default(15),
  consultationType: z.enum(["VIDEO", "AUDIO", "CHAT"]).default("VIDEO"),
  keluhanUtama: z.string().min(3).max(1000).optional(),
  riwayatPenyakit: z.string().max(2000).optional(),
  bpjsNomorSEP: z.string().max(30).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  doctorId: z.string().cuid().optional(),
  patientId: z.string().cuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ─── GET — LIST APPOINTMENTS ──────────────────────────────────
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ appointments: AppointmentWithDetails[]; total: number; page: number; totalPages: number }>>> {
  const timestamp = new Date().toISOString();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, data: null, message: "Unauthorized", timestamp }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!params.success) {
      return NextResponse.json({ success: false, data: null, message: params.error.message, timestamp }, { status: 400 });
    }

    const { page, limit, status, doctorId, patientId, dateFrom, dateTo } = params.data;

    // RBAC: Pasien hanya lihat appointment sendiri
    const effectivePatientId =
      session.user.role === "PASIEN" ? session.user.id : patientId;
    const effectiveDoctorId =
      session.user.role === "DOKTER" ? session.user.id : doctorId;

    const where = {
      deletedAt: null,
      ...(effectivePatientId && { patientId: effectivePatientId }),
      ...(effectiveDoctorId && { doctorId: effectiveDoctorId }),
      ...(status && { status }),
      ...(dateFrom || dateTo
        ? {
            scheduledAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [appointments, total] = await Promise.all([
      prisma.telemedicineAppointment.findMany({
        where,
        include: {
          patient: {
            select: { id: true, name: true, noRm: true, tanggalLahir: true, noBpjs: true },
          },
          doctor: {
            select: { id: true, name: true, nip: true, spesialisasi: true },
          },
          session: true,
        },
        orderBy: { scheduledAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.telemedicineAppointment.count({ where }),
    ]);

    // Redact NIK — jangan pernah kirim ke frontend tanpa enkripsi
    const safeAppointments = appointments.map((apt) => ({
      ...apt,
      patient: {
        ...apt.patient,
        // NIK tidak dimasukkan ke response API
      },
    })) as AppointmentWithDetails[];

    return NextResponse.json({
      success: true,
      data: {
        appointments: safeAppointments,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
      message: "Data berhasil diambil",
      timestamp,
    });
  } catch (error) {
    console.error("[Appointments GET]", error);
    return NextResponse.json({ success: false, data: null, message: "Kesalahan internal", timestamp }, { status: 500 });
  }
}

// ─── POST — CREATE APPOINTMENT ────────────────────────────────
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<AppointmentWithDetails>>> {
  const timestamp = new Date().toISOString();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, data: null, message: "Unauthorized", timestamp }, { status: 401 });
    }

    // Hanya ADMIN, DOKTER, PERAWAT, KEPALA yang bisa buat appointment
    const allowedRoles = ["ADMIN", "DOKTER", "PERAWAT", "KEPALA_PUSKESMAS"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ success: false, data: null, message: "Tidak memiliki izin", timestamp }, { status: 403 });
    }

    const body: CreateAppointmentInput = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        data: null,
        message: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
        timestamp,
      }, { status: 400 });
    }

    const input = parsed.data;
    const scheduledAt = new Date(input.scheduledAt);

    // Validasi: waktu harus di masa depan
    if (scheduledAt <= new Date()) {
      return NextResponse.json({ success: false, data: null, message: "Waktu appointment harus di masa depan", timestamp }, { status: 400 });
    }

    // Cek konflik jadwal dokter
    const endTime = new Date(scheduledAt.getTime() + input.durationMinutes * 60 * 1000);
    const conflict = await prisma.telemedicineAppointment.findFirst({
      where: {
        doctorId: input.doctorId,
        deletedAt: null,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: { lt: endTime },
        AND: [
          {
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - input.durationMinutes * 60 * 1000),
            },
          },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json({
        success: false,
        data: null,
        message: "Dokter sudah memiliki jadwal di waktu yang sama",
        timestamp,
      }, { status: 409 });
    }

    // Buat appointment
    const appointment = await prisma.telemedicineAppointment.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        createdByStaffId: session.user.id,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        consultationType: input.consultationType,
        keluhanUtama: input.keluhanUtama,
        riwayatPenyakit: input.riwayatPenyakit,
        bpjsNomorSEP: input.bpjsNomorSEP,
        status: "PENDING",
      },
      include: {
        patient: { select: { id: true, name: true, noRm: true, tanggalLahir: true, noBpjs: true } },
        doctor: { select: { id: true, name: true, nip: true, spesialisasi: true } },
        session: true,
      },
    });

    // Buat TelemedicineSession
    await prisma.telemedicineSession.create({
      data: {
        appointmentId: appointment.id,
        roomName: `pkm-${appointment.id}`,
      },
    });

    // Audit log
    await createAuditLog({
      appointmentId: appointment.id,
      userId: session.user.id,
      action: "APPOINTMENT_CREATED",
      metadata: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        scheduledAt: input.scheduledAt,
      },
    });

    // Notifikasi WhatsApp (non-blocking)
    sendWhatsAppNotification({
      appointmentId: appointment.id,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      scheduledAt,
      consultationType: input.consultationType,
    }).catch((err) => console.warn("[WhatsApp Notif]", err));

    return NextResponse.json({
      success: true,
      data: appointment as AppointmentWithDetails,
      message: "Appointment berhasil dibuat",
      timestamp,
    }, { status: 201 });

  } catch (error) {
    console.error("[Appointments POST]", error);
    return NextResponse.json({ success: false, data: null, message: "Kesalahan internal", timestamp }, { status: 500 });
  }
}
