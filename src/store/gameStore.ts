import { create } from 'zustand';
import type { Profile, Badge } from '../types/database';

// ---------------------------------------------------------------------------
// XP / Level configuration
// ---------------------------------------------------------------------------

/** XP required to reach each level (index = level, value = cumulative XP needed). */
const LEVEL_THRESHOLDS = [
  0,     // Level 1  — starting level
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  850,   // Level 5
  1300,  // Level 6
  1900,  // Level 7
  2650,  // Level 8
  3600,  // Level 9
  5000,  // Level 10 — max level
] as const;

const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/**
 * Derive the player level from total XP.
 * Level 1 is the minimum; returns MAX_LEVEL once the player exceeds the last threshold.
 */
export function xpToLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(level, MAX_LEVEL);
}

/**
 * XP required to advance to the *next* level from `currentLevel`.
 * Returns 0 if already at max level.
 */
export function xpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0;
  return LEVEL_THRESHOLDS[currentLevel] - LEVEL_THRESHOLDS[currentLevel - 1];
}

/**
 * XP progress within the current level (0 … xpForNextLevel(level)).
 */
export function xpProgressInLevel(xp: number, level: number): number {
  if (level >= MAX_LEVEL) return 0;
  const levelStart = LEVEL_THRESHOLDS[level - 1];
  return xp - levelStart;
}

// ---------------------------------------------------------------------------
// Phaser bridge — standard event protocol
// ---------------------------------------------------------------------------

export type PhaserEventType =
  | 'phaser-stage-complete'
  | 'phaser-xp-gain'
  | 'phaser-badge-earn'
  | 'phaser-scene-ready';

export interface PhaserEventPayload {
  type: PhaserEventType;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

export type XPSource = 'game' | 'project' | 'badge' | 'stage' | 'manual';

export interface GameState {
  // -- user data --
  userId: string | null;
  profile: Profile | null;

  // -- game progress --
  userXP: number;
  userLevel: number;
  completedStages: string[];
  earnedBadges: Badge[];

  // -- UI state --
  isLoading: boolean;
  error: string | null;
}

export interface GameActions {
  /** Initialise the store from a fetched profile. */
  setProfile: (profile: Profile) => void;

  /**
   * Award XP to the user.
   * Automatically recalculates level; fires a level-up event if the level changes.
   */
  gainXP: (amount: number, source: XPSource) => void;

  /** Mark a stage as completed and award its XP reward. */
  completeStage: (stageId: string, xpReward?: number) => void;

  /** Add a badge to the earned collection. */
  earnBadge: (badge: Badge) => void;

  /** Process an event dispatched by the Phaser game engine. */
  handlePhaserEvent: (event: PhaserEventPayload) => void;

  /** Reset game state (e.g. on sign-out). */
  reset: () => void;
}

export type GameStore = GameState & GameActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: GameState = {
  userId: null,
  profile: null,
  userXP: 0,
  userLevel: 1,
  completedStages: [],
  earnedBadges: [],
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

/**
 * Global game store powered by Zustand.
 *
 * **React components** — subscribe with selector:
 *   const { userXP, userLevel } = useGameStore((s) => ({ userXP: s.userXP, userLevel: s.userLevel }));
 *
 * **Phaser scenes** (outside React):
 *   useGameStore.getState().gainXP(50, 'game');
 */
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setProfile(profile) {
    const level = xpToLevel(profile.xp);
    set({
      userId: profile.id,
      profile,
      userXP: profile.xp,
      userLevel: level,
      error: null,
    });
  },

  gainXP(amount, source) {
    if (amount <= 0) return;
    const prevLevel = get().userLevel;
    const newXP = get().userXP + amount;
    const newLevel = xpToLevel(newXP);

    set({ userXP: newXP, userLevel: newLevel });

    if (newLevel > prevLevel) {
      // Dispatch a DOM event so any subscriber (including Phaser) can react
      window.dispatchEvent(
        new CustomEvent<PhaserEventPayload>('phaser-game', {
          detail: {
            type: 'phaser-xp-gain',
            payload: { amount, source, newXP, prevLevel, newLevel },
          },
        }),
      );
    }
  },

  completeStage(stageId, xpReward = 0) {
    if (get().completedStages.includes(stageId)) return;
    set((state) => ({
      completedStages: [...state.completedStages, stageId],
    }));
    if (xpReward > 0) {
      get().gainXP(xpReward, 'stage');
    }
  },

  earnBadge(badge) {
    const already = get().earnedBadges.some((b) => b.id === badge.id);
    if (already) return;
    set((state) => ({ earnedBadges: [...state.earnedBadges, badge] }));
    if (badge.xp_reward > 0) {
      get().gainXP(badge.xp_reward, 'badge');
    }
  },

  handlePhaserEvent({ type, payload }) {
    switch (type) {
      case 'phaser-stage-complete': {
        const stageId = payload['stageId'] as string | undefined;
        const xpReward = (payload['xpReward'] as number | undefined) ?? 0;
        if (stageId) get().completeStage(stageId, xpReward);
        break;
      }
      case 'phaser-xp-gain': {
        const amount = (payload['amount'] as number | undefined) ?? 0;
        const source = (payload['source'] as XPSource | undefined) ?? 'game';
        get().gainXP(amount, source);
        break;
      }
      case 'phaser-badge-earn': {
        const badge = payload['badge'] as Badge | undefined;
        if (badge) get().earnBadge(badge);
        break;
      }
      default:
        break;
    }
  },

  reset() {
    set((state) => ({ ...state, ...initialState }));
  },
}));

// ---------------------------------------------------------------------------
// Phaser bridge — global event listener (set up once at app entry point)
// ---------------------------------------------------------------------------

/**
 * Attach a global `phaser-game` DOM event listener that feeds events into the
 * Zustand store.  Call this once in your app entry point (e.g. `main.tsx`).
 *
 * Returns a cleanup function that removes the listener.
 */
export function initPhaserBridge(): () => void {
  function handler(event: Event) {
    const customEvent = event as CustomEvent<PhaserEventPayload>;
    useGameStore.getState().handlePhaserEvent(customEvent.detail);
  }
  window.addEventListener('phaser-game', handler);
  return () => window.removeEventListener('phaser-game', handler);
}
