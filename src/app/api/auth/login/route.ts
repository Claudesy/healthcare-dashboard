import { NextResponse } from "next/server";
import {
  createCrewSession,
  getCrewAccessConfigStatus,
  getSessionCookieOptions,
  validateCrewAccess,
} from "@/lib/server/crew-access-auth";

export const runtime = "nodejs";

interface LoginPayload {
  username: string;
  password: string;
}

function parseLoginPayload(raw: unknown): LoginPayload {
  if (!raw || typeof raw !== "object") throw new Error("Payload login tidak valid.");
  const body = raw as Record<string, unknown>;
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) throw new Error("Username dan password wajib diisi.");
  return { username, password };
}

export async function POST(request: Request) {
  const config = getCrewAccessConfigStatus();
  if (!config.ok) {
    return NextResponse.json(
      { ok: false, error: config.message },
      { status: 500 },
    );
  }

  try {
    const payload = parseLoginPayload(await request.json());
    const user = validateCrewAccess(payload.username, payload.password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Username atau password salah." },
        { status: 401 },
      );
    }

    const { token, session } = createCrewSession(user);
    const response = NextResponse.json({
      ok: true,
      user: {
        username: session.username,
        displayName: session.displayName,
      },
      expiresAt: session.expiresAt,
    });
    response.cookies.set({
      ...getSessionCookieOptions(),
      value: token,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gagal login." },
      { status: 400 },
    );
  }
}
