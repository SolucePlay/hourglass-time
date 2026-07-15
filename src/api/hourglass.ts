import { Platform } from 'react-native';

const DIRECT_BASE_URL = 'https://app.hourglass-app.com/api/v0.2';
const DEFAULT_RELAY_BASE_URL = 'https://hourglass-proxy.onrender.com';

export interface AuthTokens {
  jwt: string;
  xsrfToken: string;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractCookieToken(source: string | null | undefined, key: string): string | null {
  const raw = String(source || '');
  if (!raw) return null;

  const regex = new RegExp(`(?:^|[;\\s])${key}=([^;]+)`, 'i');
  const match = raw.match(regex);
  if (!match?.[1]) return null;
  return decodeCookieValue(match[1].trim());
}

function extractJwtCandidate(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('ey')) return raw;

  const fromCookie = extractCookieToken(raw, 'hglogin');
  if (fromCookie && fromCookie.startsWith('ey')) return fromCookie;

  const match = raw.match(/eyJ[\w-]*\.[\w-]*\.[\w-]*/);
  return match ? match[0] : null;
}

function extractXsrfCandidate(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const fromCookie =
    extractCookieToken(raw, 'X-Hourglass-XSRF-Token') ||
    extractCookieToken(raw, 'x-hourglass-xsrf-token');

  return fromCookie || raw;
}

function normalizeAuthTokens({ jwt, xsrfToken }: AuthTokens): AuthTokens {
  const normalizedJwt = extractJwtCandidate(jwt);
  const normalizedXsrf =
    extractXsrfCandidate(xsrfToken) ||
    extractXsrfCandidate(jwt) ||
    '';

  return {
    jwt: normalizedJwt || '',
    xsrfToken: normalizedXsrf,
  };
}

function normalizeProxyBaseForWeb(proxyBase: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return proxyBase;

  try {
    const url = new URL(proxyBase);
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isLanHost =
      window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    // If web is opened via LAN host, localhost points to the wrong device.
    if (isLocalHost && isLanHost) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, '');
    }

    return proxyBase;
  } catch {
    return proxyBase;
  }
}

function getApiBaseUrl(): string {
  const proxyBase = process.env.EXPO_PUBLIC_HG_PROXY_BASE_URL;
  if (proxyBase) return normalizeProxyBaseForWeb(proxyBase);
  return DIRECT_BASE_URL;
}

export function getRelayBaseUrl(): string | null {
  const proxyBase = process.env.EXPO_PUBLIC_HG_PROXY_BASE_URL;
  const rawBase = proxyBase || DEFAULT_RELAY_BASE_URL;
  if (!rawBase) return null;

  const normalized = normalizeProxyBaseForWeb(rawBase);
  return normalized.replace(/\/api\/v0\.2\/?$/, '');
}

function buildHeaders({ jwt, xsrfToken }: AuthTokens): HeadersInit {
  const normalized = normalizeAuthTokens({ jwt, xsrfToken });
  const headers: Record<string, string> = {
    'X-Hourglass-XSRF-Token': normalized.xsrfToken,
    Accept: 'application/json',
  };
  
  // N'envoie le Bearer que si c'est un vrai JWT (commence par "ey")
  // Sinon le serveur rejette silencieusement la requête
  if (normalized.jwt && normalized.jwt.startsWith('ey')) {
    headers['Authorization'] = `Bearer ${normalized.jwt}`;
  }
  
  return headers;
}

function buildHeadersWithForcedBearer({ jwt, xsrfToken }: AuthTokens): HeadersInit {
  const normalized = normalizeAuthTokens({ jwt, xsrfToken });
  const headers = buildHeaders(normalized) as Record<string, string>;
  if (normalized.jwt) {
    headers.Authorization = `Bearer ${normalized.jwt}`;
  }
  return headers;
}

export async function hgGet<T = any>(endpoint: string, auth: AuthTokens): Promise<T | null> {
  try {
    const headers = buildHeaders(auth);
    let res = await fetch(`${getApiBaseUrl()}${endpoint}`, { headers });

    const sentAuthorization = Boolean((headers as Record<string, string>).Authorization);
    if (res.status === 401 && !sentAuthorization && auth.jwt) {
      // Some deployments need Bearer even when token is not a JWT-shaped string.
      res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        headers: buildHeadersWithForcedBearer(auth),
      });
    }

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function hgPut(endpoint: string, auth: AuthTokens, payload: unknown): Promise<number> {
  try {
    const headers = buildHeaders(auth);
    let res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    const sentAuthorization = Boolean((headers as Record<string, string>).Authorization);
    if (res.status === 401 && !sentAuthorization && auth.jwt) {
      res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: 'PUT',
        headers: buildHeadersWithForcedBearer(auth),
        body: JSON.stringify(payload),
      });
    }

    return res.status;
  } catch {
    return 500;
  }
}

export function getWeekForDate(date: Date): { monday: string; sunday: string } {
  const day = (date.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(date);
  monday.setDate(date.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
}

export function getCurrentWeek(): { monday: string; sunday: string } {
  return getWeekForDate(new Date());
}

// Petit cache mémoire pour éviter d'appeler /fsreport/whoami à chaque écran
let whoamiCache: any = null;
let whoamiPromise: Promise<any | null> | null = null;
let whoamiLastFailureAt = 0;
const WHOAMI_FAILURE_COOLDOWN_MS = 120000;

export async function getWhoami(auth: AuthTokens, force = false): Promise<any | null> {
  if (whoamiCache && !force) return whoamiCache;
  if (whoamiPromise && !force) return whoamiPromise;
  if (!force && Date.now() - whoamiLastFailureAt < WHOAMI_FAILURE_COOLDOWN_MS) {
    return null;
  }

  whoamiPromise = hgGet('/fsreport/whoami', auth)
    .then((data) => {
      if (data) {
        whoamiCache = data;
        whoamiLastFailureAt = 0;
      } else {
        whoamiLastFailureAt = Date.now();
      }
      return data;
    })
    .finally(() => {
      whoamiPromise = null;
    });

  return whoamiPromise;
}

export function clearWhoamiCache() {
  whoamiCache = null;
  whoamiPromise = null;
  whoamiLastFailureAt = 0;
}
