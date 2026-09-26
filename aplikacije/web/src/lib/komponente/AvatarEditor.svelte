<script lang="ts">
  import {
    AVATAR_DIJELOVI,
    ZADANI_AVATAR_CONFIG,
    type AvatarConfigV1,
    type AvatarDijelovi,
  } from 'zajednicko';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';

  interface Props {
    pocetnaKonfiguracija?: AvatarConfigV1;
    naslov?: string;
    tekstSpremanja?: string;
    spremanje?: boolean;
    spremiBezPromjene?: boolean;
    onSpremi: (konfiguracija: AvatarConfigV1) => void | Promise<void>;
  }

  let {
    pocetnaKonfiguracija = ZADANI_AVATAR_CONFIG,
    naslov = 'Uredi avatar',
    tekstSpremanja = 'Spremi',
    spremanje = false,
    spremiBezPromjene = false,
    onSpremi,
  }: Props = $props();

  function kopirajKonfiguraciju(konfiguracija: AvatarConfigV1): AvatarConfigV1 {
    return {
      ...konfiguracija,
      parts: { ...konfiguracija.parts },
      colors: { ...konfiguracija.colors },
    };
  }

  let draft = $state<AvatarConfigV1>(kopirajKonfiguraciju(ZADANI_AVATAR_CONFIG));
  let spremljeno = $state<AvatarConfigV1>(kopirajKonfiguraciju(ZADANI_AVATAR_CONFIG));
  let inicijalizirano = false;
  let aktivniIndeks = $state(0);
  $effect(() => {
    if (inicijalizirano) return;
    draft = kopirajKonfiguraciju(pocetnaKonfiguracija);
    spremljeno = kopirajKonfiguraciju(pocetnaKonfiguracija);
    inicijalizirano = true;
  });
  const izmijenjeno = $derived(JSON.stringify(draft) !== JSON.stringify(spremljeno));

  const kategorije: { kljuc: keyof AvatarDijelovi; naziv: string; obavezno: boolean }[] = [
    { kljuc: 'base', naziv: 'Koža', obavezno: true },
    { kljuc: 'mouth', naziv: 'Usta', obavezno: true },
    { kljuc: 'hair', naziv: 'Kosa', obavezno: false },
    { kljuc: 'eyes', naziv: 'Oči', obavezno: true },
    { kljuc: 'eyebrows', naziv: 'Obrve', obavezno: false },
    { kljuc: 'nose', naziv: 'Nos', obavezno: false },
    { kljuc: 'ears', naziv: 'Uši', obavezno: true },
    { kljuc: 'shirt', naziv: 'Odjeća', obavezno: false },
    { kljuc: 'glasses', naziv: 'Naočale', obavezno: false },
    { kljuc: 'earrings', naziv: 'Naušnice', obavezno: false },
    { kljuc: 'facialHair', naziv: 'Brada', obavezno: false },
  ];

  const naziviDijelova: Record<string, Record<string, string>> = {
    mouth: { surprised: 'Iznenađena', laughing: 'Nasmijana', smile: 'Osmijeh', smirk: 'Cerek', sad: 'Tužna', frown: 'Namrštena', pucker: 'Kissy', nervous: 'Nervozna' },
    hair: { fonze: 'Fonze', 'mr-t': 'Mr. T', 'doug-funny': 'Doug smiješni', 'mr-clean': 'Rupa u glavi', 'danny-phantom': 'Danny Phantom', full: 'Puna kosa', turban: 'Turban', pixie: 'Pixie' },
    eyes: { eyes: 'Obične', smiling: 'Vesele', eyeshadow: 'Na LSD-u', round: 'Okrugle' },
    eyebrows: { up: 'Podignute', down: 'Spuštene', 'eyelashes-up': 'Trepavice gore', 'eyelashes-down': 'Trepavice dolje' },
    nose: { curve: 'Zaobljeni', pointed: 'Šiljasti', round: 'Okrugli' },
    shirt: { open: 'Otvorena', crew: 'Obična', collared: 'S kragnom' },
    glasses: { round: 'Okrugle', square: 'Četvrtaste' },
    earrings: { hoop: 'Karike', stud: 'Čepići' },
    facialHair: { beard: 'Prava brada', scruff: 'Trodnevna brada' },
    ears: { attached: 'Priljubljene', detached: 'Odvojene' },
  };

  const presetiBoja: Record<string, string[]> = {
    skin: ['#AC6651', '#F1B28D', '#F6D2B8', '#8D4F3D', '#5C342B', '#D98B6C', '#7B4538', '#F0C7A8'],
    hair: ['#171921', '#5A3825', '#B97945', '#E7C05B', '#E77979', '#A33B59', '#3D6B8C', '#D7D7D7'],
    shirt: ['#6BD9E9', '#7774E8', '#F08A9D', '#7ACB86', '#F2C14E', '#F28F3B', '#4D8CBE', '#A66DD4'],
    eyes: ['#171921', '#2B6CB0', '#319795', '#6B46C1', '#9B2C2C', '#2F855A', '#B7791F', '#805AD5'],
    eyebrows: ['#171921', '#5A3825', '#B97945', '#E77979', '#3D6B8C'],
    glasses: ['#171921', '#2B6CB0', '#B7791F', '#9B2C2C', '#7B4538', '#4A5568'],
    earrings: ['#F4D150', '#E77979', '#2B6CB0', '#171921', '#7ACB86', '#F28F3B'],
    facialHair: ['#171921', '#5A3825', '#B97945', '#E77979', '#3D6B8C'],
  };

  const aktivnaKategorija = $derived(kategorije[aktivniIndeks] ?? kategorije[0]);
  const aktivneVrijednosti = $derived([
    ...(aktivnaKategorija.obavezno ? [] : [null]),
    ...(AVATAR_DIJELOVI[aktivnaKategorija.kljuc] as readonly string[]),
  ]);
  const aktivnaVrijednost = $derived(draft.parts[aktivnaKategorija.kljuc]);
  const ulogaAktivneBoje = $derived(ulogaBojeZaDio(aktivnaKategorija.kljuc));
  const aktivnaBoja = $derived(ulogaAktivneBoje ? draft.colors[ulogaAktivneBoje] ?? '#000000' : null);
  const aktivniPreseti = $derived(ulogaAktivneBoje ? presetiBoja[ulogaAktivneBoje] ?? [] : []);

  function nazivDijela(kategorija: string, vrijednost: string | null): string {
    return vrijednost ? naziviDijelova[kategorija]?.[vrijednost] ?? vrijednost : 'Bez';
  }

  function promijeniDio<K extends keyof AvatarDijelovi>(kljuc: K, vrijednost: AvatarDijelovi[K]) {
    const parts = { ...draft.parts, [kljuc]: vrijednost };
    if (kljuc === 'ears' && vrijednost === 'detached') {
      parts.earrings = null;
    }
    draft = { ...draft, parts };
  }

  function promijeniBoju(uloga: keyof AvatarConfigV1['colors'], vrijednost: string) {
    draft = { ...draft, colors: { ...draft.colors, [uloga]: vrijednost } };
  }

  function ulogaBojeZaDio(kljuc: keyof AvatarDijelovi): keyof AvatarConfigV1['colors'] | null {
    if (kljuc === 'base') return 'skin';
    if (kljuc === 'hair' || kljuc === 'shirt' || kljuc === 'eyes' || kljuc === 'eyebrows' || kljuc === 'glasses' || kljuc === 'earrings' || kljuc === 'facialHair') return kljuc;
    return null;
  }

  function idiNaKategoriju(smjer: -1 | 1) {
    let noviIndeks = aktivniIndeks;
    do {
      noviIndeks = (noviIndeks + smjer + kategorije.length) % kategorije.length;
    } while (kategorije[noviIndeks]?.kljuc === 'earrings' && draft.parts.ears === 'detached');
    aktivniIndeks = noviIndeks;
  }

  function idiNaVrijednost(smjer: -1 | 1) {
    const indeks = aktivneVrijednosti.findIndex((vrijednost) => vrijednost === aktivnaVrijednost);
    const noviIndeks = (indeks + smjer + aktivneVrijednosti.length) % aktivneVrijednosti.length;
    promijeniDio(aktivnaKategorija.kljuc, aktivneVrijednosti[noviIndeks] as never);
  }

  function nasumicno() {
    const parts = { ...draft.parts };
    for (const kategorija of kategorije) {
      const izbori = AVATAR_DIJELOVI[kategorija.kljuc] as readonly string[];
      if (!kategorija.obavezno && Math.random() < 0.45) {
        parts[kategorija.kljuc] = null as never;
      } else {
        parts[kategorija.kljuc] = izbori[Math.floor(Math.random() * izbori.length)] as never;
      }
    }
    if (parts.ears === 'detached') parts.earrings = null;
    const boje = { ...draft.colors };
    boje.skin = presetiBoja.skin[Math.floor(Math.random() * presetiBoja.skin.length)]!;
    for (const kategorija of kategorije) {
      const uloga = ulogaBojeZaDio(kategorija.kljuc);
      if (!uloga || parts[kategorija.kljuc] === null) continue;
      const izboriBoja = presetiBoja[uloga];
      if (izboriBoja?.length) boje[uloga] = izboriBoja[Math.floor(Math.random() * izboriBoja.length)]!;
    }
    draft = { ...draft, parts, colors: boje };
  }

  function odustani() {
    draft = kopirajKonfiguraciju(spremljeno);
  }

  function odaberiPreset(boja: string) {
    if (ulogaAktivneBoje) promijeniBoju(ulogaAktivneBoje, boja);
  }

  function odaberiPresetZa(uloga: keyof AvatarConfigV1['colors'], boja: string) {
    promijeniBoju(uloga, boja);
  }

  function iznenadiBoju(uloga: keyof AvatarConfigV1['colors']) {
    const vrijednost = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    promijeniBoju(uloga, `#${vrijednost}`);
  }

  async function spremi() {
    if ((!izmijenjeno && !spremiBezPromjene) || spremanje) return;
    await onSpremi(kopirajKonfiguraciju(draft));
    spremljeno = kopirajKonfiguraciju(draft);
  }
