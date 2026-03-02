# Dashboard Server Guide

Panduan menjalankan service `dashboard` secara lokal dan dasar troubleshooting.

## Jalankan Development Server

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

Perintah ini menjalankan `tsx server.ts` (custom server).

## Menjalankan Next.js Tanpa Custom Server

```bash
npm run dev:next
```

Gunakan mode ini saat debugging behavior bawaan Next.js.

## Build dan Start Production

```bash
npm run build
npm run start
```

## Environment

Dashboard memakai `.env.local` untuk konfigurasi.

Contoh variabel yang umum dipakai:

- `PORT`
- `LB1_PROJECT_ROOT`
- `LB1_HISTORY_FILE`
- variabel kredensial internal LB1/RME (jangan commit)

## Health Check

1. Service merespon pada URL target.
2. Halaman login `Crew Portal` tampil.
3. Setelah login valid, halaman dashboard dapat diakses.
4. Endpoint API LB1 merespon tanpa error server.

## Troubleshooting

## Port bentrok

- Ganti `PORT` atau hentikan proses yang memakai port yang sama.

## Login crew gagal

- Cek data akun di `src/lib/crew-access.ts`.
- Pastikan session lama di browser dihapus lalu login ulang.

## Endpoint LB1 gagal

- Validasi konfigurasi path/runtime.
- Cek log server dan file runtime terkait.

