'use client';

import { useEffect, useState } from 'react';
import { fetchOpenAiCompatibleModels } from '@/lib/ai/models';
import type { AiSettings } from '@/lib/ai/settings';
import { lmStudioDefaults, mockDefaults } from '@/lib/ai/settings';

interface Props { settings: AiSettings; onChange: (settings: AiSettings) => void; }

export function AiSettingsPanel({ settings, onChange }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const isLmStudio = settings.provider === 'openai-compatible';

  useEffect(() => {
    if (!isLmStudio) return;
    let isMounted = true;

    async function loadModels() {
      setLoading(true);
      setModelError(null);
      const result = await fetchOpenAiCompatibleModels(settings.baseUrl ?? lmStudioDefaults.baseUrl ?? 'http://localhost:1234/v1');
      if (!isMounted) return;
      setModels(result.models.map((model) => model.id));
      setModelError(result.error ?? (result.models.length === 0 ? 'LM Studio hat keine Modelle gemeldet. Bitte Modell manuell eintragen.' : null));
      if (!settings.model && result.models[0]) onChange({ ...settings, model: result.models[0].id });
      setLoading(false);
    }

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, [isLmStudio, onChange, settings]);

  return <section className="ai-settings"><h3>KI-Provider</h3><label>Provider<select value={settings.provider} onChange={(event) => onChange(event.target.value === 'mock' ? mockDefaults : { ...lmStudioDefaults, model: settings.model })}><option value="mock">Mock</option><option value="openai-compatible">LM Studio</option></select></label>{isLmStudio ? <><label>LM-Studio-URL<input value={settings.baseUrl ?? ''} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} /></label><label>Modell<select value={settings.model ?? ''} onChange={(event) => onChange({ ...settings, model: event.target.value })}><option value="">Manuelle Eingabe / Fallback</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label><input aria-label="Manuelles Modell" placeholder="Modell-ID manuell eintragen" value={settings.model ?? ''} onChange={(event) => onChange({ ...settings, model: event.target.value })} />{loading ? <p>Lade LM-Studio-Modelle…</p> : null}{modelError ? <p className="error">{modelError}</p> : null}</> : <p>Mock-Modus aktiv: keine lokale KI-Verbindung nötig.</p>}<p><strong>Aktiv:</strong> {settings.provider === 'mock' ? 'Mock' : `LM Studio · ${settings.model || 'Fallback-Modell'}`}</p></section>;
}
