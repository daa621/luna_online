import { AiSettingsPanel } from '@/components/settings/AiSettingsPanel';
import type { AiSettings } from '@/lib/ai/settings';
import type { GameState } from '@/lib/game/types';

export function SidePanel({ game, aiSettings, onAiSettingsChange, onSave, onNew, onDelete }: { game: GameState; aiSettings: AiSettings; onAiSettingsChange: (settings: AiSettings) => void; onSave: () => void; onNew: () => void; onDelete: () => void }) {
  const activeQuests = game.quests.filter((quest) => quest.status === 'active');
  const importantStatus = Object.entries(game.status).filter(([key]) => !['health', 'location'].includes(key)).slice(0, 6);
  return <aside className="side-panel"><h2>{game.name}</h2><button onClick={onSave}>Speichern</button><button onClick={onNew}>Neues Spiel</button><button onClick={onDelete}>Spielstand löschen</button><AiSettingsPanel settings={aiSettings} onChange={onAiSettingsChange} /><h3>Kernstatus</h3><p><strong>LP:</strong> {String(game.status.health ?? 100)} / 100</p><p><strong>Ort:</strong> {String(game.status.location ?? 'Unbekannt')}</p>{importantStatus.length ? <dl>{importantStatus.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl> : null}<h3>Aktive Quests</h3>{activeQuests.length ? <ul>{activeQuests.map((quest) => <li key={quest.id}><strong>{quest.title}</strong><br />{quest.objectives.map((objective) => <span key={objective.id}>{objective.completed ? '✅' : '•'} {objective.title}: {objective.progress}/{objective.target}<br /></span>)}</li>)}</ul> : <p>Keine aktiven Quests</p>}<h3>Inventar</h3>{game.inventory.length ? <ul>{game.inventory.map((item) => <li key={item.id}><strong>{item.name}</strong> × {item.quantity}<br />{item.description}</li>)}</ul> : <p>Leer</p>}</aside>;
}
