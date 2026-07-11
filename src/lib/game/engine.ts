import type { ChatProvider } from '@/lib/ai/types';
import type { ImageProvider } from '@/lib/images/types';
import type { GameState, StoryEntry, StructuredAiResponse } from './types';
import { createId, nowIso } from './defaults';
import { applyGameEvents, resolveSkillChecks, validateGameEvents } from './events';

function logTurnDiagnostic(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.info(`[AI Story RPG] ${message}`, details);
}

export async function playTurn(game: GameState, playerText: string, chat: ChatProvider, images: ImageProvider): Promise<GameState> {
  const timestamp = nowIso();
  const playerEntry: StoryEntry = { id: createId('entry'), kind: 'player', text: playerText, createdAt: timestamp };
  const gameWithPlayer = { ...game, story: [...game.story, playerEntry] };
  const storyText = await chat.continueNarrative({ game: gameWithPlayer, playerText });
  logTurnDiagnostic('Narrative im Spielzug empfangen', { storyTextLength: storyText.length, trimmedLength: storyText.trim().length });
  if (!storyText.trim()) throw new Error('Die Story-KI hat keinen Erzählertext geliefert. Der Spielzug wurde nicht ausgewertet, damit kein leerer Erzählerblock gespeichert wird.');
  let rules: StructuredAiResponse = { storyText: '', events: [] };
  let ruleFailure: string | undefined;

  try {
    rules = await chat.analyzeRules({ game: gameWithPlayer, playerText, storyText });
  } catch (err) {
    ruleFailure = err instanceof Error ? `Regelanalyse fehlgeschlagen: ${err.message}` : 'Regelanalyse fehlgeschlagen.';
  }

  const { events, invalidEvents: schemaInvalidEvents } = ruleFailure ? { events: [], invalidEvents: [] } : validateGameEvents(rules.events);
  const turnSeed = `${game.id}:${timestamp}:${playerText}`;
  const skillChecks = resolveSkillChecks(events, turnSeed);
  const applied = applyGameEvents(gameWithPlayer, events, turnSeed, skillChecks);
  const invalidEvents = [...schemaInvalidEvents, ...applied.invalidEvents, ...(ruleFailure ? [ruleFailure] : [])];
  const imageRequest = { shouldGenerate: false, prompt: storyText, involvedCharacterIds: rules.involvedCharacterIds, location: String(applied.game.status.location ?? ''), timeOfDay: String(applied.game.status.timeOfDay ?? ''), sceneSummary: storyText };
  const image = imageRequest.shouldGenerate ? await images.generate({ game: applied.game, imageRequest }) : undefined;
  const effectText = applied.effects.length ? `\n\n---\n**Auswirkungen dieses Zuges**\n${applied.effects.map((effect) => `- ${effect.message}`).join('\n')}` : '';
  const invalidText = invalidEvents.length ? `\n\n> System: ${invalidEvents.join(' ')}` : '';
  const aiEntry: StoryEntry = { id: createId('entry'), kind: 'ai', text: `${storyText}${effectText}${invalidText}`, structured: { ...rules, storyText }, image, effects: applied.effects, invalidEvents, skillChecks, createdAt: nowIso() };
  logTurnDiagnostic('AI-StoryEntry erstellt', { entryTextLength: aiEntry.text.length, storyTextLength: storyText.length, effects: applied.effects.length, invalidEvents: invalidEvents.length });
  return { ...applied.game, updatedAt: nowIso(), story: [...applied.game.story, aiEntry] };
}
