import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

if (typeof ws !== 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let cachedPrisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  if (cachedPrisma) {
    return cachedPrisma;
  }

  const connectionString = process.env['DATABASE_URL'];

  let client: PrismaClient;

  try {
    if (connectionString && connectionString.includes('neon.tech')) {
      const pool = new Pool({ connectionString });
      const adapter = new PrismaNeon(pool);
      client = new PrismaClient({ adapter });
    } else {
      client = new PrismaClient();
    }
  } catch (err) {
    console.error('Failed to create PrismaClient with adapter, falling back to direct PrismaClient:', err);
    client = new PrismaClient();
  }

  if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.prisma = client;
  }
  cachedPrisma = client;

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});


export * from '@prisma/client';
