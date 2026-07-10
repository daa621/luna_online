import { z } from 'zod';
import { buildStoryPrompt } from './prompt';
import type { ChatProvider, ChatProviderConfig, StoryTurnRequest } from './types';
import type { StructuredAiResponse } from '@/lib/game/types';

const responseSchema = z.object({
  storyText: z.string(),
  inventoryChanges: z.array(z.any()).optional(),
  statusChanges: z.record(z.string(), z.any()).optional(),
  questChanges: z.record(z.string(), z.any()).optional(),
  location: z.string().optional(),
  involvedCharacterIds: z.array(z.string()).optional(),
  imageRequest: z.object({ shouldGenerate: z.boolean(), prompt: z.string().optional(), involvedCharacterIds: z.array(z.string()).optional() }).optional(),
});

export class MockChatProvider implements ChatProvider {
  id = 'mock'; label = 'Mock Storyteller';
  async continueStory({ playerText, game }: StoryTurnRequest): Promise<StructuredAiResponse> {
    return { storyText: `**${game.setup.protagonist.name || 'Du'}** handelst entschlossen: „${playerText}“.\n\nDie Welt reagiert spürbar. Ein neuer erzählerischer Faden öffnet sich, während die Spielleitung im Mock-Modus läuft.`, statusChanges: { lastAction: playerText }, imageRequest: { shouldGenerate: playerText.toLowerCase().includes('bild'), prompt: `Dramatische RPG-Szene: ${playerText}`, involvedCharacterIds: [game.setup.protagonist.id] } };
  }
}

export class OpenAiCompatibleChatProvider implements ChatProvider {
  id = 'openai-compatible'; label = 'OpenAI-kompatibel';
  constructor(private readonly config: ChatProviderConfig) {}
  async continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse> {
    if (!this.config.apiKey) throw new Error('Kein API-Schlüssel konfiguriert. Setze NEXT_PUBLIC_OPENAI_COMPAT_API_KEY oder nutze den Mock-Provider.');
    const response = await fetch(`${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ model: this.config.model ?? 'gpt-4.1-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Du bist eine RPG-Spielleitung. Liefere valides JSON passend zum angeforderten Schema.' }, { role: 'user', content: buildStoryPrompt(request.game, request.playerText) }] }),
    });
    if (!response.ok) throw new Error(`KI-Anfrage fehlgeschlagen (${response.status}): ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return responseSchema.parse(JSON.parse(data.choices?.[0]?.message?.content ?? '{}'));
  }
}

export function createChatProvider(): ChatProvider {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'mock';
  if (provider === 'openai-compatible') return new OpenAiCompatibleChatProvider({ provider, baseUrl: process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL, apiKey: process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY, model: process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL });
  return new MockChatProvider();
}
