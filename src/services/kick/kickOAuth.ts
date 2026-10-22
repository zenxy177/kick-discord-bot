import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { queueService } from '../queue/index.js';
import { kickClient } from './kickClient.js';

export interface OAuthStatePayload {
  guildId: string;
  discordUserId: string;
  verifier: string;
}

export class KickOAuthService {
  /**
   * Generates authorization URL for a user with mandatory PKCE (Proof Key for Code Exchange)
   */
  generateAuthUrl(guildId: string, discordUserId: string): { url: string; hasClientId: boolean } {
    if (!env.KICK_CLIENT_ID || env.KICK_CLIENT_ID.trim().length === 0) {
      return { url: '', hasClientId: false };
    }

    // Generate PKCE code verifier (43-128 chars base64url)
    const verifier = crypto.randomBytes(32).toString('base64url');
    // Generate code_challenge = base64url(sha256(verifier))
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    // Roundtrip the verifier in state so we can pass it to /oauth/token
    const statePayload: OAuthStatePayload = { guildId, discordUserId, verifier };
    const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const scopes = [
      'user:read',
      'channel:read',
      'events:subscribe',
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.KICK_CLIENT_ID,
      redirect_uri: env.KICK_REDIRECT_URI,
      scope: scopes,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: encodedState,
    });

    return {
      url: `https://id.kick.com/oauth/authorize?${params.toString()}`,
      hasClientId: true,
    };
  }

  /**
   * Handles OAuth callback from Kick, exchanges code + PKCE verifier for user details
   */
  async handleCallback(code: string, state: string) {
    let stateData: OAuthStatePayload;
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      stateData = JSON.parse(decoded);
    } catch {
      throw new Error('Geçersiz veya süresi dolmuş OAuth state parametresi.');
    }

    if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) {
      throw new Error('Kick Client ID veya Secret yapılandırılmamış.');
    }

    // 1. Exchange code for user access token using authorization_code + code_verifier (PKCE)
    const tokenRes = await axios.post(
      'https://id.kick.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.KICK_CLIENT_ID,
        client_secret: env.KICK_CLIENT_SECRET,
        redirect_uri: env.KICK_REDIRECT_URI,
        code,
        code_verifier: stateData.verifier,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const userToken = tokenRes.data.access_token;

    // 2. Fetch authenticated Kick user profile
    const userRes = await axios.get('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const payload = userRes.data;
    const kickUser =
      payload?.user ||
      (Array.isArray(payload?.data) ? payload.data[0] : payload?.data) ||
      payload;

    const kickUserId = String(
      kickUser?.id ||
      kickUser?.user_id ||
      kickUser?.broadcaster_user_id ||
      'unknown'
    );
    const kickUsername =
      kickUser?.username ||
      kickUser?.name ||
      kickUser?.slug ||
      'KickKullanici';

    // 3. Find guild settings to check if they are subscribed
    const guildConfig = await prisma.guildConfig.findUnique({
      where: { guildId: stateData.guildId },
    });

    let isSubscribed = false;
    let isVip = false;

    if (guildConfig?.kickChannelId) {
      const subInfo = await kickClient.checkSubscription(guildConfig.kickChannelId, kickUserId);
      isSubscribed = subInfo.is_subscribed;
      isVip = subInfo.is_vip;
    }

    // 4. Save or update UserLink in database
    await prisma.userLink.upsert({
      where: {
        guildId_discordUserId: {
          guildId: stateData.guildId,
          discordUserId: stateData.discordUserId,
        },
      },
      update: {
        kickUserId,
        kickUsername,
        isVerified: true,
        isSubscribed,
        isVip,
        linkedAt: new Date(),
      },
      create: {
        guildId: stateData.guildId,
        discordUserId: stateData.discordUserId,
        kickUserId,
        kickUsername,
        isVerified: true,
        isSubscribed,
        isVip,
        linkedAt: new Date(),
      },
    });

    // Otomatik rol senkronizasyonunu kuyruğa ekle
    await queueService.addJob('kick.sub.sync', {
      guildId: stateData.guildId,
      discordUserId: stateData.discordUserId,
    });

    logger.success(
      'OAUTH',
      `Hesap başarıyla eşleştirildi: Discord(${stateData.discordUserId}) <-> Kick(${kickUsername})`
    );

    return {
      guildId: stateData.guildId,
      discordUserId: stateData.discordUserId,
      kickUsername,
      isSubscribed,
      isVip,
    };
  }
}

export const kickOAuthService = new KickOAuthService();
