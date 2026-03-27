import { useQuery } from '@tanstack/react-query';
import { listSlackChannels, listSlackUsers } from '../api/client';

export function useSlackChannels(credentialId: string) {
  const query = useQuery({
    queryKey:  ['slack-channels', credentialId],
    queryFn:   () => listSlackChannels(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });

  return {
    ...query,
    channels:      query.data?.channels      ?? [],
    missingScopes: query.data?.missingScopes  ?? [],
  };
}

export function useSlackUsers(credentialId: string) {
  return useQuery({
    queryKey: ['slack-users', credentialId],
    queryFn:  () => listSlackUsers(credentialId),
    enabled:  !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
