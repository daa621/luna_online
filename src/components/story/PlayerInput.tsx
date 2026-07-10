'use client';
import { FormEvent, useState } from 'react';
export function PlayerInput({ disabled, onSubmit }: { disabled?: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!text.trim()) return; onSubmit(text.trim()); setText(''); }
  return <form className="player-input" onSubmit={submit}><textarea aria-label="Spieleraktion" placeholder="Was tust du als Nächstes?" value={text} onChange={(e) => setText(e.target.value)} /><button className="primary" disabled={disabled || !text.trim()}>Weiter</button><button type="button" title="Vorbereitet für Spracheingabe" disabled>🎙️</button></form>;
}
