'use client';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StoryEntry } from '@/lib/game/types';

function RuleSummary({ entry }: { entry: Extract<StoryEntry, { kind: 'ai' }> }) {
  const hasChecks = Boolean(entry.skillChecks?.length);
  const hasEffects = Boolean(entry.effects?.length);
  const hasInvalid = Boolean(entry.invalidEvents?.length);
  if (!hasChecks && !hasEffects && !hasInvalid) return null;
  return <section className="turn-summary" aria-label="Spielzug-Auswertung"><div className="turn-summary__header"><span>⚔️ Spielzug-Auswertung</span>{hasInvalid ? <em>Nicht vollständig ausgewertet</em> : <em>Ausgewertet</em>}</div>{hasChecks ? <div className="turn-summary__grid">{entry.skillChecks?.map((check) => <article className={`check-card ${check.success ? 'success' : 'failure'}`} key={check.id}><strong>{check.skill}</strong><span className="result">{check.success ? 'Erfolg' : 'Misserfolg'}</span><dl><div><dt>W20</dt><dd>{check.roll}</dd></div><div><dt>Mod.</dt><dd>{check.modifier >= 0 ? `+${check.modifier}` : check.modifier}</dd></div><div><dt>Gesamt</dt><dd>{check.total}</dd></div><div><dt>Schwierigkeit</dt><dd>{check.difficulty}</dd></div></dl>{check.reason ? <p>{check.reason}</p> : null}</article>)}</div> : null}{hasEffects ? <div className="effects-list"><h4>Auswirkungen</h4><ul>{entry.effects?.filter((effect) => effect.type !== 'skill_check').map((effect, index) => <li key={`${effect.type}-${index}`}>{effect.message}</li>)}</ul></div> : null}{hasInvalid ? <div className="invalid-list"><h4>Hinweise der Spielleitung</h4><ul>{entry.invalidEvents?.map((event, index) => <li key={index}>{event}</li>)}</ul></div> : null}</section>;
}

export function StoryWindow({ entries }: { entries: StoryEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);
  return <div className="story-window">{entries.map((entry) => <article className={`story-entry ${entry.kind}`} key={entry.id}><header>{entry.kind === 'ai' ? 'Erzähler' : entry.kind === 'player' ? 'Spieler' : 'System'} · {new Date(entry.createdAt).toLocaleTimeString()}</header><ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text.split('\n\n---\n**Auswirkungen dieses Zuges**')[0]}</ReactMarkdown>{entry.kind === 'ai' ? <RuleSummary entry={entry} /> : null}{entry.kind === 'ai' && entry.image ? <figure>{/* Generated image URLs can come from arbitrary future providers; use a plain image element intentionally. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.image.url} alt={entry.image.prompt} /><figcaption>{entry.image.prompt}</figcaption></figure> : null}</article>)}<div ref={endRef} /></div>;
}
