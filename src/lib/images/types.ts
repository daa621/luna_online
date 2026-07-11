import type { GameState, GeneratedStoryImage, ImageRequest } from '@/lib/game/types';
export interface ImageGenerationRequest { game: GameState; imageRequest: ImageRequest; }
export interface ImageProvider { id: string; label: string; generate(request: ImageGenerationRequest): Promise<GeneratedStoryImage>; }
