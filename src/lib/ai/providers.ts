import { z } from 'zod';
import { buildStoryPrompt } from './prompt';
import type { ChatProvider, ChatProviderConfig, ChatResponseFormatType, FinalizeStoryRequest, StoryTurnRequest } from './types';
import type { StructuredAiResponse } from '@/lib/game/types';

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]));
const imageRequestSchema = z.object({ shouldGenerate: z.boolean(), prompt: z.string().optional(), involvedCharacterIds: z.array(z.string()).optional(), location: z.string().optional(), timeOfDay: z.string().optional(), sceneSummary: z.string().optional() });

export function cleanAiJsonContent(content: string): string {
  let cleaned = content.trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) cleaned = fenced[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
  return cleaned;
}

function parseAiJsonContent<T>(content: string, parse: (value: unknown) => T, label: string): T {
  const cleaned = cleanAiJsonContent(content);
  try {
    return parse(JSON.parse(cleaned));
  } catch (err) {
    const preview = cleaned.length > 500 ? `${cleaned.slice(0, 500)}…` : cleaned;
    throw new Error(`${label} ist kein gültiges JSON im erwarteten Format: ${err instanceof Error ? err.message : 'Unbekannter Parserfehler'}. Bereinigter Inhalt: ${preview}`);
  }
}

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
  private headers(): Record<string, string> {
    return this.config.apiKey ? { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` } : { 'Content-Type': 'application/json' };
  }
  private model() {
    return this.config.model?.trim() || 'local-model';
  }
  private chatUrl() {
    const baseUrl = this.config.baseUrl?.trim();
    if (!baseUrl || baseUrl.includes('localhost:1234') || baseUrl.includes('127.0.0.1:1234')) return '/api/ai/chat';
    if (baseUrl.startsWith('/')) return baseUrl;
    return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  }
  private responseFormatType(): ChatResponseFormatType {
    const baseUrl = this.config.baseUrl?.trim();
    if (this.config.responseFormatType) return this.config.responseFormatType;
    if (!baseUrl || baseUrl.includes('localhost:1234') || baseUrl.includes('127.0.0.1:1234')) return 'text';
    return 'json_object';
  }
  async continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse> {
    const response = await fetch(this.chatUrl(), {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: this.model(), response_format: { type: this.responseFormatType() }, messages: [{ role: 'system', content: 'Du bist eine RPG-Spielleitung. Liefere valides JSON mit storyText und events. Bestimme keine Würfelergebnisse selbst.' }, { role: 'user', content: buildStoryPrompt(request.game, request.playerText) }] }),
    });
    if (!response.ok) throw new Error(`KI-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseAiJsonContent(data.choices?.[0]?.message?.content ?? '{}', (value) => responseSchema.parse(value) as StructuredAiResponse, 'KI-Antwort');
  }
  async finalizeStory(request: FinalizeStoryRequest): Promise<StructuredAiResponse> {
    const response = await fetch(this.chatUrl(), {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: this.model(), response_format: { type: this.responseFormatType() }, messages: [{ role: 'system', content: 'Formuliere den endgültigen Storytext nach den bereits ausgewerteten Würfeln und Regelereignissen. Liefere JSON mit storyText.' }, { role: 'user', content: `Spielerhandlung: ${request.playerText}\nEntwurf: ${request.draft.storyText}\nSkill Checks: ${JSON.stringify(request.skillChecks)}\nAuswirkungen: ${JSON.stringify(request.effects)}\nUngültige Events: ${JSON.stringify(request.invalidEvents)}` }] }),
    });
    if (!response.ok) throw new Error(`KI-Finalisierung fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseAiJsonContent(data.choices?.[0]?.message?.content ?? '{}', (value) => responseSchema.pick({ storyText: true }).parse(value) as StructuredAiResponse, 'Finale KI-Antwort');
  }
}

export function createChatProvider(config?: ChatProviderConfig): ChatProvider {
  const provider = config?.provider ?? process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'mock';
  if (provider === 'openai-compatible') return new OpenAiCompatibleChatProvider({ provider, baseUrl: config?.baseUrl ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL, apiKey: config?.apiKey ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY, model: config?.model ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL, responseFormatType: config?.responseFormatType });
  return new MockChatProvider();
}
