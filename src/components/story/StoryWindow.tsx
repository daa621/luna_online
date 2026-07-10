'use client';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StoryEntry } from '@/lib/game/types';

export function StoryWindow({ entries }: { entries: StoryEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [entries]);
  return <div className="story-window">{entries.map((entry) => <article className={`story-entry ${entry.kind}`} key={entry.id}><header>{entry.kind === 'ai' ? 'KI' : entry.kind === 'player' ? 'Spieler' : 'System'} · {new Date(entry.createdAt).toLocaleTimeString()}</header><ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>{entry.kind === 'ai' && entry.effects?.length ? <details open><summary>Regelergebnis</summary><ul>{entry.effects.map((effect, index) => <li key={`${effect.type}-${index}`}>{effect.message}</li>)}</ul></details> : null}{entry.kind === 'ai' && entry.skillChecks?.length ? <div className="checks"><strong>Würfe</strong>{entry.skillChecks.map((check) => <p key={`${check.skill}-${check.roll}`}>{check.skill}: W20 {check.roll} {check.modifier >= 0 ? '+' : ''}{check.modifier} = {check.total} gegen {check.difficulty} — {check.success ? 'Erfolg' : 'Misserfolg'}</p>)}</div> : null}{entry.kind === 'ai' && entry.image ? <figure>{/* Generated image URLs can come from arbitrary future providers; use a plain image element intentionally. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.image.url} alt={entry.image.prompt} /><figcaption>{entry.image.prompt}</figcaption></figure> : null}</article>)}<div ref={endRef} /></div>;
}
