import type { GameState, SkillCheckResult, StoryTurnEffect, StructuredAiResponse } from '@/lib/game/types';

export type ChatResponseFormatType = 'text' | 'json_object' | 'json_schema';
export interface ChatProviderConfig { provider: string; baseUrl?: string; apiKey?: string; model?: string; responseFormatType?: ChatResponseFormatType; }
export interface StoryTurnRequest { game: GameState; playerText: string; }
export type NarrativeRequest = StoryTurnRequest;
export interface RuleAnalysisRequest extends StoryTurnRequest { storyText: string; }
export interface FinalizeStoryRequest { game: GameState; playerText: string; draft: StructuredAiResponse; skillChecks: SkillCheckResult[]; effects: StoryTurnEffect[]; invalidEvents: string[]; }
export interface ChatProvider {
  id: string;
  label: string;
  continueNarrative(request: NarrativeRequest): Promise<string>;
  analyzeRules(request: RuleAnalysisRequest): Promise<StructuredAiResponse>;
  /** @deprecated Use continueNarrative + analyzeRules. */
  continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse>;
  /** @deprecated Finalization is no longer part of the turn loop. */
  finalizeStory(request: FinalizeStoryRequest): Promise<StructuredAiResponse>;
}
