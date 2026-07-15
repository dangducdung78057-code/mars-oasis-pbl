import type { Database, Tables } from '../types/database';

type TableName = keyof Tables;
type Row<T extends TableName> = Tables[T]['Row'];

/**
 * In-memory Supabase mock for unit/integration tests.
 *
 * Usage:
 *   const mock = createMockSupabase({ badges: [{ id: '1', name: 'Explorer', ... }] });
 *   vi.mock('../lib/supabase', () => ({ supabase: mock }));
 */
export function createMockSupabase(
  initialData: Partial<{ [T in TableName]: Row<T>[] }> = {},
) {
  const store: { [T in TableName]?: Row<T>[] } = { ...initialData } as {
    [T in TableName]?: Row<T>[];
  };

  function getTable<T extends TableName>(table: T): Row<T>[] {
    return (store[table] as Row<T>[] | undefined) ?? [];
  }

  function buildQuery<T extends TableName>(table: T) {
    let rows = [...getTable(table)];
    let _error: string | null = null;
    const filters: Array<(row: Row<T>) => boolean> = [];
    let _orderBy: { column: keyof Row<T>; ascending: boolean } | null = null;
    let _limit: number | null = null;
    let _single = false;
    const channelCallbacks: Array<(payload: unknown) => void> = [];

    const query = {
      // filter: .eq(column, value)
      eq(column: keyof Row<T>, value: unknown) {
        filters.push((row) => row[column] === value);
        return query;
      },
      // filter: .neq(column, value)
      neq(column: keyof Row<T>, value: unknown) {
        filters.push((row) => row[column] !== value);
        return query;
      },
      // filter: .in(column, values)
      in(column: keyof Row<T>, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return query;
      },
      // order: .order(column, { ascending })
      order(column: keyof Row<T>, opts?: { ascending?: boolean }) {
        _orderBy = { column, ascending: opts?.ascending ?? true };
        return query;
      },
      // limit: .limit(n)
      limit(n: number) {
        _limit = n;
        return query;
      },
      // single result
      single() {
        _single = true;
        return query;
      },
      // execute the query
      then<TResult1 = unknown>(
        resolve: (value: {
          data: Row<T> | Row<T>[] | null;
          error: { message: string } | null;
        }) => TResult1,
      ) {
        let result = rows.filter((row) =>
          filters.every((fn) => fn(row)),
        ) as Row<T>[];

        if (_orderBy) {
          const { column, ascending } = _orderBy;
          result = [...result].sort((a, b) => {
            const av = a[column];
            const bv = b[column];
            if (av === bv) return 0;
            const cmp = av < bv ? -1 : 1;
            return ascending ? cmp : -cmp;
          });
        }

        if (_limit !== null) {
          result = result.slice(0, _limit);
        }

        if (_error) {
          return Promise.resolve(resolve({ data: null, error: { message: _error } }));
        }

        if (_single) {
          return Promise.resolve(
            resolve({
              data: result[0] ?? null,
              error: result.length === 0 ? { message: 'No rows found' } : null,
            }),
          );
        }

        return Promise.resolve(resolve({ data: result, error: null }));
      },
      _triggerChange: (payload: unknown) => {
        channelCallbacks.forEach((cb) => cb(payload));
      },
    };

    return query;
  }

  const mock = {
    from<T extends TableName>(table: T) {
      return {
        select: (_cols?: string) => buildQuery<T>(table),
        insert: (row: Partial<Row<T>>) => {
          const newRow = { id: crypto.randomUUID(), ...row } as Row<T>;
          (store[table] as Row<T>[]) = [...getTable(table), newRow];
          return Promise.resolve({ data: newRow, error: null });
        },
        update: (changes: Partial<Row<T>>) => ({
          eq: (col: keyof Row<T>, val: unknown) => {
            (store[table] as Row<T>[]) = getTable(table).map((r) =>
              r[col] === val ? { ...r, ...changes } : r,
            );
            return Promise.resolve({ data: null, error: null });
          },
        }),
        delete: () => ({
          eq: (col: keyof Row<T>, val: unknown) => {
            (store[table] as Row<T>[]) = getTable(table).filter(
              (r) => r[col] !== val,
            );
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    },
    channel(_name: string) {
      return {
        on(_event: string, _opts: unknown, cb: (payload: unknown) => void) {
          void _event;
          void _opts;
          void cb;
          return this;
        },
        subscribe() {
          return this;
        },
      };
    },
    removeChannel(_ch: unknown) {
      void _ch;
    },
    // Expose internal store for assertions in tests
    _store: store,
  };

  return mock as unknown as typeof import('./supabase').supabase & {
    _store: typeof store;
  };
}

/**
 * Type alias for the mock client — use in test files.
 */
export type MockSupabaseClient = ReturnType<typeof createMockSupabase>;

/**
 * Simple factory with typed Database shape — useful for testing hooks directly.
 */
export function createMockDatabase(
  data: Partial<{ [T in TableName]: Tables[T]['Row'][] }> = {},
): Partial<Database['public']['Tables']> {
  return data as Partial<Database['public']['Tables']>;
}
