import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';
import type { GameState, StoryEntry } from './types';
import { createId, nowIso } from './defaults';
import { applyInventoryChanges } from './inventory';
import { mergeStatus } from './status';

export async function playTurn(game: GameState, playerText: string, chat: ChatProvider, images: ImageProvider): Promise<GameState> {
  const timestamp = nowIso();
  const playerEntry: StoryEntry = { id: createId('entry'), kind: 'player', text: playerText, createdAt: timestamp };
  const gameWithPlayer = { ...game, story: [...game.story, playerEntry] };
  const structured = await chat.continueStory({ game: gameWithPlayer, playerText });
  const image = structured.imageRequest?.shouldGenerate ? await images.generate({ game: gameWithPlayer, imageRequest: structured.imageRequest }) : undefined;
  const aiEntry: StoryEntry = { id: createId('entry'), kind: 'ai', text: structured.storyText, structured, image, createdAt: nowIso() };
  return { ...gameWithPlayer, updatedAt: nowIso(), story: [...gameWithPlayer.story, aiEntry], inventory: applyInventoryChanges(game.inventory, structured.inventoryChanges), status: mergeStatus(game.status, { ...structured.statusChanges, ...(structured.location ? { location: structured.location } : {}) }) };
}
