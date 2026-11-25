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
  const VELICINE_U_IGRI = [32, 48, 56] as const;

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
    draft = kopirajKonfiguraciju(pocetnaKonfiguracija);
    spremljeno = kopirajKonfiguraciju(pocetnaKonfiguracija);
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
    return [
      ...(aktivnaPot.obavezno ? [] : [null]),
      ...(AVATAR_DIJELOVI[kljuc] as readonly string[]),
    ];
  });

  const brojStilova = $derived(
    aktivnaPot.kljuc === 'skin'
      ? 0
      : (AVATAR_DIJELOVI[aktivnaPot.kljuc as keyof AvatarDijelovi] as readonly string[]).length,
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
    const parts = { ...draft.parts, [kljuc]: vrijednost };
    if (kljuc === 'ears' && vrijednost === 'detached') {
      parts.earrings = null;
    }
    postaviDraft({ ...draft, parts });
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
    <button type="button" class="natrag" onclick={odustani} aria-label="Natrag na profil">←</button>
    <h1 id="avatar-editor-naslov">{naslov}</h1>
  </div>

  <div class="radni-prostor">
    <aside class="panel">
      <div class="panel-vrh">
        <div class="preview" style:--preview-vel="{previewVelicina}px">
          <AvatarKonfiguracijaPreview konfiguracija={draft} velicina={previewVelicina} {rang} />
        </div>

        <div class="izgled-u-igri desktop-only" aria-label="Izgled u igri">
          <span class="izgled-naslov">Izgled u igri</span>
          <div class="izgled-red">
            {#each VELICINE_U_IGRI as velicina (velicina)}
              <AvatarKonfiguracijaPreview konfiguracija={draft} {velicina} {rang} />
            {/each}
          </div>
        </div>

        <div class="povijest-red">
          <button type="button" class="ikona-akcija" onclick={ponisti} disabled={!mozePoništiti || spremanje} aria-label="Poništi">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20a8 8 0 0 0-8-8H4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <span class="akcija-tekst">Poništi</span>
          </button>
          <button type="button" class="nasumicno" onclick={nasumicno} disabled={spremanje}>
            <svg viewBox="0 0 24 24" aria-hidden="true" class="kockica"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></svg>
            <span>Nasumično</span>
          </button>
          <button type="button" class="ikona-akcija" onclick={ponovi} disabled={!mozePonoviti || spremanje} aria-label="Ponovi">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l5-5-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20a8 8 0 0 1 8-8h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
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

      <div class="sekcija-naslov">
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
    gap: 16px;
    padding: 16px 0 calc(88px + env(safe-area-inset-bottom));
  }

  .editor-zaglavlje {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .natrag {
    width: 40px;
    height: 40px;
    border: 1px solid var(--boja-obrub);
    border-radius: 999px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
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
    gap: 18px;
  }

  .panel {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .panel-vrh {
    display: grid;
    gap: 12px;
    justify-items: center;
  }

  .preview {
    width: var(--preview-vel, 140px);
    height: var(--preview-vel, 140px);
    display: grid;
    place-items: center;
  }

  .izgled-u-igri {
    display: grid;
    gap: 6px;
    justify-items: center;
  }

  .izgled-naslov {
    font-size: var(--tekst-mikro);
    color: var(--boja-tekst-sekundarni);
    font-weight: 600;
  }

  .izgled-red {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .povijest-red {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
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

  .ikona-akcija svg,
  .nasumicno svg {
    width: 22px;
    height: 22px;
  }

  .nasumicno {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-pill);
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
    min-height: 44px;
  }

  .glavne {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .glavna {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-height: 64px;
    padding: 8px 4px;
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-mikro);
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
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }

  .pot {
    flex: 0 0 auto;
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-pill);
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
    gap: 12px;
    margin-top: 8px;
  }

  .broj-stilova {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mikro);
    font-weight: 600;
  }

  .upozorenje {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .paleta-prostor {
    min-height: 72px;
  }

  .paleta {
    display: grid;
    gap: 8px;
  }

  .paleta-naslov {
    font-size: var(--tekst-sitni);
    font-weight: 700;
    color: var(--boja-tekst-osnovni);
  }

  .paleta-red {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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

  .mrezica {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .kartica {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 6px;
    border: 2px solid var(--boja-obrub);
    border-radius: 12px;
    background: var(--boja-povrsina);
    cursor: pointer;
  }

  .kartica.odabrano,
  .kartica[aria-pressed='true'] {
    border-color: var(--boja-isticanje-slova);
    background: var(--boja-povrsina-3);
  }

  .kartica:focus-visible,
  .glavna:focus-visible,
  .pot:focus-visible,
  .uzorak:focus-visible,
  .nasumicno:focus-visible,
  .ikona-akcija:focus-visible,
  .odustani:focus-visible,
  .spremi:focus-visible,
  .natrag:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
  }

  .kartica-kvacica {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--boja-isticanje-slova);
    color: #111;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
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
    border-radius: var(--radijus-pill);
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

  .desktop-only {
    display: none;
  }

  @media (min-width: 960px) {
    .editor {
      padding-bottom: 24px;
    }

    .radni-prostor {
      grid-template-columns: 300px minmax(0, 1fr);
      align-items: start;
      gap: 28px;
    }

    .panel {
      position: sticky;
      top: 16px;
    }

    .preview {
      width: 260px;
      height: 260px;
    }

    .desktop-only {
      display: grid;
    }

    .akcija-tekst {
      display: inline;
    }

    .mrezica {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    .akcijska-traka {
      position: sticky;
      bottom: 0;
      justify-items: end;
    }

    .akcije {
      width: min(420px, 100%);
    }
  }

  @media (max-width: 959px) {
    .panel-vrh {
      position: sticky;
      top: 0;
      z-index: 2;
      padding-block: 6px 8px;
      background: var(--boja-pozadina-podloga);
    }

    .glavne {
      position: sticky;
      top: calc(var(--preview-vel, 140px) + 84px);
      z-index: 2;
      padding-block: 6px;
      background: var(--boja-pozadina-podloga);
    }

    .akcija-tekst {
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
