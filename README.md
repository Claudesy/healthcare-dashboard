# Puskesmas Dashboard (Crew Portal)

Dashboard internal untuk operasional Puskesmas, dibangun dengan Next.js + TypeScript.

## Stack

- Next.js (App Router)
- TypeScript
- React
- Socket.IO (real-time)
- Tooling internal untuk otomasi LB1

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Scripts

- `npm run dev` - jalankan custom server (`tsx server.ts`)
- `npm run dev:next` - jalankan Next.js dev mode biasa
- `npm run build` - build production
- `npm run start` - start production via custom server

## Crew Access

Portal ini memiliki layer akses awal melalui `CrewAccessGate`.

Lokasi file:

- `src/components/CrewAccessGate.tsx`
- `src/lib/crew-access.ts`

Mekanisme:

- Login memakai pasangan `name/password` yang didefinisikan di code.
- Session disimpan pada `sessionStorage`.

## LB1 Automation API

Endpoint utama:

- `GET /api/report/automation/status`
- `POST /api/report/automation/run`
- `GET /api/report/automation/history?limit=30`

Contoh payload mode penuh:

```json
{
  "mode": "full-cycle",
  "year": 2026,
  "month": 2
}
```

Contoh payload mode pipeline:

```json
{
  "mode": "pipeline",
  "year": 2026,
  "month": 2,
  "exportFile": "C:/path/to/export.xlsx"
}
```

## Dokumen Terkait

- [AGENTS.md](./AGENTS.md)
- [SERVER_GUIDE.md](./SERVER_GUIDE.md)
- [Root Architecture](../ARCHITECTURE.md)
