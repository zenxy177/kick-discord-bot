import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { authRoutes } from './routes/auth.js';
import { webhookRoutes } from './routes/webhooks.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function createFastifyServer(): FastifyInstance {
  const fastify = Fastify({
    logger: false, // Use our custom logger
  });

  fastify.register(cors, { origin: true });
  fastify.register(formbody);

  fastify.register(authRoutes);
  fastify.register(webhookRoutes);

  return fastify;
}

export async function startFastifyServer(app: FastifyInstance): Promise<void> {
  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.success('SERVER', `Fastify HTTP Webhook ve OAuth sunucusu aktif: ${address}`);
  } catch (err) {
    logger.error('SERVER', 'Fastify sunucusu başlatılamadı:', err);
    throw err;
  }
}
