'use client';

import { useEffect, useMemo, useState } from 'react';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { SidePanel } from '@/components/layout/SidePanel';
import { PlayerInput } from '@/components/story/PlayerInput';
import { StoryWindow } from '@/components/story/StoryWindow';
import { createChatProvider } from '@/lib/ai/providers';
import { createDefaultAiSettings, type AiSettings } from '@/lib/ai/settings';
import { createImageProvider } from '@/lib/images/providers';
import { createInitialGame } from '@/lib/game/defaults';
import { playTurn } from '@/lib/game/engine';
import type { GameSetup, GameState } from '@/lib/game/types';
import { LocalJsonSaveGameStore } from '@/lib/storage/save-game-store';

function normalizeGame(game: GameState): GameState {
  return { ...game, quests: game.quests ?? [], relationships: game.relationships ?? Object.fromEntries(game.setup.companions.map((companion) => [companion.id, 0])), status: { health: 100, location: 'Unbekannt', ...game.status } };
}

function loadInitialAiSettings(): AiSettings {
  if (typeof window === 'undefined') return createDefaultAiSettings();
  try {
    const saved = localStorage.getItem('ai-story-rpg:ai-settings');
    return saved ? JSON.parse(saved) as AiSettings : createDefaultAiSettings();
  } catch {
    return createDefaultAiSettings();
  }
}

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useMemo(() => new LocalJsonSaveGameStore(), []);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadInitialAiSettings());
  const images = useMemo(() => createImageProvider(), []);


  useEffect(() => {
    localStorage.setItem('ai-story-rpg:ai-settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    let isMounted = true;

    async function loadLatestSave() {
      try {
        const [latest] = await store.list();
        if (!latest) return;
        const loaded = await store.load(latest.id);
        if (loaded && isMounted) setGame(normalizeGame(loaded));
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? `Spielstand konnte nicht geladen werden: ${err.message}` : 'Spielstand konnte nicht geladen werden.');
      }
    }

    void loadLatestSave();

    return () => {
      isMounted = false;
    };
  }, [store]);
  const start = (setup: GameSetup) => setGame(createInitialGame(setup));
  const save = async () => { if (game) await store.save({ ...game, updatedAt: new Date().toISOString() }); };
  const submit = async (text: string) => { if (!game) return; setBusy(true); setError(null); try { const next = await playTurn(game, text, createChatProvider(aiSettings), images); setGame(next); const lastEntry = next.story.at(-1); const ruleAnalysisFailed = lastEntry?.kind === 'ai' && lastEntry.invalidEvents?.some((event) => event.startsWith('Regelanalyse fehlgeschlagen')); if (!ruleAnalysisFailed) await store.save(next); } catch (err) { setError(err instanceof Error ? err.message : 'Unbekannter Fehler'); } finally { setBusy(false); } };
  const remove = async () => { if (game) await store.delete(game.id); setGame(null); };

  if (!game) return <main className="app-shell"><SetupWizard onComplete={start} /></main>;
  return <main className="game-layout"><SidePanel game={game} aiSettings={aiSettings} onAiSettingsChange={setAiSettings} onSave={save} onNew={() => setGame(null)} onDelete={remove} /><section className="main-panel"><StoryWindow entries={game.story} />{error ? <p className="error">{error}</p> : null}<PlayerInput disabled={busy} onSubmit={submit} /></section></main>;
}
