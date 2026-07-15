import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { AVAttendantAssignment, avAttendantService } from '../../api/services/avAttendantService';
import QueryKeys from '../../constants/queryKeys';
import { useAuth } from '../../context/AuthContext';

export function useAVAssignments(
  from: string,
  to: string,
  lgroup: number,
  options?: Partial<UseQueryOptions<AVAttendantAssignment[], Error>>,
) {
  const { jwt, xsrfToken } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.AVAttendantAssignment, lgroup, from, to],
    queryFn: () => avAttendantService.getAssignmentsRange({ jwt: jwt!, xsrfToken: xsrfToken! }, from, to, lgroup),
    enabled: Boolean(jwt && xsrfToken && from && to && lgroup),
    ...options,
  });
}
