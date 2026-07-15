import { AuthTokens, hgGet } from '../hourglass';

const BASE_URL = 'https://app.hourglass-app.com/api/v0.2';

export interface CongSettings {
  infoBoardUrl?: string;
  number_of_cleaning_assignments?: number;
  [key: string]: unknown;
}

function buildHeaders(auth: AuthTokens): HeadersInit {
  const headers: Record<string, string> = {
    'X-Hourglass-XSRF-Token': auth.xsrfToken,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (auth.jwt && auth.jwt.startsWith('ey')) {
    headers.Authorization = `Bearer ${auth.jwt}`;
  }

  return headers;
}

class CongregationService {
  async getSettings(auth: AuthTokens, lgroup?: number): Promise<CongSettings | null> {
    const endpoint = lgroup ? `/scheduling/congregation/settings?lgroup=${lgroup}` : '/scheduling/congregation/settings';
    return hgGet<CongSettings>(endpoint, auth);
  }

  async setSettings(auth: AuthTokens, settings: CongSettings, lgroup?: number): Promise<CongSettings | null> {
    const endpoint = lgroup ? `/scheduling/congregation/settings?lgroup=${lgroup}` : '/scheduling/congregation/settings';

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: buildHeaders(auth),
        body: JSON.stringify(settings),
      });
      if (!res.ok) return null;
      return (await res.json()) as CongSettings;
    } catch {
      return null;
    }
  }
}

export const congregationService = new CongregationService();
