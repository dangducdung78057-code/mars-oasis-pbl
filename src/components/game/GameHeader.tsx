import { useGameStore } from '../../store/gameStore';
import { xpForNextLevel, xpProgressInLevel } from '../../store/gameStore';

/**
 * Game HUD header — reads entirely from the global game store.
 * No props required; no prop drilling.
 */
export default function GameHeader() {
  const userXP = useGameStore((s) => s.userXP);
  const userLevel = useGameStore((s) => s.userLevel);
  const displayName = useGameStore((s) => s.profile?.display_name ?? 'Explorer');
  const badgeCount = useGameStore((s) => s.earnedBadges.length);

  const progressXP = xpProgressInLevel(userXP, userLevel);
  const neededXP = xpForNextLevel(userLevel);
  const progressPct = neededXP > 0 ? Math.round((progressXP / neededXP) * 100) : 100;

  return (
    <header className="game-header">
      <div className="game-header__player">
        <span className="game-header__name">{displayName}</span>
        <span className="game-header__level">Lv.{userLevel}</span>
      </div>

      <div className="game-header__xp">
        <div
          className="game-header__xp-bar"
          role="progressbar"
          aria-valuenow={progressXP}
          aria-valuemin={0}
          aria-valuemax={neededXP}
          aria-label="XP progress"
        >
          <div
            className="game-header__xp-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="game-header__xp-text">
          {userXP} XP {neededXP > 0 ? `(+${neededXP - progressXP} to next)` : '(Max level)'}
        </span>
      </div>

      <div className="game-header__badges">
        🏅 {badgeCount}
      </div>
    </header>
  );
}
