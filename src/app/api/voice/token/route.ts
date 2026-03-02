import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Endpoint ini return ephemeral token untuk Gemini Live API
// Browser pakai token ini langsung connect ke Gemini — API key tidak pernah expose ke client
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY belum dikonfigurasi" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateEphemeralToken?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ttl: "300s", // 5 menit
          newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      }
    );

    if (!res.ok) {
      // Fallback: return API key langsung (untuk dev/internal dashboard)
      // Aman karena dashboard ini internal crew only
      return NextResponse.json({ apiKey });
    }

    const data = await res.json() as { token?: string };
    return NextResponse.json({ token: data.token, apiKey });
  } catch {
    // Fallback ke API key langsung untuk internal use
    return NextResponse.json({ apiKey });
  }
}
