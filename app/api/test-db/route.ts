import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const users = await query<any>('SELECT * FROM users WHERE username = ?', ['test']);

    if (!users.length) {
      return NextResponse.json({ error: 'User not found' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare('test123', user.password_hash);

    return NextResponse.json({
      user: { id: user.id, username: user.username },
      passwordValid: isValid
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
