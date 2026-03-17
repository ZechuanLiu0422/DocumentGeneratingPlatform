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
    const { docType, title, recipient, content, provider, attachments, referenceAnalysis, imitationStrength } = await request.json();

    const rows = await query<any>('SELECT api_key FROM ai_configs WHERE user_id = ? AND provider = ?', [parseInt(session.user?.id || '1'), provider]);

    if (!rows.length) {
      return NextResponse.json({ error: `请先在设置中配置 ${provider} API Key` }, { status: 400 });
    }

    const apiKey = rows[0].api_key;

    const cleanTitle = title ? title.replace(/[`'"\\]/g, '') : '';

    const attachmentsParam = attachments && attachments.length > 0
      ? ` --attachments '${JSON.stringify(attachments).replace(/'/g, "\\'")}'`
      : '';

    const referenceParam = referenceAnalysis
      ? ` --reference-analysis '${JSON.stringify(referenceAnalysis).replace(/'/g, "\\'")}'`
      : '';

    const strengthParam = imitationStrength
      ? ` --imitation-strength "${imitationStrength}"`
      : '';

    const cmd = `python3 tools/polish_text.py --doc-type "${docType}" --recipient "${recipient}" --content "${content.replace(/"/g, '\\"')}" --provider "${provider}" --api-key "${apiKey}"${cleanTitle ? ` --title "${cleanTitle}"` : ''}${attachmentsParam}${referenceParam}${strengthParam}`;

    const { stdout } = await execAsync(cmd);
    const polishResult = JSON.parse(stdout);

    return NextResponse.json(polishResult);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
