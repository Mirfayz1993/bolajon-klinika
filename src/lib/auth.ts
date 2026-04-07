import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rate-limit';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;

        const phoneClean = credentials.phone.replace(/\s/g, '');

        // Brute force himoyasi: 5 ta noto'g'ri urinish → 15 daqiqa blok
        const limiter = rateLimit(`login:${phoneClean}`, 5, 15 * 60 * 1000);
        if (!limiter.success) {
          throw new Error('Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.');
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { phone: phoneClean },
              { email: phoneClean },
            ],
            isActive: true,
          },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          role: user.role,
          phone: user.phone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.phone = token.phone;
      }
      return session;
    },
  },
};
