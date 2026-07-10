import type { ChatProviderConfig } from './types';

export type AiProviderKind = 'mock' | 'openai-compatible';
export interface AiSettings extends ChatProviderConfig { provider: AiProviderKind; }

export const lmStudioDefaults: AiSettings = { provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL ?? '', apiKey: process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY ?? '' };
export const mockDefaults: AiSettings = { provider: 'mock', model: 'mock-storyteller' };

export function createDefaultAiSettings(): AiSettings {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER === 'openai-compatible' ? 'openai-compatible' : 'mock';
  if (provider === 'openai-compatible') return { ...lmStudioDefaults, baseUrl: process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL ?? lmStudioDefaults.baseUrl };
  return mockDefaults;
}