</script>

<section class="editor" aria-labelledby="avatar-editor-naslov">
  <div class="editor-zaglavlje">
    <div>
      <h1 id="avatar-editor-naslov">{naslov}</h1>
    </div>
    <button type="button" class="nasumicno" onclick={nasumicno} disabled={spremanje}>Nasumično</button>
  </div>

  <div class="radni-prostor">
    <div class="preview"><AvatarKonfiguracijaPreview konfiguracija={draft} velicina={280} rang="Lektor" /></div>

    <div class="kontrole">
      <div class="navigator" aria-label="Odabir elementa avatara">
        <button type="button" class="strelica" aria-label="Prethodni element" onclick={() => idiNaKategoriju(-1)}>
          <img src="/ikone/03-nazad.png" alt="" aria-hidden="true" />
        </button>
        <div class="navigator-sredina">
          <h2>{aktivnaKategorija.naziv}</h2>
        </div>
        <button type="button" class="strelica" aria-label="Sljedeći element" onclick={() => idiNaKategoriju(1)}>
          <img src="/ikone/05-naprijed.png" alt="" aria-hidden="true" />
        </button>
      </div>

      {#if aktivnaKategorija.kljuc !== 'base'}
        <div class="izbor-navigator" aria-label={`Varijanta za ${aktivnaKategorija.naziv}`}>
          <button type="button" class="strelica mala" aria-label="Prethodna varijanta" onclick={() => idiNaVrijednost(-1)}>
            <img src="/ikone/03-nazad.png" alt="" aria-hidden="true" />
          </button>
          <div class="aktivni-izbor" aria-live="polite">{nazivDijela(aktivnaKategorija.kljuc, aktivnaVrijednost)}</div>
          <button type="button" class="strelica mala" aria-label="Sljedeća varijanta" onclick={() => idiNaVrijednost(1)}>
            <img src="/ikone/05-naprijed.png" alt="" aria-hidden="true" />
          </button>
        </div>
      {/if}

      {#if aktivnaKategorija.kljuc === 'base'}
        <div class="boje">
        <div class="preseti" aria-label="Preseti boje kože">
          {#each presetiBoja.skin as preset (preset)}
            <button type="button" class="preset" style={`background:${preset}`} aria-label={`Odaberi boju kože ${preset}`} class:odabrano={draft.colors.skin === preset} onclick={() => odaberiPresetZa('skin', preset)}></button>
          {/each}
          <button type="button" class="random-boja" aria-label="Nasumična boja kože" onclick={() => iznenadiBoju('skin')}>🎲</button>
        </div>
      </div>
      {/if}

      {#if aktivnaKategorija.kljuc !== 'base' && ulogaAktivneBoje && aktivnaVrijednost !== null}
        <div class="boje">
          <div class="preseti" aria-label="Preseti boje">
            {#each aktivniPreseti as preset (preset)}
              <button type="button" class="preset" style={`background:${preset}`} aria-label={`Odaberi boju ${preset}`} class:odabrano={aktivnaBoja === preset} onclick={() => odaberiPreset(preset)}></button>
            {/each}
            <button type="button" class="random-boja" aria-label="Nasumična boja" onclick={() => iznenadiBoju(ulogaAktivneBoje!)}>🎲</button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="akcije">
    <button type="button" class="odustani" onclick={odustani} disabled={!izmijenjeno || spremanje}>Odustani</button>
    <button type="button" class="spremi" onclick={spremi} disabled={(!izmijenjeno && !spremiBezPromjene) || spremanje}>{spremanje ? 'Spremanje…' : tekstSpremanja}</button>
  </div>
</section>

<style>
  .editor { display: grid; gap: 20px; padding: 24px 0 56px; }
  .editor-zaglavlje { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  h1 { margin: 0; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); }
  .radni-prostor { display: grid; gap: 20px; }
  .preview { display: grid; place-items: center; min-height: 300px; padding: 16px; }
  .kontrole { display: grid; align-content: start; gap: 14px; }
  .navigator, .izbor-navigator { display: grid; align-items: center; gap: 10px; }
  .navigator { grid-template-columns: 52px 1fr 52px; }
  .izbor-navigator { grid-template-columns: 34px 1fr 34px; }
  .navigator { min-height: 82px; padding: 10px; }
  .navigator-sredina { min-width: 0; text-align: center; }
  .navigator h2 { margin: 0; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: 1.5rem; }
  .strelica { display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .strelica img { width: 40px; height: 40px; object-fit: contain; }
  .strelica.mala { width: 30px; height: 30px; }
  .strelica.mala img { width: 30px; height: 30px; }
  .aktivni-izbor { display: grid; place-items: center; min-height: 40px; padding: 9px 14px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: 1.05rem; font-weight: 700; text-align: center; }
  .nasumicno, .odustani, .spremi { padding: 9px 14px; border: 1px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .nasumicno { border-color: #4f9d69; color: #3d8154; }
  .boje { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 12px 14px; }
  .preseti { display: flex; gap: 7px; }
  .preset { width: 26px; height: 26px; padding: 0; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 1px #cfc7b5; cursor: pointer; }
  .preset.odabrano { box-shadow: 0 0 0 2px var(--boja-pozadina-primarna); }
  .random-boja { display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; background: transparent; font-size: 1.2rem; line-height: 1; cursor: pointer; }
  .akcije { display: flex; justify-content: flex-end; gap: 10px; }
  .spremi { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
  button:disabled { cursor: wait; opacity: .55; }
  @media (min-width: 1000px) { .radni-prostor { grid-template-columns: minmax(360px, 1fr) minmax(420px, 1fr); align-items: start; gap: 32px; } .preview { position: sticky; top: 20px; } }
  @media (max-width: 600px) { .editor-zaglavlje { flex-direction: column; } .nasumicno { align-self: flex-start; } .navigator { grid-template-columns: 46px 1fr 46px; } .izbor-navigator { grid-template-columns: 34px 1fr 34px; gap: 5px; } .akcije { flex-direction: column-reverse; } .akcije button { width: 100%; } }
</style>
