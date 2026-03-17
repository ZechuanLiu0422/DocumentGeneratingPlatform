import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const docType = formData.get('docType') as string;

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    }

    const allowedExts = ['docx', 'pdf', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExts.includes(ext)) {
      return NextResponse.json({ error: '不支持的文件格式，仅支持 .docx, .pdf, .txt' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const tempPath = path.join(process.cwd(), '.tmp', `ref_${Date.now()}_${file.name}`);
    fs.writeFileSync(tempPath, Buffer.from(buffer));

    const cmd = `python3 tools/parse_document.py --file "${tempPath}"`;
    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout);

    fs.unlinkSync(tempPath);

    if (result.success) {
      return NextResponse.json({
        success: true,
        fileId: `ref_${Date.now()}`,
        content: result.content,
        wordCount: result.wordCount,
        fileName: file.name
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
