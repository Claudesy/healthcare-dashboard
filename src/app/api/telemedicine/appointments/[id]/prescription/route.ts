import { NextResponse } from "next/server";
import { z } from "zod";

import { getCrewSessionFromRequest } from "@/lib/server/crew-access-auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/telemedicine/audit";

import type { ApiResponse } from "@/types/telemedicine.types";

const PrescriptionItemSchema = z.object({
  namaObat: z.string().min(1),
  bentukSediaan: z.string().min(1),
  dosis: z.string().min(1),
  aturanMinum: z.string().min(1),
  jumlah: z.number().int().min(1),
  catatan: z.string().optional(),
});

const PrescriptionSchema = z.object({
  obatList: z.array(PrescriptionItemSchema).min(1, "Minimal satu obat"),
  paraf: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = getCrewSessionFromRequest(request);
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, message: "Unauthorized", timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  if (session.role !== "DOKTER") {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, message: "Hanya dokter yang dapat membuat resep", timestamp: new Date().toISOString() },
      { status: 403 }
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = PrescriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, message: parsed.error.issues.map((e) => e.message).join(", "), timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  const existing = await prisma.telemedicineAppointment.findUnique({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, message: "Appointment tidak ditemukan", timestamp: new Date().toISOString() },
      { status: 404 }
    );
  }

  const updated = await prisma.telemedicineAppointment.update({
    where: { id },
    data: { resepDigital: parsed.data.obatList },
  });

  await createAuditLog({
    appointmentId: id,
    userId: session.username,
    action: AUDIT_ACTIONS.PRESCRIPTION_CREATED,
    metadata: { jumlahObat: parsed.data.obatList.length },
  });

  return NextResponse.json<ApiResponse<typeof updated>>(
    {
      success: true,
      data: updated,
      message: "Resep digital berhasil disimpan",
      timestamp: new Date().toISOString(),
    },
    { status: 201 }
  );
}
