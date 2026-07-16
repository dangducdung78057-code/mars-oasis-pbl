import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database';

type TableName = keyof Tables;
type Row<T extends TableName> = Tables[T]['Row'];

/** Filter map — each entry becomes an `.eq()` call. */
export type QueryFilter<T extends TableName> = Partial<Record<keyof Row<T>, unknown>>;

export interface QueryOptions<T extends TableName> {
  /** Key/value pairs translated to `.eq()` filters */
  filter?: QueryFilter<T>;
  /**
   * Column to sort by.
   * Prefix with `-` for descending order (e.g. `'-created_at'`).
   */
  orderBy?: string;
  /** Enable Supabase Realtime subscription — re-fetches on INSERT/UPDATE/DELETE */
  realtime?: boolean;
  /** Columns to select (default: `'*'`) */
  select?: string;
  /** Automatically fetch on mount (default: true) */
  enabled?: boolean;
}

export interface QueryResult<T extends TableName> {
  data: Row<T>[] | null;
  loading: boolean;
  error: Error | null;
  /** Manually re-fetch data */
  refresh: () => void;
  /**
   * Optimistically update local state without re-fetching.
   * Pass `null` to clear data.
   */
  mutate: (updater: ((prev: Row<T>[] | null) => Row<T>[] | null) | null) => void;
}

/**
 * Generic data-fetching hook that replaces the 12 individual Supabase hooks.
 *
 * @example
 * const { data, loading, error } = useQuery('projects', {
 *   filter: { status: 'active' },
 *   orderBy: '-created_at',
 *   realtime: true,
 * });
 */
export function useQuery<T extends TableName>(
  table: T,
  options: QueryOptions<T> = {},
): QueryResult<T> {
  const {
    filter,
    orderBy,
    realtime = false,
    select = '*',
    enabled = true,
  } = options;

  const [data, setData] = useState<Row<T>[] | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Stabilise the filter reference so useCallback/useEffect dependencies stay accurate.
  // JSON.stringify provides value-based equality; the memo only recomputes when the
  // serialised representation changes, avoiding spurious re-renders when a parent
  // passes a new-but-equal filter object on each render.
  const stableFilterKey = useMemo(() => JSON.stringify(filter ?? null), [filter]);

  // Track whether the component is still mounted to avoid state updates after unmount
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    // Derive the filter from the stable serialised key so this callback only
    // re-creates when the serialised value actually changes, not on every
    // render where a parent might supply a new-but-equal filter object.
    const parsedFilter: QueryFilter<T> | null =
      stableFilterKey && stableFilterKey !== 'null'
        ? (JSON.parse(stableFilterKey) as QueryFilter<T>)
        : null;

    try {
      // Build the query
      let query = supabase.from(table).select(select) as ReturnType<
        typeof supabase.from
      >['select'];

      // Apply filters
      if (parsedFilter) {
        for (const [col, val] of Object.entries(parsedFilter)) {
          if (val !== undefined) {
            query = (query as unknown as { eq: (c: string, v: unknown) => typeof query }).eq(col, val);
          }
        }
      }

      // Apply ordering
      if (orderBy) {
        const descending = orderBy.startsWith('-');
        const column = descending ? orderBy.slice(1) : orderBy;
        query = (query as unknown as { order: (c: string, o: { ascending: boolean }) => typeof query }).order(column, { ascending: !descending });
      }

      const { data: rows, error: dbError } = await (query as unknown as Promise<{ data: Row<T>[] | null; error: { message: string } | null }>);

      if (cancelledRef.current) return;

      if (dbError) {
        setError(new Error(dbError.message));
        setData(null);
      } else {
        setData(rows);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [table, select, enabled, stableFilterKey, orderBy]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchData();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (realtime && enabled) {
      const ch = supabase
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
          { event: '*', schema: 'public', table } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
          () => {
            fetchData();
          },
        )
        .subscribe();
      channel = ch;
    }

    return () => {
      cancelledRef.current = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchData, realtime, enabled, table]);

  const mutate = useCallback(
    (updater: ((prev: Row<T>[] | null) => Row<T>[] | null) | null) => {
      if (updater === null) {
        setData(null);
      } else {
        setData((prev) => updater(prev));
      }
    },
    [],
  );

  return { data, loading, error, refresh: fetchData, mutate };
}
