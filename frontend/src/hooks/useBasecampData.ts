import { useQuery } from '@tanstack/react-query';
import {
  listBasecampProjects,
  listBasecampTodolists,
  listBasecampTodos,
  listBasecampPeople,
} from '../api/client';

export function useBasecampProjects(credentialId: string) {
  return useQuery({
    queryKey:  ['basecamp-projects', credentialId],
    queryFn:   () => listBasecampProjects(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}

export function useBasecampTodolists(credentialId: string, projectId: string) {
  return useQuery({
    queryKey:  ['basecamp-todolists', credentialId, projectId],
    queryFn:   () => listBasecampTodolists(credentialId, projectId),
    enabled:   !!credentialId && !!projectId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}

export function useBasecampTodos(credentialId: string, todolistId: string) {
  return useQuery({
    queryKey:  ['basecamp-todos', credentialId, todolistId],
    queryFn:   () => listBasecampTodos(credentialId, todolistId),
    enabled:   !!credentialId && !!todolistId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}

export function useBasecampPeople(credentialId: string) {
  return useQuery({
    queryKey:  ['basecamp-people', credentialId],
    queryFn:   () => listBasecampPeople(credentialId),
    enabled:   !!credentialId,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });
}
