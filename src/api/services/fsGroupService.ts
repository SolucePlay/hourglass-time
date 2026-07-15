import { AuthTokens, hgGet } from '../hourglass';

export interface FSGroup {
  id: number;
  name: string;
  overseer_id?: number;
  assistant_id?: number;
}

class FSGroupService {
  async getAll(auth: AuthTokens): Promise<FSGroup[]> {
    const data = await hgGet<FSGroup[]>('/fsreport/fsgroups', auth);
    return Array.isArray(data) ? data : [];
  }
}

export const fsGroupService = new FSGroupService();
