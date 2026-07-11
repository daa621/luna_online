# AI Story RPG

Modernes, browserbasiertes Webfrontend für ein KI-gestütztes Rollenspiel. Das Projekt ist als langfristig erweiterbare Grundlage für Storytelling, Inventar, Spielstatus, Bildgenerierung und austauschbare KI-Anbieter konzipiert.

## Architekturentscheidungen

- **Frontend-only:** Die App läuft vollständig im Browser. Savegames werden zunächst als JSON in `localStorage` gespeichert.
- **Provider-Abstraktion:** Chat- und Bildgenerierung verwenden klare Interfaces. Der OpenAI-kompatible Chat-Provider kann OpenAI, LM Studio, Ollama-kompatible Endpunkte oder andere OpenAI-kompatible Server ansprechen.
- **Strukturierte KI-Antworten:** Die Spielmechanik verarbeitet JSON-Felder wie `storyText`, `inventoryChanges`, `statusChanges` und `imageRequest`. Storytext wird nicht geparst.
- **Domänenmodule:** UI, KI, Bildsystem, Speicher, Inventar und Spielstatus sind getrennt, damit spätere Features wie Multiplayer, Spracheingabe oder Cloud-Saves ergänzt werden können.

## Projektstruktur

```text
src/app                 Next.js App Router, Layout und globale Styles
src/components          UI-Komponenten für Setup, Story und Layout
src/lib/ai              Chat-API, Prompting und Provider
src/lib/images          Bild-API und Provider
src/lib/game            Datenmodell, Engine, Inventar und Status
src/lib/storage         Savegame-Repository für lokale JSON-Speicherung
```

## Datenmodell

Zentrale Typen liegen in `src/lib/game/types.ts`:

- `GameSetup`: Hauptcharakter, Begleiter und Weltkontext
- `GameState`: Story, Inventar, flexibler Status und Setup
- `StructuredAiResponse`: strukturierte Antwort der KI
- `InventoryItem`: Name, Beschreibung, Menge, Kategorie und freie Attribute
- `GameStatus`: frei erweiterbare Key-Value-Struktur für Ort, Quests, Beziehungen, Gold, Erfahrung und eigene Variablen


## Ereignis- und Questmodell

Die KI darf den Spielzustand nicht direkt setzen. Sie liefert zunächst einen Entwurf mit validierbaren `events`; jedes Event wird einzeln geprüft, sodass gemischte Antworten teilweise angewendet werden können. Unterstützte Ereignisse sind unter anderem `item_added`, `item_removed`, `health_changed`, `relationship_changed`, `quest_started`, `quest_progressed`, `quest_completed`, `quest_failed`, `location_changed` und `skill_check`. Events können über `requiresSkillCheck` an einen bestimmten Würfelausgang gebunden werden, damit Belohnungen oder Questfortschritt nicht trotz fehlgeschlagener Probe ausgeführt werden.

Quests besitzen ein eigenes Modell mit `id`, `title`, `description`, `status`, `objectives` inklusive Fortschritt und optionalen `rewards`. Eine Quest kann nur abgeschlossen werden, wenn alle Objectives erfüllt sind; Belohnungen werden nicht implizit vergeben, sondern müssen als normale validierte Events wie `item_added` vorgeschlagen werden. Skill Checks werden nur von der KI vorgeschlagen; die Engine würfelt reproduzierbar einen W20, addiert den Modifier und übergibt das Ergebnis anschließend an die KI, die daraus den endgültigen Storytext formuliert.

## KI-API

`ChatProvider` definiert eine einheitliche Methode `continueStory`. Implementiert sind:

- `MockChatProvider`: lauffähig ohne API-Schlüssel
- `OpenAiCompatibleChatProvider`: nutzt `/chat/completions` mit JSON-Antwortformat

Konfiguration erfolgt per Umgebungsvariablen:

```bash
cp .env.example .env.local
NEXT_PUBLIC_AI_PROVIDER=mock
NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_OPENAI_COMPAT_MODEL=gpt-4.1-mini
NEXT_PUBLIC_OPENAI_COMPAT_API_KEY=
```

Für LM Studio oder andere lokale OpenAI-kompatible Server wird `NEXT_PUBLIC_OPENAI_COMPAT_BASE_URL` entsprechend gesetzt und `NEXT_PUBLIC_AI_PROVIDER=openai-compatible` aktiviert.

