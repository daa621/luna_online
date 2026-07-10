import { z } from 'zod';
import { buildNarrativePrompt, buildRuleAnalysisPrompt } from './prompt';
import type { ChatProvider, ChatProviderConfig, ChatResponseFormatType, FinalizeStoryRequest, NarrativeRequest, RuleAnalysisRequest, StoryTurnRequest } from './types';
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
  async continueNarrative({ playerText, game }: NarrativeRequest): Promise<string> {
    return `**${game.setup.protagonist.name || 'Du'}** handelst entschlossen: „${playerText}“.

Die Welt reagiert spürbar. Ein neuer erzählerischer Faden öffnet sich, während die Spielleitung im Mock-Modus läuft.`;
  }
  async analyzeRules({ playerText }: RuleAnalysisRequest): Promise<StructuredAiResponse> {
    const wantsCheck = /kletter|schleich|überred|kämpf|suche/i.test(playerText);
    return { storyText: '', events: [{ type: 'status_changed', key: 'mood', value: 'angespannt', reason: 'Mock-Fortschritt' }, ...(wantsCheck ? [{ type: 'skill_check', id: 'main_check', skill: 'Abenteuer', difficulty: 12, modifier: 2, reason: playerText }] : [])] };
  }
  async continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse> {
    return { storyText: await this.continueNarrative(request), events: (await this.analyzeRules({ ...request, storyText: '' })).events };
  }
  async finalizeStory({ playerText, game, skillChecks }: FinalizeStoryRequest): Promise<StructuredAiResponse> {
    const checkSummary = skillChecks.length ? `

Würfelergebnis: ${skillChecks.map((check) => `${check.skill} ${check.success ? 'gelingt' : 'misslingt'} (${check.total}/${check.difficulty})`).join(', ')}.` : '';
    return { storyText: `**${game.setup.protagonist.name || 'Du'}** handelst entschlossen: „${playerText}“.

Die Welt reagiert auf das regelkonform ausgewertete Ergebnis.${checkSummary}` };
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
  private async chatCompletion(messages: Array<{ role: 'system' | 'user'; content: string }>, responseFormatType: ChatResponseFormatType) {
    const response = await fetch(this.chatUrl(), {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: this.model(), response_format: { type: responseFormatType }, messages }),
    });
    if (!response.ok) throw new Error(`KI-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
  async continueNarrative(request: NarrativeRequest): Promise<string> {
    return this.chatCompletion([{ role: 'system', content: 'Du bist ein Erzähler. Schreibe nur Prosa oder Markdown, niemals JSON und keine Regelbegriffe.' }, { role: 'user', content: buildNarrativePrompt(request.game, request.playerText) }], 'text');
  }
  async analyzeRules(request: RuleAnalysisRequest): Promise<StructuredAiResponse> {
    const content = await this.chatCompletion([{ role: 'system', content: 'Du bist ein Regelanalyst. Antworte ausschließlich als JSON {"events":[...]} ohne Markdown.' }, { role: 'user', content: buildRuleAnalysisPrompt(request.game, request.playerText, request.storyText) }], this.responseFormatType());
    return parseAiJsonContent(content, (value) => responseSchema.pick({ events: true }).parse(value) as StructuredAiResponse, 'Regel-KI-Antwort');
  }
  async continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse> {
    const storyText = await this.continueNarrative(request);
    return { ...(await this.analyzeRules({ ...request, storyText })), storyText };
  }
  async finalizeStory(request: FinalizeStoryRequest): Promise<StructuredAiResponse> {
    return { storyText: request.draft.storyText };
  }
}

export function createChatProvider(config?: ChatProviderConfig): ChatProvider {
  const provider = config?.provider ?? process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'mock';
  if (provider === 'openai-compatible') return new OpenAiCompatibleChatProvider({ provider, baseUrl: config?.baseUrl ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL, apiKey: config?.apiKey ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY, model: config?.model ?? process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL, responseFormatType: config?.responseFormatType });
  return new MockChatProvider();
}
