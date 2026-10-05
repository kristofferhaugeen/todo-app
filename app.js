'use strict';

/* =====================================================================
   app.js – alt som har med skjermen og knappene å gjøre.

   Viktig regel: denne filen snakker ALDRI direkte med localStorage eller
   en database. Den bruker bare `lagring` fra storage.js.

   Flyten i appen:
     1. Du gjør noe (f.eks. krysser av en oppgave)
     2. Vi ber `lagring` om å lagre endringen
     3. `lagring` sier fra at noe er endret (lyttEtterEndringer)
     4. Vi tegner skjermen på nytt med de ferske dataene
   Slik blir det likt enten endringen kom fra deg eller fra en annen.
   ===================================================================== */

// Henter elementene fra index.html én gang, så vi slipper å lete hver gang
const el = {
  tittel: document.getElementById('liste-tittel'),
  menyKnapp: document.getElementById('liste-meny-knapp'),
  faner: document.getElementById('liste-faner'),
  nyListeKnapp: document.getElementById('ny-liste-knapp'),
  skjema: document.getElementById('ny-oppgave-skjema'),
  nyTekst: document.getElementById('ny-oppgave-tekst'),
  oppgaver: document.getElementById('oppgaver'),
  tom: document.getElementById('tom-melding'),
  bunn: document.getElementById('bunn'),
  antallIgjen: document.getElementById('antall-igjen'),
  fjernFullforte: document.getElementById('fjern-fullforte'),
  navnDialog: document.getElementById('navn-dialog'),
  navnSkjema: document.getElementById('navn-skjema'),
  navnTittel: document.getElementById('navn-tittel'),
  navnFelt: document.getElementById('navn-felt'),
  navnAvbryt: document.getElementById('navn-avbryt'),
  menyDialog: document.getElementById('meny-dialog'),
  menyGiNavn: document.getElementById('meny-gi-navn'),
  menySlett: document.getElementById('meny-slett'),
  menyLukk: document.getElementById('meny-lukk'),
};

// Husker hvilken liste som var åpen sist (gjelder bare denne enheten)
const AKTIV_LISTE_NOKKEL = 'todo-app-aktiv-liste';

// Appens tilstand: det vi trenger å huske mens appen kjører
let lister = [];
let aktivListeId = null;
let sistLagtTilId = null; // gir nye oppgaver en liten animasjon
let redigererId = null;   // oppgaven som redigeres akkurat nå (eller null)

/* ---------------------------- Oppstart ---------------------------- */

async function start() {
  kobleHendelser();
  lagring.lyttEtterEndringer(planleggTegning);

  lister = await lagring.hentLister();
  if (lister.length === 0) {
    await lagring.leggTilListe('Min liste');
  }

  try {
    aktivListeId = localStorage.getItem(AKTIV_LISTE_NOKKEL);
  } catch {
    // Noen nettlesere (privat modus) kan nekte tilgang. Det er greit.
  }

  await tegn();
  registrerServiceWorker();
}

/* ---------------------- Tegne skjermen på nytt ---------------------- */

// Hvis mange endringer skjer samtidig, tegner vi bare én gang
let tegningPlanlagt = false;

function planleggTegning() {
  // Ikke tegn på nytt mens du skriver i en oppgave, da mister du teksten
  if (tegningPlanlagt || redigererId) return;
  tegningPlanlagt = true;
  setTimeout(() => {
    tegningPlanlagt = false;
    tegn();
  }, 0);
}

async function tegn() {
  lister = await lagring.hentLister();

  // Finnes ikke den aktive listen lenger? Velg den første.
  if (!lister.some((l) => l.id === aktivListeId)) {
    aktivListeId = lister[0]?.id ?? null;
  }
  const aktiv = lister.find((l) => l.id === aktivListeId);
  const oppgaver = aktiv ? await lagring.hentOppgaver(aktiv.id) : [];

  el.tittel.textContent = aktiv ? aktiv.navn : 'Gjøremål';
  document.title = aktiv ? `${aktiv.navn} – Gjøremål` : 'Gjøremål';
  tegnFaner();
  tegnOppgaver(oppgaver);
}

