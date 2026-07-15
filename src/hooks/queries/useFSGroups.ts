import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { FSGroup, fsGroupService } from '../../api/services/fsGroupService';
import QueryKeys from '../../constants/queryKeys';
import { useAuth } from '../../context/AuthContext';

export function useFSGroups(options?: Partial<UseQueryOptions<FSGroup[], Error>>) {
  const { jwt, xsrfToken } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.FSGroups],
    queryFn: () => fsGroupService.getAll({ jwt: jwt!, xsrfToken: xsrfToken! }),
    enabled: Boolean(jwt && xsrfToken),
    ...options,
  });
}
