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
    const { docType, fileContent, provider } = await request.json();

    if (!docType || !fileContent || !provider) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const userId = parseInt(session.user?.id || '1');
    const configs = await query<any>('SELECT * FROM ai_configs WHERE user_id = ? AND provider = ?', [userId, provider]);

    if (configs.length === 0) {
      return NextResponse.json({ error: `未配置 ${provider} API Key` }, { status: 400 });
    }

    const apiKey = configs[0].api_key;
    const contentEscaped = fileContent.replace(/'/g, "'\\''");

    const cmd = `python3 tools/analyze_style.py --doc-type "${docType}" --content '${contentEscaped}' --provider "${provider}" --api-key "${apiKey}"`;

    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
    const result = JSON.parse(stdout);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
