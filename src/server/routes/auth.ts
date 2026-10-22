import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { kickOAuthService } from '../../services/kick/kickOAuth.js';
import { logger } from '../../utils/logger.js';

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/api/auth/kick/callback', async (req: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => {
    const { code, state, error, error_description } = req.query;

    if (error || !code || !state) {
      const errMsg = error_description || error || 'Yetkilendirme reddedildi veya eksik parametre.';
      logger.warn('AUTH_ROUTE', `Kick OAuth hatası: ${errMsg}`);

      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <title>Bağlantı Başarısız | Kick Bot</title>
          <style>
            body { background: #0b0e0f; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #161a1e; border: 1px solid #e53935; padding: 40px; border-radius: 16px; text-align: center; max-width: 450px; }
            h2 { color: #e53935; margin-bottom: 10px; }
            p { color: #b0bec5; font-size: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✖ Bağlantı Başarısız</h2>
            <p>${errMsg}</p>
            <p>Lütfen bu sekmeyi kapatıp Discord üzerinden tekrar deneyin.</p>
          </div>
        </body>
        </html>
      `);
    }

    try {
      const result = await kickOAuthService.handleCallback(code, state);

      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <title>Başarıyla Eşleştirildi | Kick Bot</title>
          <style>
            body { background: #0b0e0f; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #14171a; border: 2px solid #53fc18; box-shadow: 0 0 25px rgba(83,252,24,0.2); padding: 40px; border-radius: 20px; text-align: center; max-width: 480px; }
            .badge { background: #53fc18; color: #000; font-weight: bold; padding: 6px 14px; border-radius: 20px; display: inline-block; margin-bottom: 15px; }
            h2 { margin: 10px 0; font-size: 26px; }
            p { color: #90a4ae; line-height: 1.6; font-size: 16px; }
            .user-box { background: #1f2429; padding: 12px; border-radius: 10px; margin: 20px 0; font-weight: bold; color: #53fc18; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">KICK ENTEGRASYONU</span>
            <h2>🎉 Tebrikler!</h2>
            <div class="user-box">@${result.kickUsername}</div>
            <p>Kick hesabınız Discord hesabınızla başarıyla eşleştirildi. Abonelik ve VIP durumunuza göre rolleriniz sunucuda otomatik tanımlanacaktır.</p>
            <p style="font-size: 14px; color: #607d8b; margin-top: 20px;">Artık bu sekmeyi kapatıp Discord'a dönebilirsiniz.</p>
          </div>
        </body>
        </html>
      `);
    } catch (err: any) {
      logger.error('AUTH_ROUTE', 'Callback işlenirken hata oluştu:', err);
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <title>Hata | Kick Bot</title>
          <style>
            body { background: #0b0e0f; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #161a1e; border: 1px solid #e53935; padding: 40px; border-radius: 16px; text-align: center; max-width: 450px; }
            h2 { color: #e53935; }
            p { color: #b0bec5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>İşlem Başarısız</h2>
            <p>${err.message || 'Bilinmeyen bir hata oluştu.'}</p>
          </div>
        </body>
        </html>
      `);
    }
  });
}
