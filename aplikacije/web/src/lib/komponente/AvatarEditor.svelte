<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import {
    AVATAR_DIJELOVI,
    PRESETI_BOJA_AVATARA,
    ZADANI_AVATAR_CONFIG,
    nasumicnaKonfiguracijaAvatara,
    type AvatarConfigV1,
    type AvatarDijelovi,
    type AvatarBojnaUloga,
  } from 'zajednicko';
  import { ChevronLeft, ChevronRight, Dices, Redo2, Undo2 } from 'lucide-svelte';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';
  import AvatarDioPreview from './AvatarDioPreview.svelte';
  import { ulogaBojeKategorije } from '$lib/avatar-render.js';

  interface Props {
    pocetnaKonfiguracija?: AvatarConfigV1;
    rang?: string | null;
    naslov?: string;
    tekstSpremanja?: string;
    spremanje?: boolean;
    spremiBezPromjene?: boolean;
    onSpremi: (konfiguracija: AvatarConfigV1) => void | Promise<void>;
  }

  let {
    pocetnaKonfiguracija = ZADANI_AVATAR_CONFIG,
    rang = null,
    naslov = 'Uredi avatar',
    tekstSpremanja = 'Spremi avatar',
    spremanje = false,
    spremiBezPromjene = false,
    onSpremi,
  }: Props = $props();

  type GlavnaId = 'lice' | 'kosa' | 'odjeca' | 'dodaci';
  type Potkljuc = 'skin' | keyof AvatarDijelovi;

  const MAKS_POVIJEST = 20;

  const GLAUNE: { id: GlavnaId; naziv: string }[] = [
    { id: 'lice', naziv: 'Lice' },
    { id: 'kosa', naziv: 'Kosa' },
    { id: 'odjeca', naziv: 'Odjeća' },
    { id: 'dodaci', naziv: 'Dodaci' },
  ];

  const POTKATEGORIJE: Record<GlavnaId, { kljuc: Potkljuc; naziv: string; obavezno: boolean }[]> = {
    lice: [
      { kljuc: 'skin', naziv: 'Koža', obavezno: true },
      { kljuc: 'eyes', naziv: 'Oči', obavezno: true },
      { kljuc: 'eyebrows', naziv: 'Obrve', obavezno: false },
      { kljuc: 'nose', naziv: 'Nos', obavezno: false },
      { kljuc: 'mouth', naziv: 'Usta', obavezno: true },
      { kljuc: 'ears', naziv: 'Uši', obavezno: true },
    ],
    kosa: [
      { kljuc: 'hair', naziv: 'Frizura', obavezno: false },
      { kljuc: 'facialHair', naziv: 'Brada i brkovi', obavezno: false },
    ],
    odjeca: [{ kljuc: 'shirt', naziv: 'Odjeća', obavezno: false }],
    dodaci: [
      { kljuc: 'glasses', naziv: 'Naočale', obavezno: false },
      { kljuc: 'earrings', naziv: 'Naušnice', obavezno: false },
    ],
  };

  const NAZIVI_BEZ: Partial<Record<Potkljuc, string>> = {
    hair: 'Bez frizure',
    eyebrows: 'Bez obrva',
    nose: 'Bez nosa',
    shirt: 'Bez odjeće',
    glasses: 'Bez naočala',
    earrings: 'Bez naušnica',
    facialHair: 'Bez brade i brkova',
  };

  function kopirajKonfiguraciju(konfiguracija: AvatarConfigV1): AvatarConfigV1 {
    return {
      ...konfiguracija,
      parts: { ...konfiguracija.parts },
      colors: { ...konfiguracija.colors },
    };
  }

  /** Detached uši više nisu birive; stari snimci se u editoru prebace na attached. */
  function normalizirajKonfiguraciju(konfiguracija: AvatarConfigV1): AvatarConfigV1 {
    const kopija = kopirajKonfiguraciju(konfiguracija);
    if (kopija.parts.ears === 'detached') {
      kopija.parts.ears = 'attached';
    }
    return kopija;
  }

  function konfiguracijeJednake(a: AvatarConfigV1, b: AvatarConfigV1): boolean {
    for (const kljuc of Object.keys(a.parts) as (keyof AvatarDijelovi)[]) {
      if (a.parts[kljuc] !== b.parts[kljuc]) return false;
    }
    const uloge = new Set([
      ...Object.keys(a.colors),
      ...Object.keys(b.colors),
    ] as AvatarBojnaUloga[]);
    for (const uloga of uloge) {
      if ((a.colors[uloga] ?? undefined) !== (b.colors[uloga] ?? undefined)) return false;
    }
    return a.schemaVersion === b.schemaVersion && a.assetVersion === b.assetVersion;
  }

  let draft = $state<AvatarConfigV1>(kopirajKonfiguraciju(ZADANI_AVATAR_CONFIG));
  let spremljeno = $state<AvatarConfigV1>(kopirajKonfiguraciju(ZADANI_AVATAR_CONFIG));
  let inicijalizirano = $state(false);
  let ucitavanjeUspjelo = $state(false);
  let proslost = $state<AvatarConfigV1[]>([]);
  let buducnost = $state<AvatarConfigV1[]>([]);
  let aktivnaGlavna = $state<GlavnaId>('kosa');
  let zadnjePotkategorije = $state<Record<GlavnaId, Potkljuc>>({
    lice: 'skin',
    kosa: 'hair',
    odjeca: 'shirt',
    dodaci: 'glasses',
  });
  let aktivniPotkljuc = $state<Potkljuc>('hair');
  let previewVelicina = $state(140);
  let customBojaUTijeku: AvatarBojnaUloga | null = null;
  let skracivanjeSpremanja = false;

  $effect(() => {
    if (inicijalizirano) return;
    // Spremljeno ostaje izvornik (npr. detached); draft je normaliziran → Save ostaje omogućen.
    const izvor = kopirajKonfiguraciju(pocetnaKonfiguracija);
    spremljeno = kopirajKonfiguraciju(izvor);
    draft = normalizirajKonfiguraciju(izvor);
    inicijalizirano = true;
    ucitavanjeUspjelo = true;
  });

  const izmijenjeno = $derived(ucitavanjeUspjelo && !konfiguracijeJednake(draft, spremljeno));
  const mozePoništiti = $derived(proslost.length > 0);
  const mozePonoviti = $derived(buducnost.length > 0);
  const mozeVratitiSpremljeno = $derived(!konfiguracijeJednake(draft, spremljeno));

  const aktivnePotkategorije = $derived(POTKATEGORIJE[aktivnaGlavna]);
  const aktivnaPot = $derived(
    aktivnePotkategorije.find((p) => p.kljuc === aktivniPotkljuc) ?? aktivnePotkategorije[0]!,
  );

  const nausniceOnemogucene = $derived(
    aktivnaPot.kljuc === 'earrings' && draft.parts.ears === 'detached',
  );

  const ulogaBoje = $derived.by((): AvatarBojnaUloga | null => {
    const kljuc = aktivnaPot.kljuc;
    if (kljuc === 'skin') return 'skin';
    if (kljuc === 'ears' || kljuc === 'nose' || kljuc === 'mouth' || kljuc === 'base' || kljuc === 'background') {
      return null;
    }
    const uloga = ulogaBojeKategorije(kljuc) as AvatarBojnaUloga | null;
    if (!uloga) return null;
    if (draft.parts[kljuc] === null) return null;
    return uloga;
  });

  const presetiAktivne = $derived(ulogaBoje ? PRESETI_BOJA_AVATARA[ulogaBoje] : []);
  const trenutnaBoja = $derived(ulogaBoje ? draft.colors[ulogaBoje] ?? null : null);
  const customBojaAktivna = $derived(
    Boolean(trenutnaBoja && ulogaBoje && !PRESETI_BOJA_AVATARA[ulogaBoje].includes(trenutnaBoja)),
  );

  const aktivneVrijednosti = $derived.by(() => {
    if (aktivnaPot.kljuc === 'skin') return [] as (string | null)[];
    const kljuc = aktivnaPot.kljuc as keyof AvatarDijelovi;
    const dijelovi = (AVATAR_DIJELOVI[kljuc] as readonly string[]).filter(
      (vrijednost) => kljuc !== 'ears' || vrijednost !== 'detached',
    );
    return [...(aktivnaPot.obavezno ? [] : [null]), ...dijelovi];
  });

  const brojStilova = $derived(
    aktivnaPot.kljuc === 'skin' ? 0 : aktivneVrijednosti.filter((v) => v !== null).length,
  );

  const indeksOpcije = $derived.by(() => {
    if (aktivnaPot.kljuc === 'skin' || aktivneVrijednosti.length === 0) return 0;
    const kljuc = aktivnaPot.kljuc as keyof AvatarDijelovi;
    const indeks = aktivneVrijednosti.findIndex((v) => v === draft.parts[kljuc]);
    return indeks >= 0 ? indeks : 0;
  });

  const brojacOpcije = $derived(
    aktivneVrijednosti.length === 0 ? '' : `${indeksOpcije + 1}/${aktivneVrijednosti.length}`,
  );

  function zapisiPrijeIzmjene() {
    proslost = [...proslost, kopirajKonfiguraciju(draft)].slice(-MAKS_POVIJEST);
    buducnost = [];
  }

  function postaviDraft(nova: AvatarConfigV1, zapisiPovijest = true) {
    if (konfiguracijeJednake(nova, draft)) return;
    if (zapisiPovijest) zapisiPrijeIzmjene();
    draft = kopirajKonfiguraciju(nova);
  }

  function odaberiGlavnu(id: GlavnaId) {
    aktivnaGlavna = id;
    aktivniPotkljuc = zadnjePotkategorije[id];
  }

  function odaberiPot(kljuc: Potkljuc) {
    aktivniPotkljuc = kljuc;
    zadnjePotkategorije = { ...zadnjePotkategorije, [aktivnaGlavna]: kljuc };
  }

  function promijeniDio(kljuc: keyof AvatarDijelovi, vrijednost: AvatarDijelovi[keyof AvatarDijelovi]) {
    if (draft.parts[kljuc] === vrijednost) return;
    if (kljuc === 'earrings' && draft.parts.ears === 'detached') return;
    if (kljuc === 'ears' && vrijednost === 'detached') return;
    const parts = { ...draft.parts, [kljuc]: vrijednost };
    postaviDraft({ ...draft, parts });
  }

  function pomakniOpciju(smjer: -1 | 1) {
    if (aktivnaPot.kljuc === 'skin' || aktivneVrijednosti.length === 0) return;
    if (nausniceOnemogucene || spremanje) return;
    const kljuc = aktivnaPot.kljuc as keyof AvatarDijelovi;
    const ukupno = aktivneVrijednosti.length;
    const noviIndeks = (indeksOpcije + smjer + ukupno) % ukupno;
    const vrijednost = aktivneVrijednosti[noviIndeks] as AvatarDijelovi[keyof AvatarDijelovi];
    promijeniDio(kljuc, vrijednost);
  }

  function promijeniBoju(uloga: AvatarBojnaUloga, vrijednost: string, grupirajCustom = false) {
    if ((draft.colors[uloga] ?? null) === vrijednost) return;
    if (grupirajCustom) {
      if (customBojaUTijeku !== uloga) {
        customBojaUTijeku = uloga;
        zapisiPrijeIzmjene();
      }
      draft = { ...draft, colors: { ...draft.colors, [uloga]: vrijednost } };
      return;
    }
    postaviDraft({ ...draft, colors: { ...draft.colors, [uloga]: vrijednost } });
  }

  function zavrsiCustomBoju() {
    customBojaUTijeku = null;
  }

  function naslovPalete(potNaziv: string): string {
    if (potNaziv === 'Koža') return 'Boja kože';
    if (potNaziv === 'Frizura') return 'Boja kose';
    if (potNaziv === 'Brada i brkovi') return 'Boja brade';
    if (potNaziv === 'Odjeća') return 'Boja odjeće';
    return `Boja (${potNaziv.toLowerCase()})`;
  }

  function nasumicno() {
    postaviDraft(nasumicnaKonfiguracijaAvatara());
  }

  function ponisti() {
    const prethodna = proslost[proslost.length - 1];
    if (!prethodna) return;
    proslost = proslost.slice(0, -1);
    buducnost = [...buducnost, kopirajKonfiguraciju(draft)];
    draft = kopirajKonfiguraciju(prethodna);
  }

  function ponovi() {
    const sljedeca = buducnost[buducnost.length - 1];
    if (!sljedeca) return;
    buducnost = buducnost.slice(0, -1);
    proslost = [...proslost, kopirajKonfiguraciju(draft)].slice(-MAKS_POVIJEST);
    draft = kopirajKonfiguraciju(sljedeca);
  }

  function vratiSpremljeni() {
    if (konfiguracijeJednake(draft, spremljeno)) return;
    postaviDraft(spremljeno);
  }

  function potvrdiIzlaz(): boolean {
    if (!izmijenjeno || skracivanjeSpremanja) return true;
    return confirm('Imaš nespremljene promjene avatara. Želiš li ipak otići?');
  }

  function odustani() {
    if (!potvrdiIzlaz()) return;
    skracivanjeSpremanja = true;
    void goto('/profil');
  }

  async function spremi() {
    if ((!izmijenjeno && !spremiBezPromjene) || spremanje || !ucitavanjeUspjelo) return;
    const snapshot = kopirajKonfiguraciju(draft);
    skracivanjeSpremanja = true;
    try {
      await onSpremi(snapshot);
      spremljeno = kopirajKonfiguraciju(snapshot);
      draft = kopirajKonfiguraciju(snapshot);
      proslost = [];
      buducnost = [];
    } catch {
      skracivanjeSpremanja = false;
    }
  }

  function ariaLabelDijela(vrijednost: string | null, indeks: number, ukupno: number): string {
    if (vrijednost === null) return NAZIVI_BEZ[aktivnaPot.kljuc] ?? 'Bez dodatka';
    return `${aktivnaPot.naziv} ${indeks} od ${ukupno}`;
  }

  function bojaZaSlicicu(): string | null {
    const uloga = ulogaBojeKategorije(String(aktivnaPot.kljuc)) as AvatarBojnaUloga | null;
    return uloga ? draft.colors[uloga] ?? null : null;
  }

  function osvjeziPreviewVelicinu() {
    if (typeof window === 'undefined') return;
    previewVelicina = window.matchMedia('(min-width: 960px)').matches
      ? 260
      : window.matchMedia('(max-width: 480px)').matches
        ? 120
        : 140;
  }

  function prijeUnload(e: BeforeUnloadEvent) {
    if (!izmijenjeno || skracivanjeSpremanja) return;
    e.preventDefault();
    e.returnValue = '';
  }

  beforeNavigate(({ cancel }) => {
    if (skracivanjeSpremanja || !izmijenjeno) return;
    if (!confirm('Imaš nespremljene promjene avatara. Želiš li ipak otići?')) {
      cancel();
    }
  });

  onMount(() => {
    osvjeziPreviewVelicinu();
    window.addEventListener('resize', osvjeziPreviewVelicinu);
    window.addEventListener('beforeunload', prijeUnload);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('resize', osvjeziPreviewVelicinu);
    window.removeEventListener('beforeunload', prijeUnload);
  });
