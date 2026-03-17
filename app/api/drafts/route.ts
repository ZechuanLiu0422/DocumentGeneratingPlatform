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
    const drafts = await query<any>(
      'SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC',
      [parseInt(session.user?.id || '1')]
    );
    const parsedDrafts = drafts.map(draft => ({
      ...draft,
      attachments: draft.attachments ? JSON.parse(draft.attachments) : []
    }));
    return NextResponse.json({ drafts: parsedDrafts });
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
    const { id, docType, title, recipient, content, issuer, date, provider, contactName, contactPhone, attachments } = await request.json();
    const userId = parseInt(session.user?.id || '1');
    const attachmentsJson = JSON.stringify(attachments || []);

    let draftId = id;
    if (id) {
      await run(
        'UPDATE drafts SET doc_type=?, title=?, recipient=?, content=?, issuer=?, date=?, provider=?, contactName=?, contactPhone=?, attachments=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',
        [docType, title, recipient, content, issuer, date, provider, contactName, contactPhone, attachmentsJson, id, userId]
      );
    } else {
      const result = await run(
        'INSERT INTO drafts (user_id, doc_type, title, recipient, content, issuer, date, provider, contactName, contactPhone, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, docType, title, recipient, content, issuer, date, provider, contactName, contactPhone, attachmentsJson]
      );
      draftId = result.lastID;
    }
    return NextResponse.json({ success: true, draftId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    await run('DELETE FROM drafts WHERE id = ? AND user_id = ?', [id, parseInt(session.user?.id || '1')]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
