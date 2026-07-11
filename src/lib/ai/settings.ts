import type { ChatProviderConfig, InferenceParameters } from './types';

export type AiProviderKind = 'mock' | 'openai-compatible';
export interface AiSettings extends ChatProviderConfig { provider: AiProviderKind; }

export const defaultNarrativeInference: InferenceParameters = { temperature: 0.65, top_p: 0.9, max_tokens: 900, frequency_penalty: 0.2, presence_penalty: 0.1 };
export const defaultRuleInference: InferenceParameters = { temperature: 0.1, top_p: 0.8, max_tokens: 300, frequency_penalty: 0, presence_penalty: 0 };

export const lmStudioDefaults: AiSettings = { provider: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: process.env.NEXT_PUBLIC_OPENAI_COMPAT_MODEL ?? '', apiKey: process.env.NEXT_PUBLIC_OPENAI_COMPAT_API_KEY ?? '', responseFormatType: 'text', narrativeInference: defaultNarrativeInference, ruleInference: defaultRuleInference };
export const mockDefaults: AiSettings = { provider: 'mock', model: 'mock-storyteller' };

export function createDefaultAiSettings(): AiSettings {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER === 'openai-compatible' ? 'openai-compatible' : 'mock';
  if (provider === 'openai-compatible') return { ...lmStudioDefaults, baseUrl: process.env.NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL ?? lmStudioDefaults.baseUrl };
  return mockDefaults;
}
