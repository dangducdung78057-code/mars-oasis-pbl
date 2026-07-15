import { describe, it, expect } from 'vitest'
import { createMockSupabase } from '../lib/supabase-mock'
import type { Badge } from '../types/database'

const sampleBadges: Badge[] = [
  {
    id: 'b1',
    name: 'Explorer',
    description: 'First steps',
    icon_url: null,
    xp_reward: 10,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'b2',
    name: 'Builder',
    description: 'Created first project',
    icon_url: null,
    xp_reward: 25,
    created_at: '2024-01-02T00:00:00Z',
  },
]

describe('createMockSupabase', () => {
  it('returns all rows with select()', async () => {
    const mock = createMockSupabase({ badges: sampleBadges })
    const { data, error } = await mock.from('badges').select()
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('filters rows with .eq()', async () => {
    const mock = createMockSupabase({ badges: sampleBadges })
    const { data, error } = await (mock
      .from('badges')
      .select() as unknown as { eq: (c: string, v: unknown) => Promise<{ data: Badge[]; error: null }> })
      .eq('id', 'b1')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].name).toBe('Explorer')
  })

  it('inserts a new row', async () => {
    const mock = createMockSupabase({ badges: [] as Badge[] })
    await mock.from('badges').insert({
      name: 'Pioneer',
      description: null,
      icon_url: null,
      xp_reward: 50,
      created_at: new Date().toISOString(),
    })
    const { data } = await mock.from('badges').select()
    expect(data).toHaveLength(1)
    expect((data as Badge[])[0].name).toBe('Pioneer')
  })

  it('returns empty array when table has no data', async () => {
    const mock = createMockSupabase()
    const { data, error } = await mock.from('badges').select()
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})
