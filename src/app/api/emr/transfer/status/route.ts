import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { isCrewAuthorizedRequest } from '@/lib/server/crew-access-auth';
import { getTransferStatus } from '../run/route';

export async function GET(req: NextRequest) {
  if (!isCrewAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transferId = req.nextUrl.searchParams.get('transferId');
  if (!transferId) {
    return NextResponse.json({ error: 'transferId diperlukan' }, { status: 400 });
  }

  const status = getTransferStatus(transferId);
  if (!status) {
    return NextResponse.json({ error: 'Transfer tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({ transferId, ...status });
}
