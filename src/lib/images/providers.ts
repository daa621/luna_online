import type { ImageProvider, ImageGenerationRequest } from './types';
import { createId, nowIso } from '@/lib/game/defaults';

export class MockImageProvider implements ImageProvider {
  id = 'mock-image'; label = 'Mock Image Provider';
  async generate({ imageRequest }: ImageGenerationRequest) {
    const prompt = imageRequest.prompt ?? 'Fantasy RPG scene';
    return { id: createId('img'), prompt, provider: this.id, createdAt: nowIso(), url: `https://placehold.co/1024x576/15172b/f8fafc?text=${encodeURIComponent(prompt.slice(0, 80))}` };
  }
}
export function createImageProvider(): ImageProvider { return new MockImageProvider(); }
