import { z } from 'zod';
import { buildStoryPrompt } from './prompt';
import type { ChatProvider, ChatProviderConfig, FinalizeStoryRequest, StoryTurnRequest } from './types';
import type { StructuredAiResponse } from '@/lib/game/types';

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]));
const imageRequestSchema = z.object({ shouldGenerate: z.boolean(), prompt: z.string().optional(), involvedCharacterIds: z.array(z.string()).optional(), location: z.string().optional(), timeOfDay: z.string().optional(), sceneSummary: z.string().optional() });
const responseSchema = z.object({
  storyText: z.string(),
  events: z.array(z.unknown()).optional(),
  inventoryChanges: z.array(z.object({ operation: z.enum(['add', 'remove', 'setQuantity', 'update']), item: z.object({ id: z.string().optional(), name: z.string(), description: z.string().optional(), quantity: z.number().optional(), category: z.string().optional(), attributes: z.record(z.string(), jsonValueSchema).optional() }), quantityDelta: z.number().optional() })).optional(),
  statusChanges: z.record(z.string(), jsonValueSchema).optional(),
  questChanges: z.record(z.string(), jsonValueSchema).optional(),
  location: z.string().optional(),
  involvedCharacterIds: z.array(z.string()).optional(),
  imageRequest: imageRequestSchema.optional(),
});

export class MockChatProvider implements ChatProvider {
  id = 'mock'; label = 'Mock Storyteller';
  async continueStory({ playerText, game }: StoryTurnRequest): Promise<StructuredAiResponse> {
    const wantsCheck = /kletter|schleich|überred|kämpf|suche/i.test(playerText);
    return { storyText: `Entwurf: ${game.setup.protagonist.name || 'Du'} versucht: „${playerText}“.`, events: [{ type: 'status_changed', key: 'mood', value: 'angespannt', reason: 'Mock-Fortschritt' }, ...(wantsCheck ? [{ type: 'skill_check', id: 'main_check', skill: 'Abenteuer', difficulty: 12, modifier: 2, reason: playerText }, { type: 'item_added', name: 'Erkenntnis', description: 'Eine aus dem gelungenen Versuch gewonnene Einsicht.', quantity: 1, category: 'Hinweis', requiresSkillCheck: { skillCheckId: 'main_check', outcome: 'success' } }] : [])], imageRequest: { shouldGenerate: playerText.toLowerCase().includes('bild'), prompt: `Dramatische RPG-Szene: ${playerText}`, involvedCharacterIds: [game.setup.protagonist.id], location: String(game.status.location ?? ''), timeOfDay: String(game.status.timeOfDay ?? ''), sceneSummary: playerText } };
  }
  async finalizeStory({ playerText, game, skillChecks }: FinalizeStoryRequest): Promise<StructuredAiResponse> {
    const checkSummary = skillChecks.length ? `\n\nWürfelergebnis: ${skillChecks.map((check) => `${check.skill} ${check.success ? 'gelingt' : 'misslingt'} (${check.total}/${check.difficulty})`).join(', ')}.` : '';
    return { storyText: `**${game.setup.protagonist.name || 'Du'}** handelst entschlossen: „${playerText}“.\n\nDie Welt reagiert auf das regelkonform ausgewertete Ergebnis.${checkSummary}` };
  }
}

export class OpenAiCompatibleChatProvider implements ChatProvider {
  id = 'openai-compatible'; label = 'OpenAI-kompatibel';
  constructor(private readonly config: ChatProviderConfig) {}
  async continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse> {
    // Browser-exposed NEXT_PUBLIC keys are acceptable only for local experiments. Production use needs a server-side proxy.
    if (!this.config.apiKey) throw new Error('Kein API-Schlüssel konfiguriert. Setze NEXT_PUBLIC_OPENAI_COMPAT_API_KEY nur für lokale Tests oder nutze den Mock-Provider.');
    const response = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.model ?? 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Du bist eine RPG-Spielleitung. Liefere valides JSON mit storyText und events. Bestimme keine Würfelergebnisse selbst.' }, { role: 'user', content: buildStoryPrompt(request.game, request.playerText) }] }),
    });
    if (!response.ok) throw new Error(`KI-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return responseSchema.parse(JSON.parse(data.choices?.[0]?.message?.content ?? '{}')) as StructuredAiResponse;
  }
  async finalizeStory(request: FinalizeStoryRequest): Promise<StructuredAiResponse> {
    if (!this.config.apiKey) throw new Error('Kein API-Schlüssel konfiguriert. Setze NEXT_PUBLIC_OPENAI_COMPAT_API_KEY nur für lokale Tests oder nutze den Mock-Provider.');
    const response = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.model ?? 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Formuliere den endgültigen Storytext nach den bereits ausgewerteten Würfeln und Regelereignissen. Liefere JSON mit storyText.' }, { role: 'user', content: `Spielerhandlung: ${request.playerText}\nEntwurf: ${request.draft.storyText}\nSkill Checks: ${JSON.stringify(request.skillChecks)}\nAuswirkungen: ${JSON.stringify(request.effects)}\nUngültige Events: ${JSON.stringify(request.invalidEvents)}` }] }),
    });
    if (!response.ok) throw new Error(`KI-Finalisierung fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return responseSchema.pick({ storyText: true }).parse(JSON.parse(data.choices?.[0]?.message?.content ?? '{}')) as StructuredAiResponse;
  }
}

export function createChatProvider(): ChatProvider {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'mock';
  if (provider === 'openai-compatible') return new OpenAiCompatibleChatProvider({ provider, baseUrl: process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL, apiKey: process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY, model: process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL });
  return new MockChatProvider();
}
