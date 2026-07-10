import type { GameStatus } from './types';

export function mergeStatus(current: GameStatus, changes: GameStatus = {}): GameStatus {
  return { ...current, ...changes };
}