</script>

<section class="editor" aria-labelledby="avatar-editor-naslov" aria-busy={spremanje}>
  <div class="editor-zaglavlje">
    <h1 id="avatar-editor-naslov">{naslov}</h1>
  </div>

  <div class="radni-prostor">
    <aside class="lijevo">
      <div class="preview-traka">
        <div class="preview" style:--preview-vel="{previewVelicina}px">
          <AvatarKonfiguracijaPreview konfiguracija={draft} velicina={previewVelicina} {rang} />
        </div>
      </div>

      <div class="panel-akcije">
        <div class="povijest-red">
          <button type="button" class="ikona-akcija" onclick={ponisti} disabled={!mozePoništiti || spremanje} aria-label="Poništi">
            <Undo2 size={22} strokeWidth={2.25} aria-hidden="true" />
            <span class="akcija-tekst">Poništi</span>
          </button>
          <button type="button" class="nasumicno" onclick={nasumicno} disabled={spremanje}>
            <Dices size={22} strokeWidth={2.25} aria-hidden="true" />
            <span>Nasumično</span>
          </button>
          <button type="button" class="ikona-akcija" onclick={ponovi} disabled={!mozePonoviti || spremanje} aria-label="Ponovi">
            <Redo2 size={22} strokeWidth={2.25} aria-hidden="true" />
            <span class="akcija-tekst">Ponovi</span>
          </button>
        </div>

        <button
          type="button"
          class="vrati-spremljeni"
          onclick={vratiSpremljeni}
          disabled={!mozeVratitiSpremljeno || spremanje}
        >
          Vrati spremljeni avatar
        </button>
      </div>
    </aside>

    <section class="izbori" aria-labelledby="naslov-kategorije">
      <nav class="glavne" aria-label="Glavne kategorije">
        {#each GLAUNE as grupa (grupa.id)}
          <button
            type="button"
            class="glavna"
            aria-pressed={aktivnaGlavna === grupa.id}
            onclick={() => odaberiGlavnu(grupa.id)}
            disabled={spremanje}
          >
            <span class="glavna-ikona" aria-hidden="true">
              {#if grupa.id === 'lice'}
                <svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 20c1.5-3 4-4 6-4s4.5 1 6 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              {:else if grupa.id === 'kosa'}
                <svg viewBox="0 0 24 24"><path d="M6 14c0-5 2.5-9 6-9s6 4 6 9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 14h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              {:else if grupa.id === 'odjeca'}
                <svg viewBox="0 0 24 24"><path d="M9 6l3 2 3-2 4 3-2 3v8H7v-8L5 9l4-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
              {:else}
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h3M17 12h3M12 4v3M12 17v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              {/if}
            </span>
            <span>{grupa.naziv}</span>
          </button>
        {/each}
      </nav>

      {#if aktivnePotkategorije.length > 1}
        <div class="potkategorije" role="group" aria-label="Potkategorije">
          {#each aktivnePotkategorije as pot (pot.kljuc)}
            <button
              type="button"
              class="pot"
              aria-pressed={aktivnaPot.kljuc === pot.kljuc}
              onclick={() => odaberiPot(pot.kljuc)}
              disabled={spremanje}
            >
              {pot.naziv}
            </button>
          {/each}
        </div>
      {/if}

      <div
        class="sekcija-naslov"
        class:sakrij-uz-karusel={aktivnaPot.kljuc !== 'skin'}
      >
        <h2 id="naslov-kategorije">{aktivnaPot.naziv}</h2>
        {#if brojStilova > 0}
          <span class="broj-stilova">{brojStilova} stilova</span>
        {/if}
      </div>

      {#if nausniceOnemogucene}
        <p class="upozorenje" role="status">Odaberi kompatibilne uši za dodavanje naušnica.</p>
      {/if}

      <div class="paleta-prostor" aria-hidden={ulogaBoje === null}>
        {#if ulogaBoje}
          <div class="paleta" role="group" aria-label={`Boja: ${aktivnaPot.naziv}`}>
            <span class="paleta-naslov">{naslovPalete(aktivnaPot.naziv)}</span>
            <div class="paleta-red">
              {#each presetiAktivne as boja (boja)}
                <button
                  type="button"
                  class="uzorak"
                  style:background={boja}
                  aria-label={`Boja ${boja}`}
                  aria-pressed={trenutnaBoja?.toLowerCase() === boja.toLowerCase()}
                  disabled={spremanje}
                  onclick={() => promijeniBoju(ulogaBoje, boja)}
                >
                  {#if trenutnaBoja?.toLowerCase() === boja.toLowerCase()}
                    <span class="kvacica" aria-hidden="true">✓</span>
                  {/if}
                </button>
              {/each}
              <label class="uzorak custom" class:odabran={customBojaAktivna}>
                <input
                  type="color"
                  value={trenutnaBoja ?? '#888888'}
                  aria-label="Prilagođena boja"
                  disabled={spremanje}
                  oninput={(e) => promijeniBoju(ulogaBoje, e.currentTarget.value, true)}
                  onchange={zavrsiCustomBoju}
                />
                {#if customBojaAktivna}
                  <span class="custom-pregled" style:background={trenutnaBoja}></span>
                {:else}
                  <span class="plus" aria-hidden="true">+</span>
                {/if}
              </label>
            </div>
          </div>
        {/if}
      </div>

      {#if aktivnaPot.kljuc !== 'skin'}
        <div
          class="karusel-opcija"
          role="group"
          aria-labelledby="naslov-kategorije-karusel"
          aria-disabled={nausniceOnemogucene || spremanje}
        >
          <button
            type="button"
            class="karusel-strelica"
            aria-label={`Prethodna opcija: ${aktivnaPot.naziv}`}
            disabled={nausniceOnemogucene || spremanje || aktivneVrijednosti.length <= 1}
            onclick={() => pomakniOpciju(-1)}
          >
            <ChevronLeft size={28} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <div class="karusel-sredina">
            <span id="naslov-kategorije-karusel" class="karusel-naziv">{aktivnaPot.naziv}</span>
            {#if brojacOpcije}
              <span class="karusel-brojac" aria-live="polite">{brojacOpcije}</span>
            {/if}
          </div>
          <button
            type="button"
            class="karusel-strelica"
            aria-label={`Sljedeća opcija: ${aktivnaPot.naziv}`}
            disabled={nausniceOnemogucene || spremanje || aktivneVrijednosti.length <= 1}
            onclick={() => pomakniOpciju(1)}
          >
            <ChevronRight size={28} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        <div
          class="mrezica"
          role="group"
          aria-label={`Izbor za: ${aktivnaPot.naziv}`}
          aria-disabled={nausniceOnemogucene || spremanje}
        >
          {#each aktivneVrijednosti as vrijednost, indeks (vrijednost ?? 'bez')}
            {@const redni = vrijednost === null ? 0 : aktivnaPot.obavezno ? indeks + 1 : indeks}
            {@const dioKljuc = aktivnaPot.kljuc as keyof AvatarDijelovi}
            {@const odabrano = vrijednost === draft.parts[dioKljuc]}
            <button
              type="button"
              class="kartica"
              class:bez-dodatka={vrijednost === null}
              class:odabrano={odabrano}
              aria-pressed={odabrano}
              aria-label={ariaLabelDijela(vrijednost, redni, brojStilova)}
              disabled={nausniceOnemogucene || spremanje}
              onclick={() =>
                promijeniDio(dioKljuc, vrijednost as AvatarDijelovi[keyof AvatarDijelovi])}
            >
              {#if vrijednost === null}
                <span class="bez-ikona" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
                <span class="bez-tekst">{NAZIVI_BEZ[aktivnaPot.kljuc]}</span>
              {:else}
                <AvatarDioPreview
                  kategorija={String(dioKljuc)}
                  {vrijednost}
                  boja={bojaZaSlicicu()}
                />
              {/if}
              {#if odabrano}
                <span class="kartica-kvacica" aria-hidden="true">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <div class="akcijska-traka">
    {#if izmijenjeno}
      <p class="dirty" role="status"><span class="dirty-tocka" aria-hidden="true"></span> Nespremljene promjene</p>
    {:else}
      <p class="dirty prazno" aria-hidden="true"></p>
    {/if}
    <div class="akcije">
      <button type="button" class="odustani" onclick={odustani} disabled={spremanje}>Odustani</button>
      <button
        type="button"
        class="spremi"
        onclick={spremi}
        disabled={(!izmijenjeno && !spremiBezPromjene) || spremanje || !ucitavanjeUspjelo}
      >
        {spremanje ? 'Spremanje…' : tekstSpremanja}
      </button>
    </div>
  </div>
</section>

<style>
  .editor {
    display: grid;
    gap: 24px;
    padding: 12px 0 calc(96px + env(safe-area-inset-bottom));
  }

  .editor-zaglavlje {
    margin-bottom: 4px;
  }

  h1 {
    margin: 0;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: clamp(1.35rem, 2vw, 1.75rem);
  }

  h2 {
    margin: 0;
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: var(--naslov-3);
  }

  .radni-prostor {
    display: grid;
    gap: 24px;
  }

  .lijevo {
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .preview-traka {
    display: grid;
    justify-items: center;
  }

  .panel-akcije {
    display: grid;
    gap: 10px;
    justify-items: center;
  }

  .preview {
    width: var(--preview-vel, 140px);
    height: var(--preview-vel, 140px);
    display: grid;
    place-items: center;
  }

  .povijest-red {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding-top: 4px;
  }

  .ikona-akcija {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 44px;
    min-height: 44px;
    padding: 6px;
    border: none;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-mikro);
    cursor: pointer;
  }

  .ikona-akcija :global(svg),
  .nasumicno :global(svg) {
    flex-shrink: 0;
  }

  .nasumicno {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 12px 20px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kontrola);
    background: var(--boja-povrsina-3);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
  }

  .vrati-spremljeni {
    border: none;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: var(--tekst-sitni);
    text-decoration: underline;
    cursor: pointer;
    min-height: 40px;
    margin-top: 2px;
  }

  .izbori {
    display: grid;
    gap: 16px;
    align-content: start;
    min-width: 0;
  }

  .glavne {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .glavna {
    display: grid;
    justify-items: center;
    gap: 6px;
    min-height: 72px;
    padding: 12px 6px;
    border: 1px solid var(--boja-obrub);
    border-radius: 14px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
  }

  .glavna[aria-pressed='true'] {
    border-color: var(--boja-isticanje-slova);
    background: var(--boja-povrsina-3);
    color: var(--boja-isticanje-tekst);
  }

  .glavna-ikona {
    width: 24px;
    height: 24px;
    color: inherit;
  }

  .glavna-ikona svg {
    width: 100%;
    height: 100%;
  }

  .potkategorije {
    display: flex;
    flex-wrap: nowrap;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .pot {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kontrola);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
  }

  .pot[aria-pressed='true'] {
    border-color: var(--boja-isticanje-slova);
    background: var(--boja-povrsina-3);
    color: var(--boja-isticanje-tekst);
  }

  .sekcija-naslov {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding-top: 4px;
  }

  .broj-stilova {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mikro);
    font-weight: 600;
    white-space: nowrap;
  }

  .upozorenje {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .paleta-prostor {
    min-height: 84px;
  }

  .paleta {
    display: grid;
    gap: 12px;
  }

  .paleta-naslov {
    font-size: var(--tekst-sitni);
    font-weight: 700;
    color: var(--boja-tekst-osnovni);
  }

  .paleta-red {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .uzorak {
    position: relative;
    width: 44px;
    height: 44px;
    border: 2px solid transparent;
    border-radius: 999px;
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .uzorak[aria-pressed='true'],
  .uzorak.odabran {
    border-color: var(--boja-isticanje-slova);
  }

  .uzorak .kvacica {
    color: #fff;
    font-weight: 800;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }

  .uzorak.custom {
    border: 1px dashed var(--boja-obrub);
    background: var(--boja-povrsina-2);
    overflow: hidden;
  }

  .uzorak.custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .uzorak .plus {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--boja-tekst-sekundarni);
  }

  .custom-pregled {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    pointer-events: none;
  }

  .karusel-opcija {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 4px 0;
  }

  .karusel-strelica {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--boja-obrub);
    border-radius: 14px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
  }

  .karusel-sredina {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
    text-align: center;
  }

  .karusel-naziv {
    color: var(--boja-tekst-naslov);
    font-family: var(--font-naslov);
    font-size: var(--naslov-3);
    font-weight: 700;
    line-height: 1.2;
  }

  .karusel-brojac {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mikro);
    font-weight: 600;
  }

  .mrezica {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    padding-top: 4px;
  }

  .kartica {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 8px;
    border: 2px solid var(--boja-obrub);
    border-radius: 14px;
    background: var(--boja-povrsina);
    cursor: pointer;
  }

  .kartica.odabrano,
  .kartica[aria-pressed='true'] {
    border-color: var(--boja-isticanje-slova);
    border-width: 3px;
    background: var(--boja-povrsina-3);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--boja-isticanje-slova) 35%, transparent);
  }

  .kartica:focus-visible,
  .glavna:focus-visible,
  .pot:focus-visible,
  .uzorak:focus-visible,
  .nasumicno:focus-visible,
  .ikona-akcija:focus-visible,
  .karusel-strelica:focus-visible,
  .odustani:focus-visible,
  .spremi:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
  }

  .kartica-kvacica {
    position: absolute;
    right: 6px;
    bottom: 6px;
    z-index: 2;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--boja-isticanje-slova);
    color: #111;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }

  .kartica.bez-dodatka {
    gap: 4px;
    color: var(--boja-tekst-sekundarni);
    font: inherit;
    font-size: var(--tekst-mikro);
    font-weight: 700;
    text-align: center;
  }

  .bez-ikona {
    width: 28px;
    height: 28px;
  }

  .bez-ikona svg {
    width: 100%;
    height: 100%;
  }

  .bez-tekst {
    line-height: 1.15;
  }

  .akcijska-traka {
    position: sticky;
    bottom: 0;
    z-index: 3;
    display: grid;
    gap: 8px;
    padding: 10px 0 calc(8px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--boja-pozadina-podloga) 92%, transparent);
    backdrop-filter: blur(6px);
  }

  .dirty {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    min-height: 1.2em;
  }

  .dirty.prazno {
    visibility: hidden;
  }

  .dirty-tocka {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--boja-isticanje-slova, #e7a33a);
  }

  .akcije {
    display: flex;
    gap: 10px;
  }

  .akcije button {
    flex: 1;
    min-height: 48px;
    padding: 12px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kontrola);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
  }

  .akcije .spremi {
    border-color: var(--boja-cta-pozadina);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    flex: 1.35;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .editor[aria-busy='true'] button:disabled {
    cursor: wait;
  }

  @media (min-width: 960px) {
    .editor {
      gap: 28px;
      padding: 16px 0 32px;
    }

    .radni-prostor {
      grid-template-columns: 300px minmax(0, 1fr);
      align-items: start;
      gap: 40px;
    }

    .lijevo {
      position: sticky;
      top: 20px;
      gap: 22px;
    }

    .preview {
      width: 260px;
      height: 260px;
    }

    .izbori {
      gap: 18px;
    }

    .akcija-tekst {
      display: inline;
    }

    .karusel-opcija {
      display: none;
    }

    .mrezica {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
    }

    .akcijska-traka {
      position: sticky;
      bottom: 0;
      justify-items: end;
      margin-top: 8px;
      padding-top: 16px;
    }

    .akcije {
      width: min(420px, 100%);
      gap: 12px;
    }
  }

  @media (max-width: 959px) {
    /*
     * display:contents čini preview/akcije/izbore braćom unutar .radni-prostor,
     * pa sticky avatar traje kroz mrežu i na dnu nastavlja skrolati dolje.
     */
    .lijevo {
      display: contents;
    }

    .preview-traka {
      position: sticky;
      top: 0;
      z-index: 3;
      width: 100%;
      padding: 8px 0 10px;
      background: var(--boja-pozadina-podloga);
    }

    .akcija-tekst {
      display: none;
    }

    .sekcija-naslov.sakrij-uz-karusel {
      display: none;
    }

    .karusel-opcija {
      display: flex;
    }

    .mrezica {
      display: none;
    }
  }

  @media (max-width: 360px) {
    .mrezica {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kartica,
    .uzorak,
    .glavna,
    .pot {
      transition: none;
    }
  }
</style>
