/**
 * @deprecated
 * Compatibility layer for the legacy per-table Supabase hooks.
 *
 * These hooks preserve the old call signatures so that existing code continues
 * to compile and work unchanged during the migration to `useQuery`.
 *
 * Migration guide:
 *   - Replace `useProjects()` with `useQuery('projects')`
 *   - Replace `useBadges()` with `useQuery('badges')`
 *   - etc.
 *
 * This file will be removed in Phase 3 of the migration (see RFC issue).
 */

import { useQuery } from './useQuery';
import type { QueryResult } from './useQuery';
import type { Project, Badge, Profile, Stage, UserBadge } from '../types/database';

// Re-export QueryResult shape so callers that typed the old hook return value
// don't need to change their type annotations immediately.
export type LegacyHookResult<T> = Omit<QueryResult<never>, 'data'> & {
  data: T[] | null;
};

/** @deprecated Use `useQuery('profiles')` instead. */
export function useProfiles(filter?: { userId?: string }): LegacyHookResult<Profile> {
  return useQuery('profiles', {
    filter: filter?.userId ? { id: filter.userId } : undefined,
  }) as unknown as LegacyHookResult<Profile>;
}

/** @deprecated Use `useQuery('projects')` instead. */
export function useProjects(
  filter?: { status?: Project['status'] },
): LegacyHookResult<Project> {
  return useQuery('projects', {
    filter: filter?.status ? { status: filter.status } : undefined,
    orderBy: '-created_at',
  }) as unknown as LegacyHookResult<Project>;
}

/** @deprecated Use `useQuery('badges')` instead. */
export function useBadges(): LegacyHookResult<Badge> {
  return useQuery('badges') as unknown as LegacyHookResult<Badge>;
}

/** @deprecated Use `useQuery('user_badges')` instead. */
export function useUserBadges(userId?: string): LegacyHookResult<UserBadge> {
  return useQuery('user_badges', {
    filter: userId ? { user_id: userId } : undefined,
  }) as unknown as LegacyHookResult<UserBadge>;
}

/** @deprecated Use `useQuery('stages')` instead. */
export function useStages(projectId?: string): LegacyHookResult<Stage> {
  return useQuery('stages', {
    filter: projectId ? { project_id: projectId } : undefined,
    orderBy: 'order_index',
  }) as unknown as LegacyHookResult<Stage>;
}
