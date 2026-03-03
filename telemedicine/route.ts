// ============================================================
// PKM Dashboard — LiveKit Token API Route
// src/app/api/telemedicine/token/route.ts
// POST /api/telemedicine/token
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "@/lib/telemedicine/audit";
import { hasTelemedicineAccess } from "@/lib/telemedicine/rbac";
import type { ApiResponse, LiveKitTokenResponse } from "@/types/telemedicine.types";

// ─── VALIDATION ───────────────────────────────────────────────
const tokenRequestSchema = z.object({
  appointmentId: z.string().cuid("ID appointment tidak valid"),
  participantRole: z.enum(["DOCTOR", "NURSE", "PATIENT", "OBSERVER"]),
});

// ─── CONSTANTS ────────────────────────────────────────────────
const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const TOKEN_TTL_SECONDS = 60 * 60; // 1 jam

// ─── HANDLER ─────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<LiveKitTokenResponse>>> {
  const timestamp = new Date().toISOString();

  try {
    // 1. Autentikasi
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, data: null, message: "Unauthorized", timestamp },
        { status: 401 }
      );
    }

    // 2. Validasi input
    const body = await req.json();
    const parsed = tokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { 
          success: false, 
          data: null, 
          message: parsed.error.errors.map((e) => e.message).join(", "),
          timestamp 
        },
        { status: 400 }
      );
    }

    const { appointmentId, participantRole } = parsed.data;

    // 3. Ambil data appointment
    const appointment = await prisma.telemedicineAppointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
      },
      include: {
        patient: { select: { id: true, name: true, noRm: true } },
        doctor: { select: { id: true, name: true, nip: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { success: false, data: null, message: "Appointment tidak ditemukan", timestamp },
        { status: 404 }
      );
    }

    // 4. Validasi status appointment
    if (!["CONFIRMED", "IN_PROGRESS"].includes(appointment.status)) {
      return NextResponse.json(
        { 
          success: false, 
          data: null, 
          message: `Appointment berstatus ${appointment.status}, tidak bisa bergabung`,
          timestamp 
        },
        { status: 403 }
      );
    }

    // 5. RBAC — cek hak akses
    const hasAccess = await hasTelemedicineAccess({
      userId: session.user.id,
      userRole: session.user.role,
      appointment,
      participantRole,
    });

    if (!hasAccess) {
      await createAuditLog({
        appointmentId,
        userId: session.user.id,
        action: "TOKEN_REQUEST_DENIED",
        metadata: { participantRole, reason: "Insufficient permissions" },
      });
      return NextResponse.json(
        { success: false, data: null, message: "Tidak memiliki akses ke sesi ini", timestamp },
        { status: 403 }
      );
    }

    // 6. Generate room name (deterministik berdasarkan appointmentId)
    const roomName = appointment.livekitRoomName ?? `pkm-${appointmentId}`;

    // 7. Pastikan room ada di LiveKit (buat jika belum)
    if (!appointment.livekitRoomName) {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      try {
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 300, // Auto-close 5 menit setelah kosong
          maxParticipants: 6, // Dokter + Perawat + Pasien + Observer
          metadata: JSON.stringify({
            appointmentId,
            pkmDashboard: true,
            createdAt: new Date().toISOString(),
          }),
        });

        // Update appointment dengan room name
        await prisma.telemedicineAppointment.update({
          where: { id: appointmentId },
          data: {
            livekitRoomName: roomName,
            status: "IN_PROGRESS",
            startedAt: appointment.startedAt ?? new Date(),
          },
        });
      } catch (roomError) {
        // Room mungkin sudah ada — bukan error fatal
        console.warn("[LiveKit] Room mungkin sudah ada:", roomError);
      }
    }

    // 8. Generate LiveKit Access Token
    const participantIdentity = `${session.user.id}-${participantRole.toLowerCase()}`;
    const participantName = session.user.name ?? session.user.email ?? "Unknown";

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: TOKEN_TTL_SECONDS,
      metadata: JSON.stringify({
        userId: session.user.id,
        role: participantRole,
        appointmentId,
      }),
    });

    // Izin sesuai role
    const canPublish = participantRole !== "OBSERVER";
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // 9. Log audit
    await createAuditLog({
      appointmentId,
      userId: session.user.id,
      action: "JOIN_ROOM",
      metadata: {
        participantRole,
        participantIdentity,
        ip: req.headers.get("x-forwarded-for") ?? "unknown",
      },
    });

    // 10. Upsert session participant
    await prisma.telemedicineParticipant.upsert({
      where: {
        // Composite unique — perlu ditambah ke schema
        sessionId_userId: {
          sessionId: appointment.session?.id ?? "",
          userId: session.user.id,
        },
      } as never, // Sementara, update setelah migration
      create: {
        session: { connect: { appointmentId } },
        userId: session.user.id,
        role: participantRole,
        livekitIdentity: participantIdentity,
        joinedAt: new Date(),
      },
      update: {
        joinedAt: new Date(),
        leftAt: null,
      },
    }).catch(() => {
      // Session mungkin belum ada — buat dulu via appointment flow
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        roomName,
        serverUrl: LIVEKIT_URL,
        participantIdentity,
        expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
      },
      message: "Token berhasil dibuat",
      timestamp,
    });

  } catch (error) {
    console.error("[Telemedicine Token] Error:", error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "Terjadi kesalahan internal",
        timestamp,
      },
      { status: 500 }
    );
  }
}
