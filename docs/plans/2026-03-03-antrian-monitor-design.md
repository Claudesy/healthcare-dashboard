# Antrian Monitor — Design Doc

**Tanggal:** 2026-03-03
**Status:** Design selesai, siap implementasi

---

## Context

Dashboard internal Puskesmas Balowerti membutuhkan monitoring antrian poli dewasa
hari ini. Chief perlu tahu berapa pasien menunggu dan sudah dilayani tanpa harus
buka ePuskesmas manual.

## Decision

- **Scope:** Monitoring saja (rekap angka), bukan real-time call system
- **Trigger:** On-demand — Chief klik "UPDATE ANTRIAN"
- **Source:** Playwright scrape ePuskesmas (reuse rme-session.json)
- **Target:** Poli Dewasa, data hari ini

## Approach

POST `/api/antrian/refresh` → Playwright scrape halaman antrian ePuskesmas
→ return JSON → tampil di dashboard widget.

Reuse `runtime/rme-session.json` — tidak perlu login ulang jika session masih valid.
URL dan selector halaman antrian di-inspect saat implementasi (belum diketahui).

## Components

| File | Keterangan |
|------|------------|
| `src/app/api/antrian/refresh/route.ts` | POST endpoint trigger scrape |
| `src/lib/antrian/scraper.ts` | Playwright scrape logic |
| Widget di dashboard | Card: Menunggu / Dilayani / Total + timestamp |

## Data Output

```json
{
  "menunggu": 12,
  "dilayani": 28,
  "total": 40,
  "updatedAt": "2026-03-03T12:34:00.000Z"
}
```

## Edge Cases

- Session expired → fallback login otomatis
- Halaman tidak ditemukan → error "Data tidak tersedia"
- Scrape gagal → pertahankan data terakhir + tampilkan waktu update lama

## Next Steps

1. Inspect halaman antrian ePuskesmas — temukan URL dan selector
2. Implementasi `scraper.ts`
3. Implementasi API route
4. Tambah widget di dashboard
