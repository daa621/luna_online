'use client';

import { useState } from 'react';
import type { CharacterProfile, GameSetup, ReferenceImage, WorldProfile } from '@/lib/game/types';
import { createId, emptyCharacter, emptyWorld } from '@/lib/game/defaults';

interface Props { onComplete: (setup: GameSetup) => void; }
const traitsFrom = (value: string) => value.split(',').map((trait) => trait.trim()).filter(Boolean);

async function toReferenceImages(files: FileList | null): Promise<ReferenceImage[]> {
  if (!files) return [];
  return Promise.all(Array.from(files).map((file) => new Promise<ReferenceImage>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: createId('ref'), name: file.name, dataUrl: String(reader.result), mediaType: file.type, createdAt: new Date().toISOString() });
    reader.readAsDataURL(file);
  })));
}

export function SetupWizard({ onComplete }: Props) {
  const [protagonist, setProtagonist] = useState<CharacterProfile>(() => emptyCharacter());
  const [companions, setCompanions] = useState<CharacterProfile[]>([]);
  const [world, setWorld] = useState<WorldProfile>(() => emptyWorld());
  const [protagonistTraits, setProtagonistTraits] = useState('');

  return <section className="panel setup-grid">
    <div><p className="eyebrow">Einrichtungsassistent</p><h1>AI Story RPG</h1><p>Definiere den permanenten Weltkontext. Alle Daten bleiben lokal im Browser.</p></div>
    <fieldset><legend>Hauptcharakter</legend><input placeholder="Name" value={protagonist.name} onChange={(e) => setProtagonist({ ...protagonist, name: e.target.value })} /><textarea placeholder="Beschreibung" value={protagonist.description} onChange={(e) => setProtagonist({ ...protagonist, description: e.target.value })} /><select value={protagonist.gender} onChange={(e) => setProtagonist({ ...protagonist, gender: e.target.value as CharacterProfile['gender'] })}><option value="unspecified">Nicht festgelegt</option><option value="female">Weiblich</option><option value="male">Männlich</option><option value="nonbinary">Nichtbinär</option><option value="custom">Individuell</option></select><input placeholder="Eigenschaften, kommasepariert" value={protagonistTraits} onChange={(e) => { setProtagonistTraits(e.target.value); setProtagonist({ ...protagonist, traits: traitsFrom(e.target.value) }); }} /><input type="file" accept="image/*" multiple onChange={async (e) => setProtagonist({ ...protagonist, referenceImages: await toReferenceImages(e.target.files) })} /></fieldset>
    <fieldset><legend>Begleiter</legend>{companions.map((companion, index) => <div className="companion" key={companion.id}><input placeholder="Name" value={companion.name} onChange={(e) => setCompanions(companions.map((c, i) => i === index ? { ...c, name: e.target.value } : c))} /><textarea placeholder="Beschreibung" value={companion.description} onChange={(e) => setCompanions(companions.map((c, i) => i === index ? { ...c, description: e.target.value } : c))} /><input placeholder="Eigenschaften" onChange={(e) => setCompanions(companions.map((c, i) => i === index ? { ...c, traits: traitsFrom(e.target.value) } : c))} /><button type="button" onClick={() => setCompanions(companions.filter((_, i) => i !== index))}>Entfernen</button></div>)}<button type="button" onClick={() => setCompanions([...companions, emptyCharacter()])}>Begleiter hinzufügen</button></fieldset>
    <fieldset><legend>Welt</legend><textarea placeholder="Setting" value={world.setting} onChange={(e) => setWorld({ ...world, setting: e.target.value })} /><textarea placeholder="Hintergrundgeschichte" value={world.backstory} onChange={(e) => setWorld({ ...world, backstory: e.target.value })} /><textarea placeholder="Regeln" value={world.rules} onChange={(e) => setWorld({ ...world, rules: e.target.value })} /><textarea placeholder="Stimmung" value={world.mood} onChange={(e) => setWorld({ ...world, mood: e.target.value })} /><input type="file" accept="image/*" multiple onChange={async (e) => setWorld({ ...world, referenceImages: await toReferenceImages(e.target.files) })} /></fieldset>
    <button className="primary" type="button" onClick={() => onComplete({ protagonist, companions, world })} disabled={!protagonist.name.trim() || !world.setting.trim()}>Abenteuer starten</button>
  </section>;
}
