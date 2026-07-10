import type { GameState } from '@/lib/game/types';

function compactContext(game: GameState) {
  const activeQuests = game.quests.filter((quest) => quest.status === 'active').map((quest) => ({ id: quest.id, title: quest.title, description: quest.description, objectives: quest.objectives.map((objective) => ({ id: objective.id, title: objective.title, progress: objective.progress, target: objective.target, completed: objective.completed })) }));
  const importantStatus = { location: game.status.location, timeOfDay: game.status.timeOfDay, health: game.status.health, weather: game.status.weather, dangerLevel: game.status.dangerLevel };
  return { activeQuests, importantStatus };
}

export function buildNarrativePrompt(game: GameState, playerText: string): string {
  const { setup } = game;
  const { activeQuests, importantStatus } = compactContext(game);
  return `Schreibe nur die nächste Storypassage für ein narratives RPG.\n\nREGELN:\n- Keine JSON-Ausgabe.\n- Keine technischen Begriffe wie item_added, skill_check oder location_changed.\n- Keine Auswahlmenüs.\n- Keine Regelerklärungen.\n- Beschreibe nur, was in der Welt passiert.\n- Behaupte keine Spielzustandsänderung, die nicht aus der Spielerhandlung plausibel hervorgeht.\n- Der Text muss mit aktueller Szene, Welt und bisherigem Spielzustand konsistent bleiben.\n\nWELT: ${setup.world.setting}\nHintergrund: ${setup.world.backstory}\nRegeln: ${setup.world.rules}\nStimmung: ${setup.world.mood}\nHauptcharakter: ${setup.protagonist.name} — ${setup.protagonist.description}\nBegleiter: ${setup.companions.map((c) => `${c.name}: ${c.description}`).join('; ')}\nStatus: ${JSON.stringify(importantStatus)}\nInventar: ${JSON.stringify(game.inventory.map((item) => ({ name: item.name, quantity: item.quantity, category: item.category })))}\nAktive Quests: ${JSON.stringify(activeQuests)}\nLetzte Story: ${game.story.slice(-8).map((entry) => `${entry.kind}: ${entry.text.slice(0, 1000)}`).join('\n')}\n\nSpielerhandlung: ${playerText}`;
}

export function buildRuleAnalysisPrompt(game: GameState, playerText: string, storyText: string): string {
  const { setup } = game;
  const { activeQuests, importantStatus } = compactContext(game);
  return `Analysiere Spielerhandlung und Storytext. Antworte ausschließlich als minimales JSON: {"events":[...]}\n\nERLAUBTE EVENTS:\n- {"type":"location_changed","location":"..."}\n- {"type":"item_added","name":"...","description":"...","quantity":1,"category":"..."}\n- {"type":"item_removed","itemId":"...","quantity":1} oder {"type":"item_removed","name":"...","quantity":1}\n- {"type":"health_changed","delta":-5,"reason":"..."}\n- {"type":"skill_check","id":"...","skill":"...","difficulty":12,"modifier":0,"reason":"..."}\n\nREGELN:\n- Keine Story schreiben.\n- Keine Würfelergebnisse bestimmen.\n- Keine unbekannten Items entfernen.\n- Keine unbekannten Quests verändern.\n- Keine zusätzlichen Eventtypen erfinden.\n- Keine Markdown-Codeblöcke.\n- Nur Events vorschlagen, die aus Spielerhandlung und Storytext plausibel folgen.\n\nWeltregeln: ${setup.world.rules}\nOrt/Status: ${JSON.stringify(importantStatus)}\nInventar: ${JSON.stringify(game.inventory)}\nBeziehungen: ${JSON.stringify(game.relationships)}\nAktive Quests: ${JSON.stringify(activeQuests)}\nSpielerhandlung: ${playerText}\nStorytext: ${storyText}`;
}

export function buildStoryPrompt(game: GameState, playerText: string): string {
  return buildRuleAnalysisPrompt(game, playerText, game.story.at(-1)?.text ?? '');
}
