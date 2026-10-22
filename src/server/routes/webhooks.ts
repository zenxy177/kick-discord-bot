import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { kickWebhookHandler } from '../../services/kick/webhookHandler.js';
import { logger } from '../../utils/logger.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhooks/kick', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as any;
      const headers = req.headers;

      // Extract event from header or body
      const event =
        (headers['kick-event-type'] as string) ||
        (headers['x-kick-event-type'] as string) ||
        payload?.event ||
        payload?.type ||
        payload?.event_type;

      logger.info('WEBHOOK_ROUTE', `Kick Webhook alındı! Event: ${event} | Headers: ${JSON.stringify(headers['kick-event-type'] || headers['x-kick-event-type'] || 'Yok')}`);

      if (!payload) {
        return reply.status(400).send({ error: 'Boş webhook payload.' });
      }

      // Process asynchronously via queue
      await kickWebhookHandler.handleWebhook({
        event: event || 'unknown',
        data: payload.data || payload,
      });

      return reply.status(200).send({ status: 'ok', received: true });
    } catch (error) {
      logger.error('WEBHOOK_ROUTE', 'Webhook işleme hatası:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'online', timestamp: new Date().toISOString() };
  });
}
