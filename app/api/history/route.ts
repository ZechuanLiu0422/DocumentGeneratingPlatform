import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const docs = await query<any>('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, parseInt(session.user?.id || '1')]);
      if (!docs.length) {
        return NextResponse.json({ error: '文档不存在' }, { status: 404 });
      }
      return NextResponse.json({ document: docs[0] });
    }

    const documents = await query<any>(`
      SELECT id, doc_type, title, recipient, issuer, doc_date, created_at
      FROM documents
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [parseInt(session.user?.id || '1')]);

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
