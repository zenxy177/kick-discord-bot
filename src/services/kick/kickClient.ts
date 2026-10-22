import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { parseKickDate } from '../../utils/timeFormatter.js';

export interface KickChannelData {
  id: string;
  slug: string;
  username: string;
  profile_picture?: string;
  is_live: boolean;
  stream_title: string;
  category_name: string;
  viewer_count: number;
  started_at?: string;
  thumbnail_url?: string;
}

export interface KickSubscriptionData {
  is_subscribed: boolean;
  is_vip: boolean;
  sub_tier?: number;
  subscribed_since?: string;
}

export interface KickClipItem {
  id: string;
  livestream_id?: string;
  category_id?: string;
  channel_id?: string | number;
  user_id?: string | number;
  title: string;
  clip_url?: string;
  thumbnail_url?: string;
  duration?: number;
  view_count?: number;
  created_at: string;
  category?: {
    id?: number | string;
    name?: string;
    slug?: string;
  };
  creator?: {
    id?: number | string;
    username?: string;
    slug?: string;
  };
  channel?: {
    id?: number | string;
    username?: string;
    slug?: string;
    profile_picture?: string;
  };
}

export class KickClient {
  private http: AxiosInstance;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://api.kick.com/public/v1',
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Retrieves an app access token using client credentials flow
   */
  async getAppAccessToken(): Promise<string | null> {
    if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) {
      return null;
    }

    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://id.kick.com/oauth/token',
        {
          grant_type: 'client_credentials',
          client_id: env.KICK_CLIENT_ID,
          client_secret: env.KICK_CLIENT_SECRET,
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
      return this.accessToken || null;
    } catch (error) {
      logger.warn('KICK_CLIENT', 'Kick App Access Token alınamadı:', (error as Error).message);
      return null;
    }
  }

  /**
   * Fetch streamer channel information by channel slug.
   * Uses Kick's public v2 endpoint first (no OAuth needed, works 100%),
   * then falls back to public v1 if needed.
   */
  async getChannel(slug: string): Promise<KickChannelData | null> {
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Primary: Kick API v2 (Direct public channel endpoint)
    try {
      const response = await axios.get(`https://kick.com/api/v2/channels/${encodeURIComponent(cleanSlug)}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      const data = response.data;
      if (data && (data.id || data.user_id)) {
        const livestream = data.livestream;
        const isLive = Boolean(livestream && livestream.is_live);
        const categoryName = livestream?.categories?.[0]?.name || 'Just Chatting';
        const thumbUrl =
          livestream?.thumbnail?.url ||
          data.banner_image?.url ||
          data.offline_banner_image?.url;

        return {
          id: String(data.id || data.user_id || cleanSlug),
          slug: data.slug || cleanSlug,
          username: data.user?.username || data.name || cleanSlug,
          profile_picture: data.user?.profile_pic || data.profile_picture,
          is_live: isLive,
          stream_title: livestream?.session_title || 'Canlı Yayın',
          category_name: categoryName,
          viewer_count: Number(livestream?.viewer_count || 0),
          started_at: livestream?.start_time || livestream?.created_at
            ? parseKickDate(livestream?.start_time || livestream?.created_at).toISOString()
            : undefined,
          thumbnail_url: thumbUrl ? String(thumbUrl) : undefined,
        };
      }
    } catch (err: any) {
      logger.debug('KICK_CLIENT', `Kick v2 sorgusu başarısız (${cleanSlug}), v1 deneniyor...`);
    }

    // 2. Fallback: Official Developer API v1
    const token = await this.getAppAccessToken();
    try {
      const response = await this.http.get(`/channels/${encodeURIComponent(cleanSlug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = response.data?.data || response.data;
      if (!data) return null;

      const livestream = data.livestream || data.stream;
      const thumbnailUrl =
        livestream?.thumbnail?.url ||
        livestream?.thumbnail ||
        data.banner_image?.url ||
        data.offline_banner_image?.url ||
        data.banner_image;

      return {
        id: String(data.id || data.broadcaster_user_id || cleanSlug),
        slug: data.slug || cleanSlug,
        username: data.user?.username || data.username || cleanSlug,
        profile_picture: data.user?.profile_picture || data.profile_picture,
        is_live: Boolean(livestream && livestream.is_live !== false),
        stream_title: livestream?.session_title || data.stream_title || 'Canlı Yayın',
        category_name: livestream?.categories?.[0]?.name || data.category?.name || 'Just Chatting',
        viewer_count: Number(livestream?.viewer_count || 0),
        started_at: livestream?.start_time || livestream?.created_at
          ? parseKickDate(livestream?.start_time || livestream?.created_at).toISOString()
          : undefined,
        thumbnail_url: thumbnailUrl ? String(thumbnailUrl) : undefined,
      };
    } catch (error: any) {
      logger.debug('KICK_CLIENT', `Kanal sorgusu başarısız (${cleanSlug}):`, error?.response?.data || error.message);
      return null;
    }
  }

  /**
   * Check user subscription and VIP status for a given channel
   */
  async checkSubscription(broadcasterId: string, kickUserId: string): Promise<KickSubscriptionData> {
    const token = await this.getAppAccessToken();
    if (!token) {
      return { is_subscribed: false, is_vip: false };
    }

    try {
      const response = await this.http.get(
        `/channels/${broadcasterId}/subscriptions?user_id=${kickUserId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const subData = response.data?.data?.[0];
      return {
        is_subscribed: Boolean(subData),
        is_vip: false,
        sub_tier: subData ? 1 : undefined,
        subscribed_since: subData?.created_at,
      };
    } catch (error) {
      return { is_subscribed: false, is_vip: false };
    }
  }

  /**
   * Fetch recent clips for a channel using Kick's public v2 API.
   * Works 100% without OAuth / API keys.
   */
  async getRecentClips(slug: string): Promise<KickClipItem[]> {
    const cleanSlug = slug.trim().toLowerCase();
    try {
      const response = await axios.get(`https://kick.com/api/v2/channels/${encodeURIComponent(cleanSlug)}/clips`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      const clips = response.data?.clips;
      if (Array.isArray(clips)) {
        return clips;
      }
      return [];
    } catch (error: any) {
      logger.warn('KICK_CLIENT', `Klip listesi alınamadı (${cleanSlug}):`, error?.message);
      return [];
    }
  }
}

export const kickClient = new KickClient();
