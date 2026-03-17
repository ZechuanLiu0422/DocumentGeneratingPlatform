import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, run } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const rows = await query<any>('SELECT provider, api_key FROM ai_configs WHERE user_id = ?', [parseInt(session.user?.id || '1')]);

    const configs: any = {};
    rows.forEach((row: any) => {
      configs[row.provider] = row.api_key;
    });

    return NextResponse.json({ configs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { provider, apiKey } = await request.json();
    const userId = parseInt(session.user?.id || '1');

    await run('INSERT OR REPLACE INTO ai_configs (user_id, provider, api_key) VALUES (?, ?, ?)', [userId, provider, apiKey]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
