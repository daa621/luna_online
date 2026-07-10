import type { GameState, StructuredAiResponse } from '@/lib/game/types';

export interface ChatProviderConfig { provider: string; baseUrl?: string; apiKey?: string; model?: string; }
export interface StoryTurnRequest { game: GameState; playerText: string; }
export interface ChatProvider { id: string; label: string; continueStory(request: StoryTurnRequest): Promise<StructuredAiResponse>; }
