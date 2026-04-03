import { redis } from '@/lib/redis';

export function isValidIcon(str: string) {
  if (str.length > 10) {
    return false;
  }

  try {
    const emojiPattern = /[\p{Emoji}]/u;
    if (emojiPattern.test(str)) {
      return true;
    }
  } catch (error) {
    console.warn(
      'Emoji regex validation failed, using fallback validation',
      error
    );
  }

  return str.length >= 1 && str.length <= 10;
}

type SubdomainData = {
  emoji: string;
  createdAt: number;
};

export async function getSubdomainData(subdomain: string) {
  const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const raw = await redis.get(`subdomain:${sanitizedSubdomain}`);
  if (!raw) return null;
  return JSON.parse(raw) as SubdomainData;
}

export async function getAllSubdomains() {
  const keys = await redis.keys('subdomain:*');

  if (!keys.length) {
    return [];
  }

  const values = await redis.mget(...keys);

  return keys.map((key, index) => {
    const subdomain = key.replace('subdomain:', '');
    const raw = values[index];
    const data: SubdomainData | null = raw ? JSON.parse(raw) : null;

    return {
      subdomain,
      emoji: data?.emoji || '❓',
      createdAt: data?.createdAt || Date.now()
    };
  });
}
