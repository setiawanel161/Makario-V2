import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { Prisma, type PrismaClient } from '@prisma/client';

function toAdapterUser(user: {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  avatarUrl: string | null;
}): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    image: user.avatarUrl,
  };
}

export function createAuthAdapter(client: PrismaClient): Adapter {
  const adapter = PrismaAdapter(client);

  return {
    ...adapter,
    createUser: async (user) => {
      const created = await client.user.create({
        data: {
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          avatarUrl: user.image,
        },
      });
      return toAdapterUser(created);
    },
    getUser: async (id) => {
      const user = await client.user.findUnique({ where: { id } });
      return user === null ? null : toAdapterUser(user);
    },
    getUserByEmail: async (email) => {
      const user = await client.user.findUnique({ where: { email } });
      return user === null ? null : toAdapterUser(user);
    },
    getUserByAccount: async ({ provider, providerAccountId }) => {
      const account = await client.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account === null ? null : toAdapterUser(account.user);
    },
    updateUser: async (user) => {
      const data: Prisma.UserUpdateInput = {};
      if (user.name !== undefined) {
        data.name = user.name;
      }
      if (user.email !== undefined) {
        if (user.email === null) {
          throw new RangeError('Auth.js cannot set a user email to null.');
        }
        data.email = user.email;
      }
      if (user.emailVerified !== undefined) {
        data.emailVerified = user.emailVerified;
      }
      if (user.image !== undefined) {
        data.avatarUrl = user.image;
      }

      const updated = await client.user.update({ where: { id: user.id }, data });
      return toAdapterUser(updated);
    },
  };
}
