'use strict';

/* =====================================================================
   storage.js – ALT som har med lagring å gjøre, samlet på ett sted.

   Resten av appen (app.js) bruker bare funksjonene i objektet `lagring`
   nedenfor. Den vet ikke om dataene ligger i nettleseren eller i en
   database på nettet.

   Når vi senere skal dele listene mellom to personer, lager vi en ny
   versjon av denne filen som snakker med Firebase/Supabase, med de
   SAMME funksjonsnavnene. Da trenger ikke app.js å endres.

   Alle funksjonene er "async" (de returnerer et Promise). For
   localStorage er ikke det nødvendig, men en database på nettet bruker
   alltid litt tid på å svare. Ved å gjøre det slik fra start blir
   byttet senere smertefritt.

   Slik ser dataene ut:

     Liste:   { id, navn, opprettet }
     Oppgave: { id, listeId, tekst, ferdig, opprettet }

   (`opprettet` er et tidspunkt i millisekunder, fra Date.now().)
   Oppgavene peker på listen sin med `listeId`. Det tilsvarer en tabell
   i Supabase eller en samling i Firebase.
   ===================================================================== */

const lagring = (() => {
  // Navnet dataene lagres under i nettleseren. "v1" gjør det mulig å
  // endre formatet senere uten å blande gammelt og nytt.
  const NOKKEL = 'todo-app-data-v1';

  // Funksjoner som vil ha beskjed når noe endres (se lyttEtterEndringer)
  const lyttere = new Set();

  // ----- Interne hjelpefunksjoner (brukes bare inne i denne filen) -----

  function les() {
    try {
      const data = JSON.parse(localStorage.getItem(NOKKEL));
      if (data && Array.isArray(data.lister) && Array.isArray(data.oppgaver)) {
        return data;
      }
    } catch {
      // Ødelagte eller manglende data: vi starter med tomt lager
    }
    return { lister: [], oppgaver: [] };
  }

  function skriv(data) {
    localStorage.setItem(NOKKEL, JSON.stringify(data));
    varsle();
  }

  function varsle() {
    lyttere.forEach((lytter) => lytter());
  }

  function nyId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Hvis appen er åpen i to faner samtidig, sender nettleseren en
  // "storage"-hendelse til den andre fanen. Da oppdateres begge.
  window.addEventListener('storage', (e) => {
    if (e.key === NOKKEL) varsle();
  });

  // ----- Det offentlige grensesnittet: dette er det app.js bruker -----

  return {
    /** Henter alle lister, eldste først. */
    async hentLister() {
      return les().lister.sort((a, b) => a.opprettet - b.opprettet);
    },

    /** Lager en ny liste og returnerer den. */
    async leggTilListe(navn) {
      const data = les();
      const liste = { id: nyId(), navn, opprettet: Date.now() };
      data.lister.push(liste);
      skriv(data);
      return liste;
    },

    /** Endrer felter på en liste, f.eks. { navn: 'Handleliste' }. */
    async endreListe(id, endringer) {
      const data = les();
      data.lister = data.lister.map((l) => (l.id === id ? { ...l, ...endringer, id } : l));
      skriv(data);
    },

    /** Sletter en liste og alle oppgavene i den. */
    async slettListe(id) {
      const data = les();
      data.lister = data.lister.filter((l) => l.id !== id);
      data.oppgaver = data.oppgaver.filter((o) => o.listeId !== id);
      skriv(data);
    },

    /** Henter alle oppgavene i én liste. */
    async hentOppgaver(listeId) {
      return les().oppgaver.filter((o) => o.listeId === listeId);
    },

    /** Lager en ny oppgave i en liste og returnerer den. */
    async leggTilOppgave(listeId, tekst) {
      const data = les();
      const oppgave = { id: nyId(), listeId, tekst, ferdig: false, opprettet: Date.now() };
      data.oppgaver.push(oppgave);
      skriv(data);
      return oppgave;
    },

    /** Endrer felter på en oppgave, f.eks. { ferdig: true } eller { tekst: 'Melk' }. */
    async oppdaterOppgave(id, endringer) {
      const data = les();
      data.oppgaver = data.oppgaver.map((o) => (o.id === id ? { ...o, ...endringer, id } : o));
      skriv(data);
    },

    /** Sletter én oppgave. */
    async slettOppgave(id) {
      const data = les();
      data.oppgaver = data.oppgaver.filter((o) => o.id !== id);
      skriv(data);
    },

    /** Sletter alle fullførte oppgaver i en liste. */
    async slettFullforte(listeId) {
      const data = les();
      data.oppgaver = data.oppgaver.filter((o) => !(o.listeId === listeId && o.ferdig));
      skriv(data);
    },

    /**
     * Kaller `lytter` hver gang noe endres, både av deg selv og (senere)
     * av den du deler listen med. Returnerer en funksjon som stopper lyttingen.
     */
    lyttEtterEndringer(lytter) {
      lyttere.add(lytter);
      return () => lyttere.delete(lytter);
    },
  };
})();
