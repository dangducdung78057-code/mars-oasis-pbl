import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import GameHeader from '../components/game/GameHeader';

/**
 * Main game page.
 *
 * All game state is owned by `useGameStore` — no props drilling required.
 * Phaser scenes communicate via `window.dispatchEvent('phaser-game', ...)`.
 */
export default function Game() {
  const setProfile = useGameStore((s) => s.setProfile);
  const isLoading = useGameStore((s) => s.isLoading);

  // In a real app this would be replaced by a profile fetch via useQuery('profiles').
  // Shown here as a minimal bootstrap to demonstrate zero props drilling.
  useEffect(() => {
    // Simulate loading the current user's profile from Supabase.
    // Replace with actual auth + profile fetch in production.
    setProfile({
      id: 'demo-user',
      username: 'mars_explorer',
      display_name: 'Mars Explorer',
      avatar_url: null,
      xp: 0,
      level: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }, [setProfile]);

  if (isLoading) {
    return <div className="game-loading">Loading…</div>;
  }

  return (
    <div className="game-page">
      <GameHeader />
      {/* Phaser canvas will be mounted here by the game engine */}
      <div id="phaser-container" className="game-canvas" />
    </div>
  );
}
