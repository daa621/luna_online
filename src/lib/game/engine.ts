import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';
import type { GameState, StoryEntry } from './types';
import { createId, nowIso } from './defaults';
import { applyGameEvents, resolveSkillChecks, validateGameEvents } from './events';

export async function playTurn(game: GameState, playerText: string, chat: ChatProvider, images: ImageProvider): Promise<GameState> {
  const timestamp = nowIso();
  const playerEntry: StoryEntry = { id: createId('entry'), kind: 'player', text: playerText, createdAt: timestamp };
  const gameWithPlayer = { ...game, story: [...game.story, playerEntry] };
  const draft = await chat.continueStory({ game: gameWithPlayer, playerText });
  const { events, invalidEvents: schemaInvalidEvents } = validateGameEvents(draft.events);
  const turnSeed = `${game.id}:${timestamp}:${playerText}`;
  const skillChecks = resolveSkillChecks(events, turnSeed);
  const applied = applyGameEvents(gameWithPlayer, events, turnSeed, skillChecks);
  const invalidEvents = [...schemaInvalidEvents, ...applied.invalidEvents];
  const final = await chat.finalizeStory({ game: applied.game, playerText, draft, skillChecks, effects: applied.effects, invalidEvents });
  const imageRequest = draft.imageRequest ? { ...draft.imageRequest, location: String(applied.game.status.location ?? ''), timeOfDay: String(applied.game.status.timeOfDay ?? ''), sceneSummary: final.storyText } : undefined;
  const image = imageRequest?.shouldGenerate ? await images.generate({ game: applied.game, imageRequest }) : undefined;
  const effectText = applied.effects.length ? `\n\n---\n**Auswirkungen dieses Zuges**\n${applied.effects.map((effect) => `- ${effect.message}`).join('\n')}` : '';
  const invalidText = invalidEvents.length ? `\n\n> System: ${invalidEvents.length} ungültige Ereignis(se) wurden verworfen.` : '';
  const aiEntry: StoryEntry = { id: createId('entry'), kind: 'ai', text: `${final.storyText}${effectText}${invalidText}`, structured: { ...draft, storyText: final.storyText }, image, effects: applied.effects, invalidEvents, skillChecks, createdAt: nowIso() };
  return { ...applied.game, updatedAt: nowIso(), story: [...applied.game.story, aiEntry] };
}
