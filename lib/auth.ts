import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const users = await query<any>('SELECT * FROM users WHERE username = ?', [credentials.username]);

        if (!users.length) {
          return null;
        }

        const user = users[0];

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id.toString(),
          name: user.display_name || user.username,
          email: user.username
        };
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  }
};
