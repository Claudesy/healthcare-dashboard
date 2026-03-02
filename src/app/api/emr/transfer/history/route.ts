import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { isCrewAuthorizedRequest } from '@/lib/server/crew-access-auth';
import { readEMRHistory } from '@/lib/emr/history';

export async function GET(req: NextRequest) {
  if (!isCrewAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') || '20', 10));

  const history = await readEMRHistory(limit);
  return NextResponse.json({ history, count: history.length });
}
