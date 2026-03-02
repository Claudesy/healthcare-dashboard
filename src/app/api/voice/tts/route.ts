import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_TTS_API_KEY belum dikonfigurasi" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text kosong" }, { status: 400 });
  }

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "id-ID",
          name: "id-ID-Wavenet-D",
          ssmlGender: "FEMALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 1.0,
          effectsProfileId: ["headphone-class-device"],
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Google TTS error: ${err}` }, { status: 500 });
  }

  const data = await res.json() as { audioContent?: string };
  if (!data.audioContent) {
    return NextResponse.json({ error: "Tidak ada audio dari Google TTS" }, { status: 500 });
  }

  // Kembalikan sebagai audio/mpeg binary
  const audioBuffer = Buffer.from(data.audioContent, "base64");
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
    },
  });
}