> Hinweis: Da die App bewusst ohne Backend läuft, sind `NEXT_PUBLIC_*` Variablen im Browser sichtbar. `NEXT_PUBLIC_OPENAI_COMPAT_API_KEY` ist deshalb ausschließlich für lokale Tests akzeptabel. Für echte Nutzung muss ein serverseitiger Proxy ergänzt werden, damit API-Schlüssel nicht an Browser ausgeliefert werden.




## Inferenzparameter

Die Standardwerte für die Erzähler- und Regel-LLM-Aufrufe liegen zentral in `src/lib/ai/settings.ts`. Für den ersten LM-Studio-Test nutzt die Erzählerrolle `temperature: 0.65`, `top_p: 0.9`, `max_tokens: 250`, `frequency_penalty: 0.2` und `presence_penalty: 0.1`. Die Regelanalyse besitzt eigene, getrennte Defaults und wird nicht automatisch durch Änderungen an den Erzählerwerten verändert.

## Getrennte Story- und Regel-LLM-Aufrufe

Ein Spielzug ist in zwei Rollen getrennt: Zuerst erzeugt das Story-LLM ausschließlich freie Prosa/Markdown ohne JSON, Events oder technische Regelbegriffe. Danach erhält das Regel-LLM Spielerhandlung, Storytext und aktuellen Spielzustand und antwortet ausschließlich mit kleinem JSON der Form `{ "events": [...] }`. Die Engine validiert diese Events, würfelt Skill Checks selbst und wendet nur gültige Änderungen an.

Aktuell kann dasselbe LM-Studio-Modell beide Rollen übernehmen. Die Provider-Abstraktion trennt die Methoden (`continueNarrative` und `analyzeRules`) bereits so, dass später unterschiedliche Modelle für Story, Regeln und Bilder eingesetzt werden können. Diese Umsetzung liegt auf dem Branch `codex/separate-story-and-rules-llm`; `main` bleibt unverändert, bis der Branch bewusst gemergt wird.

## LM Studio lokal verwenden

1. In LM Studio ein Chat-Modell laden.
2. Den lokalen Server in LM Studio aktivieren. Die App erwartet standardmäßig `http://localhost:1234/v1`.
3. In der Oberfläche im Spielmenü den Provider **LM Studio** auswählen. Der Browser ruft standardmäßig den Next.js-Proxy `/api/ai/models` auf; dieser lädt serverseitig `http://localhost:1234/v1/models`, liest die IDs aus `response.data` und blendet Embedding-Modelle aus dem Dropdown aus.
4. Falls die Modellliste nicht erreichbar ist oder CORS/Serverstart noch nicht passt, kann die Modell-ID manuell eingetragen werden. Der aktuelle Provider und das Modell werden lokal im Browser gespeichert und beim nächsten Zug verwendet.

Für lokale LM-Studio-Tests ist kein echter API-Key erforderlich; der OpenAI-kompatible Provider sendet dann nur `Content-Type: application/json`. LM Studio nutzt in dieser Version `response_format: { type: 'text' }`; die Prompts verlangen trotzdem strikt JSON und die Antwort wird anschließend weiterhin mit `JSON.parse` und Zod validiert. Chat-Anfragen laufen ebenfalls über den Next.js-Proxy `/api/ai/chat`, der serverseitig an `http://localhost:1234/v1/chat/completions` weiterleitet. Dadurch ist kein direkter Browser-CORS-Zugriff auf LM Studio nötig; der lokale Server muss aber für Next.js erreichbar sein.

## Bildsystem

`ImageProvider` kapselt Bildgenerierung. Der aktuelle Mock-Provider erzeugt Platzhalterbilder. Die Schnittstelle enthält bereits `GameState`, `ImageRequest` und beteiligte Charakter-IDs, sodass Referenzbilder später an OpenAI Images, ComfyUI, Stable Diffusion, Flux oder andere Anbieter weitergegeben werden können.

## Installation und Entwicklung

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## Speichern und Laden

Die Klasse `LocalJsonSaveGameStore` bietet:

- Savegame-Liste
- Speichern
- Laden des neuesten Savegames beim Start
- Löschen

Das Interface `SaveGameStore` erlaubt später Cloudspeicherung ohne Änderung der UI.

## Erweiterungsmöglichkeiten

- Provider für Ollama-native APIs, ComfyUI oder Cloud-Saves hinzufügen
- Spracheingabe über die vorbereitete Eingabearchitektur ergänzen
- Text-to-Speech über ein eigenes Audio-Modul anbinden
- Status- und Questregeln als eigene Domänenservices ausbauen
- Multiplayer über synchronisierte `GameState`-Events einführen
