import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { isCrewAuthorizedRequest } from '@/lib/server/crew-access-auth';
import { runEMRTransfer } from '@/lib/emr/engine';
import type { RMETransferPayload, EMRTransferConfig } from '@/lib/emr/types';

// In-memory transfer status (reset on server restart)
const activeTransfers = new Map<string, { status: 'running' | 'done' | 'error'; message: string }>();
export function getTransferStatus(id: string) {
  return activeTransfers.get(id);
}

export async function POST(req: NextRequest) {
  if (!isCrewAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { payload?: RMETransferPayload; pelayananId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { payload, pelayananId } = body;
  if (!payload || !payload.anamnesa) {
    return NextResponse.json({ error: 'payload.anamnesa wajib diisi' }, { status: 400 });
  }

  const config: EMRTransferConfig = {
    baseUrl: process.env.EMR_BASE_URL || 'https://kotakediri.epuskesmas.id',
    loginUrl: process.env.EMR_LOGIN_URL || 'https://kotakediri.epuskesmas.id/login',
    username: process.env.EMR_USERNAME || '',
    password: process.env.EMR_PASSWORD || '',
    sessionStoragePath: 'runtime/emr-session.json',
    headless: process.env.EMR_HEADLESS !== 'false',
  };

  if (!config.username || !config.password) {
    return NextResponse.json({ error: 'EMR_USERNAME dan EMR_PASSWORD belum dikonfigurasi' }, { status: 503 });
  }

  const transferId = `emr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  payload.options = { ...payload.options, requestId: transferId };

  // Run in background — return transferId immediately
  activeTransfers.set(transferId, { status: 'running', message: 'Transfer dimulai' });

  runEMRTransfer(payload, config, { pelayananId, headless: config.headless })
    .then((result) => {
      activeTransfers.set(transferId, {
        status: result.state === 'failed' ? 'error' : 'done',
        message: `Transfer selesai: ${result.state}`,
      });
    })
    .catch((err: unknown) => {
      activeTransfers.set(transferId, {
        status: 'error',
        message: `Transfer error: ${err instanceof Error ? err.message : String(err)}`,
      });
    });

  return NextResponse.json({ transferId, status: 'running' });
}
