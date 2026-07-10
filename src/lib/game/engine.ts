import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';
import type { GameState, StoryEntry } from './types';
import { createId, nowIso } from './defaults';
import { applyGameEvents, validateGameEvents } from './events';

export async function playTurn(game: GameState, playerText: string, chat: ChatProvider, images: ImageProvider): Promise<GameState> {
  const timestamp = nowIso();
  const playerEntry: StoryEntry = { id: createId('entry'), kind: 'player', text: playerText, createdAt: timestamp };
  const gameWithPlayer = { ...game, story: [...game.story, playerEntry] };
  const structured = await chat.continueStory({ game: gameWithPlayer, playerText });
  const { events, invalidEvents: schemaInvalidEvents } = validateGameEvents(structured.events);
  const applied = applyGameEvents(gameWithPlayer, events, `${game.id}:${timestamp}:${playerText}`);
  const invalidEvents = [...schemaInvalidEvents, ...applied.invalidEvents];
  const imageRequest = structured.imageRequest ? { ...structured.imageRequest, location: String(applied.game.status.location ?? ''), timeOfDay: String(applied.game.status.timeOfDay ?? ''), sceneSummary: structured.storyText } : undefined;
  const image = imageRequest?.shouldGenerate ? await images.generate({ game: applied.game, imageRequest }) : undefined;
  const effectText = applied.effects.length ? `\n\n---\n**Auswirkungen dieses Zuges**\n${applied.effects.map((effect) => `- ${effect.message}`).join('\n')}` : '';
  const invalidText = invalidEvents.length ? `\n\n> System: ${invalidEvents.length} ungültige Ereignis(se) wurden verworfen.` : '';
  const aiEntry: StoryEntry = { id: createId('entry'), kind: 'ai', text: `${structured.storyText}${effectText}${invalidText}`, structured, image, effects: applied.effects, invalidEvents, skillChecks: applied.skillChecks, createdAt: nowIso() };
  return { ...applied.game, updatedAt: nowIso(), story: [...applied.game.story, aiEntry] };
}
