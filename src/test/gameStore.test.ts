import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGameStore,
  xpToLevel,
  xpForNextLevel,
  xpProgressInLevel,
} from '../store/gameStore'
import type { Badge } from '../types/database'

// Reset the store before every test
beforeEach(() => {
  useGameStore.getState().reset()
})

// ---------------------------------------------------------------------------
// xpToLevel helper
// ---------------------------------------------------------------------------
describe('xpToLevel', () => {
  it('returns level 1 for 0 XP', () => {
    expect(xpToLevel(0)).toBe(1)
  })

  it('returns level 2 at exactly 100 XP', () => {
    expect(xpToLevel(100)).toBe(2)
  })

  it('returns level 2 for 99 XP (below threshold)', () => {
    expect(xpToLevel(99)).toBe(1)
  })

  it('returns level 3 at 250 XP', () => {
    expect(xpToLevel(250)).toBe(3)
  })

  it('returns max level (10) for very high XP', () => {
    expect(xpToLevel(99999)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// xpForNextLevel helper
// ---------------------------------------------------------------------------
describe('xpForNextLevel', () => {
  it('returns a positive number for level 1', () => {
    expect(xpForNextLevel(1)).toBeGreaterThan(0)
  })

  it('returns 0 at max level', () => {
    expect(xpForNextLevel(10)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// xpProgressInLevel helper
// ---------------------------------------------------------------------------
describe('xpProgressInLevel', () => {
  it('returns 0 XP progress at level 1 start', () => {
    expect(xpProgressInLevel(0, 1)).toBe(0)
  })

  it('returns correct progress within level 2', () => {
    // Level 2 starts at 100 XP; 150 XP means 50 XP into level 2
    expect(xpProgressInLevel(150, 2)).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// useGameStore — gainXP
// ---------------------------------------------------------------------------
describe('useGameStore – gainXP', () => {
  it('accumulates XP', () => {
    useGameStore.getState().gainXP(50, 'game')
    useGameStore.getState().gainXP(30, 'project')
    expect(useGameStore.getState().userXP).toBe(80)
  })

  it('ignores zero or negative XP', () => {
    useGameStore.getState().gainXP(0, 'game')
    useGameStore.getState().gainXP(-10, 'game')
    expect(useGameStore.getState().userXP).toBe(0)
  })

  it('upgrades level when XP crosses a threshold', () => {
    useGameStore.getState().gainXP(100, 'game')
    expect(useGameStore.getState().userLevel).toBe(2)
  })

  it('does not downgrade level if XP is insufficient', () => {
    useGameStore.getState().gainXP(90, 'game')
    expect(useGameStore.getState().userLevel).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// useGameStore — completeStage
// ---------------------------------------------------------------------------
describe('useGameStore – completeStage', () => {
  it('adds stage to completedStages', () => {
    useGameStore.getState().completeStage('stage-1', 50)
    expect(useGameStore.getState().completedStages).toContain('stage-1')
  })

  it('awards XP when completing a stage', () => {
    useGameStore.getState().completeStage('stage-2', 75)
    expect(useGameStore.getState().userXP).toBe(75)
  })

  it('does not duplicate a completed stage', () => {
    useGameStore.getState().completeStage('stage-3', 25)
    useGameStore.getState().completeStage('stage-3', 25)
    expect(useGameStore.getState().completedStages.filter((s) => s === 'stage-3')).toHaveLength(1)
    expect(useGameStore.getState().userXP).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// useGameStore — earnBadge
// ---------------------------------------------------------------------------
describe('useGameStore – earnBadge', () => {
  const badge: Badge = {
    id: 'badge-1',
    name: 'Explorer',
    description: 'First steps',
    icon_url: null,
    xp_reward: 30,
    created_at: new Date().toISOString(),
  }

  it('adds badge to earnedBadges', () => {
    useGameStore.getState().earnBadge(badge)
    expect(useGameStore.getState().earnedBadges).toHaveLength(1)
    expect(useGameStore.getState().earnedBadges[0].id).toBe('badge-1')
  })

  it('awards xp_reward when earning a badge', () => {
    useGameStore.getState().earnBadge(badge)
    expect(useGameStore.getState().userXP).toBe(30)
  })

  it('does not duplicate a badge', () => {
    useGameStore.getState().earnBadge(badge)
    useGameStore.getState().earnBadge(badge)
    expect(useGameStore.getState().earnedBadges).toHaveLength(1)
    expect(useGameStore.getState().userXP).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// useGameStore — handlePhaserEvent
// ---------------------------------------------------------------------------
describe('useGameStore – handlePhaserEvent', () => {
  it('handles phaser-xp-gain event', () => {
    useGameStore.getState().handlePhaserEvent({
      type: 'phaser-xp-gain',
      payload: { amount: 40, source: 'game' },
    })
    expect(useGameStore.getState().userXP).toBe(40)
  })

  it('handles phaser-stage-complete event', () => {
    useGameStore.getState().handlePhaserEvent({
      type: 'phaser-stage-complete',
      payload: { stageId: 'stage-phaser', xpReward: 60 },
    })
    expect(useGameStore.getState().completedStages).toContain('stage-phaser')
    expect(useGameStore.getState().userXP).toBe(60)
  })

  it('handles unknown event types gracefully', () => {
    expect(() =>
      useGameStore.getState().handlePhaserEvent({
        type: 'phaser-scene-ready',
        payload: {},
      }),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// useGameStore — setProfile
// ---------------------------------------------------------------------------
describe('useGameStore – setProfile', () => {
  it('sets userId, XP and level from profile', () => {
    useGameStore.getState().setProfile({
      id: 'user-42',
      username: 'astro',
      display_name: 'Astro',
      avatar_url: null,
      xp: 250,
      level: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    const state = useGameStore.getState()
    expect(state.userId).toBe('user-42')
    expect(state.userXP).toBe(250)
    expect(state.userLevel).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// useGameStore — reset
// ---------------------------------------------------------------------------
describe('useGameStore – reset', () => {
  it('clears all state back to initial values', () => {
    useGameStore.getState().gainXP(500, 'game')
    useGameStore.getState().completeStage('s1', 10)
    useGameStore.getState().reset()

    const state = useGameStore.getState()
    expect(state.userXP).toBe(0)
    expect(state.userLevel).toBe(1)
    expect(state.completedStages).toHaveLength(0)
  })
})
