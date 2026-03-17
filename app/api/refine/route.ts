import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { query } from '@/lib/db';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { docType, recipient, originalContent, userFeedback, provider } = await request.json();

    const rows = await query<any>('SELECT api_key FROM ai_configs WHERE user_id = ? AND provider = ?', [parseInt(session.user?.id || '1'), provider]);

    if (!rows.length) {
      return NextResponse.json({ error: `请先在设置中配置 ${provider} API Key` }, { status: 400 });
    }

    const apiKey = rows[0].api_key;

    const cmd = `python3 tools/refine_text.py --doc-type "${docType}" --recipient "${recipient}" --original "${originalContent.replace(/"/g, '\\"')}" --feedback "${userFeedback.replace(/"/g, '\\"')}" --provider "${provider}" --api-key "${apiKey}"`;

    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
