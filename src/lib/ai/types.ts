import type { GameState, SkillCheckResult, StoryTurnEffect, StructuredAiResponse } from '@/lib/game/types';

export interface ChatProviderConfig { provider: string; baseUrl?: string; apiKey?: string; model?: string; }
export interface StoryTurnRequest { game: GameState; playerText: string; }
export interface FinalizeStoryRequest { game: GameState; playerText: string; draft: StructuredAiResponse; skillChecks: SkillCheckResult[]; effects: StoryTurnEffect[]; invalidEvents: string[]; }
export interface ChatProvider { id: string; label: string; continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse>; finalizeStory(request: FinalizeStoryRequest): Promise<StructuredAiResponse>; }
