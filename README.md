# Gjøremål

En enkel todo-app laget med ren HTML, CSS og JavaScript (uten rammeverk).
Den virker på mobil og PC, og kan legges til på hjemskjermen.

## Filene

| Fil | Hva den gjør |
| --- | --- |
| `index.html` | Strukturen på siden |
| `style.css` | Utseendet (farger, layout, mørk modus) |
| `app.js` | Det som skjer når du trykker på ting |
| `storage.js` | All lagring. Bytt ut denne for å bruke en database |
| `manifest.json` | Gjør at appen kan installeres |
| `service-worker.js` | Gjør at appen åpner uten nett |
| `icons/` | App-ikonene |

## Kjøre lokalt

Dobbeltklikk på `index.html`. Alt virker unntatt installering som app,
som krever en webserver. Vil du teste det også, kan du kjøre dette i mappen:

```
py -m http.server 8000
```

Åpne deretter <http://localhost:8000>.

## Publisere på GitHub Pages

1. Push koden til et repository på GitHub.
2. Gå til **Settings → Pages**, og velg branch `main` og mappe `/ (root)`.
3. Etter et par minutter ligger appen på `https://<brukernavn>.github.io/<repo-navn>/`.

## Legge til på hjemskjermen

- **iPhone (Safari):** Del-knappen → «Legg til på Hjem-skjerm»
- **Android (Chrome):** ⋮-menyen → «Installer app» / «Legg til på startsiden»

## Deling senere

`app.js` bruker bare funksjonene i `lagring` (se `storage.js`). For å dele
listene mellom flere personer lager vi en ny `storage.js` som bruker
Firebase eller Supabase, med de samme funksjonsnavnene.
