import { AuthTokens, hgGet } from '../hourglass';

export interface AVAttendantAssignment {
  id?: number;
  date: string;
  [key: string]: unknown;
}

class AVAttendantService {
  async getAssignmentsRange(auth: AuthTokens, from: string, to: string, lgroup: number): Promise<AVAttendantAssignment[]> {
    const endpoint = `/scheduling/av_attendant/${from}_${to}?lgroup=${lgroup}`;
    const data = await hgGet<AVAttendantAssignment[]>(endpoint, auth);
    return Array.isArray(data) ? data : [];
  }
}

export const avAttendantService = new AVAttendantService();
