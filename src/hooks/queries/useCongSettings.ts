import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { congregationService, CongSettings } from '../../api/services/congregationService';
import QueryKeys from '../../constants/queryKeys';
import { useAuth } from '../../context/AuthContext';

export function useCongSettings(
  lgroup?: number,
  options?: Partial<UseQueryOptions<CongSettings | null, Error>>,
) {
  const { jwt, xsrfToken } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.CongregationSettings, lgroup],
    queryFn: () => congregationService.getSettings({ jwt: jwt!, xsrfToken: xsrfToken! }, lgroup),
    enabled: Boolean(jwt && xsrfToken),
    ...options,
  });
}
