import type { GameState } from '@/lib/game/types';

export interface SaveGameSummary { id: string; name: string; updatedAt: string; }
export interface SaveGameStore { list(): Promise<SaveGameSummary[]>; save(game: GameState): Promise<void>; load(id: string): Promise<GameState | null>; delete(id: string): Promise<void>; }
const indexKey = 'ai-story-rpg:saves';
const gameKey = (id: string) => `ai-story-rpg:save:${id}`;

export class LocalJsonSaveGameStore implements SaveGameStore {
  async list() { return JSON.parse(localStorage.getItem(indexKey) ?? '[]') as SaveGameSummary[]; }
  async save(game: GameState) { const summary = { id: game.id, name: game.name, updatedAt: game.updatedAt }; const list = (await this.list()).filter((item) => item.id !== game.id); localStorage.setItem(gameKey(game.id), JSON.stringify(game, null, 2)); localStorage.setItem(indexKey, JSON.stringify([summary, ...list])); }
  async load(id: string) { const raw = localStorage.getItem(gameKey(id)); return raw ? JSON.parse(raw) as GameState : null; }
  async delete(id: string) { localStorage.removeItem(gameKey(id)); localStorage.setItem(indexKey, JSON.stringify((await this.list()).filter((item) => item.id !== id))); }
}
