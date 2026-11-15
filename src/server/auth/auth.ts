import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { createAuthAdapter } from './prisma-adapter';

const demoCredentialsSchema = z.object({
  email: z.string().email().default('demo@makario.local'),
  name: z.string().trim().min(1).max(80).default('Demo Builder'),
});

function configuredCredential(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '' || value.startsWith('YOUR_')) {
    return undefined;
  }
  return value;
}

export function isDemoSignInEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.AUTH_DEMO_ENABLED === 'true';
}

export function getConfiguredOAuthProviders(): ('google' | 'github')[] {
  const configured: ('google' | 'github')[] = [];
  if (googleId && googleSecret) {
    configured.push('google');
  }
  if (githubId && githubSecret) {
    configured.push('github');
  }
  return configured;
}

function assertOAuthCredentials(
  providerName: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
): void {
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(`${providerName} OAuth requires both its client ID and client secret.`);
  }
}

const providers: NextAuthConfig['providers'] = [];
const googleId = configuredCredential(process.env.AUTH_GOOGLE_ID);
const googleSecret = configuredCredential(process.env.AUTH_GOOGLE_SECRET);
const githubId = configuredCredential(process.env.AUTH_GITHUB_ID);
const githubSecret = configuredCredential(process.env.AUTH_GITHUB_SECRET);
assertOAuthCredentials('Google', googleId, googleSecret);
assertOAuthCredentials('GitHub', githubId, githubSecret);

if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  );
}

if (githubId && githubSecret) {
  providers.push(
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
    }),
  );
}

providers.push(
  Credentials({
    id: 'demo',
    name: 'Demo Workspace',
    credentials: {
      email: { label: 'Demo email', type: 'email' },
      name: { label: 'Display name', type: 'text' },
    },
    async authorize(credentials) {
      if (!isDemoSignInEnabled()) {
        return null;
      }
      const parsed = demoCredentialsSchema.safeParse(credentials);
      if (!parsed.success || !parsed.data.email.toLowerCase().endsWith('@makario.local')) {
        return null;
      }

      const email = parsed.data.email.toLowerCase();
      const user = await prisma.user.upsert({
        where: { email },
        update: { name: parsed.data.name },
        create: { email, name: parsed.data.name },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
      };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAuthAdapter(prisma),
  providers,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) {
        throw new Error('Auth.js sign-in completed without a user ID.');
      }
      await prisma.builderProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    },
  },
});
