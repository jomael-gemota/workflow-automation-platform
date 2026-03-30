import { useQuery } from '@tanstack/react-query';
import { listTeamsTeams, listTeamsChannels, listTeamsUsers } from '../api/client';

export function useTeamsTeams(credentialId: string) {
  const query = useQuery({
    queryKey:  ['teams-teams', credentialId],
    queryFn:   () => listTeamsTeams(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });

  return {
    ...query,
    teams: query.data?.teams ?? [],
  };
}

export function useTeamsChannels(credentialId: string, teamId: string) {
  const query = useQuery({
    queryKey:  ['teams-channels', credentialId, teamId],
    queryFn:   () => listTeamsChannels(credentialId, teamId),
    enabled:   !!credentialId && !!teamId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });

  return {
    ...query,
    channels: query.data?.channels ?? [],
  };
}

export function useTeamsUsers(credentialId: string) {
  return useQuery({
    queryKey:  ['teams-users', credentialId],
    queryFn:   () => listTeamsUsers(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}
