import type { GameState } from '@/lib/game/types';
export function SidePanel({ game, onSave, onNew, onDelete }: { game: GameState; onSave: () => void; onNew: () => void; onDelete: () => void }) {
  return <aside className="side-panel"><h2>{game.name}</h2><button onClick={onSave}>Speichern</button><button onClick={onNew}>Neues Spiel</button><button onClick={onDelete}>Spielstand löschen</button><h3>Status</h3><pre>{JSON.stringify(game.status, null, 2)}</pre><h3>Inventar</h3>{game.inventory.length ? <ul>{game.inventory.map((item) => <li key={item.id}><strong>{item.name}</strong> × {item.quantity}<br />{item.description}</li>)}</ul> : <p>Leer</p>}</aside>;
}
