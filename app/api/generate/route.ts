import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { run } from '@/lib/db';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { docType, title, recipient, content, issuer, date, generatedContent, provider, attachments, contactName, contactPhone } = await request.json();

    const templatePath = path.join(process.cwd(), 'templates', `${docType}.json`);
    const sanitizedTitle = title.replace(/[\/\\:*?"<>|]/g, '_');
    const outputPath = path.join(process.cwd(), '.tmp', `${sanitizedTitle}.docx`);

    const contentData = JSON.stringify({
      title,
      recipient,
      content: generatedContent,
      issuer,
      date,
      attachments: attachments || [],
      contactName: contactName || '',
      contactPhone: contactPhone || ''
    });

    const cmd = `python3 tools/generate_docx.py --template "${templatePath}" --content '${contentData}' --output "${outputPath}"`;

    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout);

    if (result.success) {
      await run(`
        INSERT INTO documents (user_id, doc_type, title, recipient, user_input, generated_content, ai_provider, issuer, doc_date, file_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [parseInt(session.user?.id || '1'), docType, title, recipient, content, generatedContent, provider, issuer, date, result.file_path]);

      const fileBuffer = fs.readFileSync(result.file_path);
      const base64 = fileBuffer.toString('base64');

      return NextResponse.json({
        success: true,
        file_path: result.file_path,
        file_data: base64,
        file_name: path.basename(result.file_path)
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