function tegnFaner() {
  const elementer = lister.map((liste) => {
    const knapp = document.createElement('button');
    knapp.type = 'button';
    knapp.className = 'fane';
    knapp.textContent = liste.navn;
    knapp.dataset.id = liste.id;
    if (liste.id === aktivListeId) knapp.setAttribute('aria-current', 'true');

    const li = document.createElement('li');
    li.append(knapp);
    return li;
  });
  el.faner.replaceChildren(...elementer);
}

function tegnOppgaver(oppgaver) {
  // Uferdige øverst, deretter ferdige. Nyeste først innenfor hver gruppe.
  const sortert = [...oppgaver].sort(
    (a, b) => a.ferdig - b.ferdig || b.opprettet - a.opprettet
  );
  el.oppgaver.replaceChildren(...sortert.map(lagOppgaveElement));

  const igjen = oppgaver.filter((o) => !o.ferdig).length;
  const ferdige = oppgaver.length - igjen;

  el.tom.hidden = oppgaver.length > 0;
  el.bunn.hidden = oppgaver.length === 0;
  el.antallIgjen.textContent = igjen === 0 ? 'Alt er gjort 🎉' : `${igjen} igjen`;
  el.fjernFullforte.hidden = ferdige === 0;

  sistLagtTilId = null;
}

// Lager HTML for én oppgave. Vi bruker textContent (ikke innerHTML),
// så tekst som ser ut som kode aldri blir tolket som kode.
function lagOppgaveElement(oppgave) {
  const li = document.createElement('li');
  li.className = 'oppgave';
  li.dataset.id = oppgave.id;
  li.classList.toggle('ferdig', oppgave.ferdig);
  li.classList.toggle('ny', oppgave.id === sistLagtTilId);

  const boks = document.createElement('input');
  boks.type = 'checkbox';
  boks.className = 'avkrysning';
  boks.checked = oppgave.ferdig;
  boks.setAttribute('aria-label', `Ferdig: ${oppgave.tekst}`);

  const tekst = document.createElement('span');
  tekst.className = 'tekst';
  tekst.textContent = oppgave.tekst;
  tekst.tabIndex = 0;
  tekst.title = 'Trykk for å endre';

  const slett = document.createElement('button');
  slett.type = 'button';
  slett.className = 'ikon-knapp slett';
  slett.setAttribute('aria-label', `Slett: ${oppgave.tekst}`);
  slett.textContent = '×';

  li.append(boks, tekst, slett);
  return li;
}

/* ----------------------------- Hendelser ----------------------------- */

function kobleHendelser() {
  // Legg til ny oppgave
  el.skjema.addEventListener('submit', async (e) => {
    e.preventDefault(); // hindrer at siden lastes på nytt
    const tekst = el.nyTekst.value.trim();
    if (!tekst || !aktivListeId) return;
    el.nyTekst.value = '';
    const ny = await lagring.leggTilOppgave(aktivListeId, tekst);
    sistLagtTilId = ny.id;
  });

  // Kryss av / fjern avkrysning.
  // Vi lytter på hele listen i stedet for på hver oppgave ("event delegation").
  el.oppgaver.addEventListener('change', (e) => {
    if (!e.target.matches('.avkrysning')) return;
    const id = e.target.closest('.oppgave').dataset.id;
    lagring.oppdaterOppgave(id, { ferdig: e.target.checked });
  });

  // Slett eller start redigering
  el.oppgaver.addEventListener('click', (e) => {
    const oppgaveEl = e.target.closest('.oppgave');
    if (!oppgaveEl) return;
    if (e.target.closest('.slett')) {
      lagring.slettOppgave(oppgaveEl.dataset.id);
    } else if (e.target.closest('.tekst')) {
      startRedigering(oppgaveEl);
    }
  });

  // Enter på en markert oppgave (tastatur) starter også redigering
  el.oppgaver.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.tekst')) {
      startRedigering(e.target.closest('.oppgave'));
    }
  });

  el.fjernFullforte.addEventListener('click', () => {
    lagring.slettFullforte(aktivListeId);
  });

  // Bytt liste
  el.faner.addEventListener('click', (e) => {
    const fane = e.target.closest('.fane');
    if (fane) byttListe(fane.dataset.id);
  });

  // Ny liste
  el.nyListeKnapp.addEventListener('click', async () => {
    const navn = await sporOmNavn('Ny liste');
    if (!navn) return;
    const liste = await lagring.leggTilListe(navn);
    byttListe(liste.id);
  });

  // Meny for den aktive listen
  el.menyKnapp.addEventListener('click', () => el.menyDialog.showModal());
  el.menyLukk.addEventListener('click', () => el.menyDialog.close());

  el.menyGiNavn.addEventListener('click', async () => {
    el.menyDialog.close();
    const aktiv = lister.find((l) => l.id === aktivListeId);
    if (!aktiv) return;
    const navn = await sporOmNavn('Gi listen nytt navn', aktiv.navn);
    if (navn && navn !== aktiv.navn) lagring.endreListe(aktiv.id, { navn });
  });

  el.menySlett.addEventListener('click', async () => {
    el.menyDialog.close();
    const aktiv = lister.find((l) => l.id === aktivListeId);
    if (!aktiv) return;
    if (!confirm(`Vil du slette «${aktiv.navn}» og alle oppgavene i den?`)) return;
    await lagring.slettListe(aktiv.id);
    // Det skal alltid finnes minst én liste
    if ((await lagring.hentLister()).length === 0) {
      await lagring.leggTilListe('Min liste');
    }
  });

  // Navnedialogen: "Lagre" gir navnet som svar, alt annet gir tomt svar
  el.navnSkjema.addEventListener('submit', (e) => {
    e.preventDefault();
    const navn = el.navnFelt.value.trim();
    if (navn) svarPaNavn(navn);
  });
  el.navnAvbryt.addEventListener('click', () => svarPaNavn(''));
  el.navnDialog.addEventListener('close', () => svarPaNavn('')); // f.eks. Esc-tasten

  // Trykk utenfor en dialog lukker den
  for (const dialog of [el.navnDialog, el.menyDialog]) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
}

