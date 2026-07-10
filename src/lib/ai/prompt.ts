import type { GameState } from '@/lib/game/types';

export function buildStoryPrompt(game: GameState, playerText: string): string {
  const { setup } = game;
  return `Du bist die Spielleitung eines narrativen RPGs. Antworte ausschließlich als JSON mit storyText, inventoryChanges, statusChanges und optional imageRequest.\n\nWELT:\nSetting: ${setup.world.setting}\nHintergrund: ${setup.world.backstory}\nRegeln: ${setup.world.rules}\nStimmung: ${setup.world.mood}\n\nHAUPTCHARAKTER: ${setup.protagonist.name} (${setup.protagonist.gender})\n${setup.protagonist.description}\nEigenschaften: ${setup.protagonist.traits.join(', ')}\n\nBEGLEITER:\n${setup.companions.map((c) => `- ${c.name}: ${c.description}; Eigenschaften: ${c.traits.join(', ')}`).join('\n')}\n\nSTATUS: ${JSON.stringify(game.status)}\nINVENTAR: ${JSON.stringify(game.inventory)}\nBISHERIGE STORY:\n${game.story.slice(-12).map((entry) => `${entry.kind}: ${entry.text}`).join('\n')}\n\nSPIELERHANDLUNG: ${playerText}`;
}
