// Minimal stand-in for the Supabase client used by the API routes.
// Each table gets a chainable query whose terminal call (single / maybeSingle)
// resolves to the configured { data, error }; chain methods record their args.

type QueryResult = { data?: unknown; error?: unknown }

export function queryMock(result: QueryResult = { data: null, error: null }) {
  const query: Record<string, jest.Mock> = {}
  for (const method of ['select', 'insert', 'update', 'upsert', 'eq']) {
    query[method] = jest.fn(() => query)
  }
  query.single = jest.fn(async () => result)
  query.maybeSingle = jest.fn(async () => result)
  return query
}

export function supabaseMock({
  user = { id: 'user-1' },
  tables = {},
  storage = {},
}: {
  user?: { id: string } | null
  tables?: Record<string, ReturnType<typeof queryMock>>
  storage?: Record<string, jest.Mock>
} = {}) {
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user } })) },
    from: jest.fn((table: string) => {
      if (!tables[table]) throw new Error(`Unexpected query on table '${table}'`)
      return tables[table]
    }),
    storage: { from: jest.fn(() => storage) },
  }
}