function byttListe(id) {
  aktivListeId = id;
  try {
    localStorage.setItem(AKTIV_LISTE_NOKKEL, id);
  } catch {
    // Ikke så farlig om dette ikke blir husket
  }
  tegn().then(() => {
    el.faner
      .querySelector('[aria-current]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}

// Viser navnedialogen og venter på svar.
// Gir tilbake navnet, eller en tom tekst hvis du avbrøt.
let ventendeNavnSvar = null;

function sporOmNavn(tittel, startverdi = '') {
  el.navnTittel.textContent = tittel;
  el.navnFelt.value = startverdi;
  el.navnDialog.showModal();
  el.navnFelt.select();
  return new Promise((svar) => {
    ventendeNavnSvar = svar;
  });
}

function svarPaNavn(navn) {
  if (el.navnDialog.open) el.navnDialog.close();
  const svar = ventendeNavnSvar;
  ventendeNavnSvar = null; // bare første svar teller
  svar?.(navn);
}

// Bytter ut teksten i en oppgave med et tekstfelt du kan skrive i
function startRedigering(oppgaveEl) {
  if (redigererId) return;

  const id = oppgaveEl.dataset.id;
  const tekstEl = oppgaveEl.querySelector('.tekst');
  const gammelTekst = tekstEl.textContent;

  const felt = document.createElement('input');
  felt.type = 'text';
  felt.className = 'rediger-felt';
  felt.value = gammelTekst;
  felt.maxLength = 200;
  felt.enterKeyHint = 'done';
  felt.setAttribute('aria-label', 'Endre oppgave');

  tekstEl.replaceWith(felt);
  redigererId = id;
  felt.focus();
  felt.setSelectionRange(felt.value.length, felt.value.length);

  let ferdig = false;
  async function avslutt(lagre) {
    if (ferdig) return; // kan bli kalt både av Enter og blur
    ferdig = true;
    redigererId = null;

    const nyTekst = felt.value.trim();
    if (lagre && nyTekst && nyTekst !== gammelTekst) {
      await lagring.oppdaterOppgave(id, { tekst: nyTekst });
    } else if (lagre && !nyTekst) {
      await lagring.slettOppgave(id); // tømt tekst = slett oppgaven
    }
    planleggTegning();
  }

  felt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      avslutt(true);
    } else if (e.key === 'Escape') {
      avslutt(false);
    }
  });
  felt.addEventListener('blur', () => avslutt(true));
}

/* --------------------------- Service worker --------------------------- */

// Service workeren gjør appen installerbar og lar den åpne uten nett.
// Den virker bare når siden kjøres fra en webserver (http/https),
// ikke når du åpner filen direkte fra disken.
function registrerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch((feil) => console.warn('Kunne ikke registrere service worker:', feil));
  }
}

start();
