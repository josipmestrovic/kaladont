<script lang="ts">
  import {
    AVATAR_DIJELOVI,
    PRESETI_BOJA_AVATARA,
    ZADANI_AVATAR_CONFIG,
    type AvatarConfigV1,
    type AvatarDijelovi,
  } from 'zajednicko';
  import AvatarKonfiguracijaPreview from './AvatarKonfiguracijaPreview.svelte';
  import AvatarDioPreview from './AvatarDioPreview.svelte';
  import { ulogaBojeKategorije } from '$lib/avatar-render.js';

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
  let aktivniKljuc = $state<keyof AvatarDijelovi>('hair');
  $effect(() => {
    if (inicijalizirano) return;
    draft = kopirajKonfiguraciju(pocetnaKonfiguracija);
    spremljeno = kopirajKonfiguraciju(pocetnaKonfiguracija);
    inicijalizirano = true;
  });
  const izmijenjeno = $derived(JSON.stringify(draft) !== JSON.stringify(spremljeno));

  // Koza nema mrezicu izbora - postoji samo jedna baza, a boja se bira medu ulogama boja.
  const kategorije: { kljuc: keyof AvatarDijelovi; naziv: string; obavezno: boolean }[] = [
    { kljuc: 'hair', naziv: 'Kosa', obavezno: false },
    { kljuc: 'eyes', naziv: 'Oči', obavezno: true },
    { kljuc: 'eyebrows', naziv: 'Obrve', obavezno: false },
    { kljuc: 'nose', naziv: 'Nos', obavezno: false },
    { kljuc: 'mouth', naziv: 'Usta', obavezno: true },
    { kljuc: 'ears', naziv: 'Uši', obavezno: true },
    { kljuc: 'shirt', naziv: 'Odjeća', obavezno: false },
    { kljuc: 'glasses', naziv: 'Naočale', obavezno: false },
    { kljuc: 'earrings', naziv: 'Naušnice', obavezno: false },
    { kljuc: 'facialHair', naziv: 'Brada', obavezno: false },
  ];

  const bojneUloge: { uloga: keyof AvatarConfigV1['colors']; naziv: string }[] = [
    { uloga: 'skin', naziv: 'Koža' },
    { uloga: 'hair', naziv: 'Kosa' },
    { uloga: 'shirt', naziv: 'Odjeća' },
    { uloga: 'eyes', naziv: 'Oči' },
    { uloga: 'eyebrows', naziv: 'Obrve' },
    { uloga: 'glasses', naziv: 'Naočale' },
    { uloga: 'earrings', naziv: 'Naušnice' },
    { uloga: 'facialHair', naziv: 'Brada' },
  ];

  const naziviDijelova: Record<string, Record<string, string>> = {
    mouth: { surprised: 'Iznenađena', laughing: 'Nasmijana', smile: 'Osmijeh', smirk: 'Cerek', sad: 'Tužna', frown: 'Namrštena', pucker: 'Kissy', nervous: 'Nervozna', 'k2-grin': 'Široki zubati osmijeh', 'k2-tooth-gap': 'Osmijeh s razmakom', 'k2-tongue-out': 'Isplažen jezik', 'k2-braces': 'Osmijeh s aparatićem', 'k2-gentle': 'Mali osmijeh', 'k2-whistle': 'Zviždanje', 'k2-determined': 'Odlučan izraz', 'k2-small-oh': 'Malo iznenađenje', 'k3-toothless-laugh': 'Bezub smijeh', 'k3-toothless-wide': 'Široki bezubi osmijeh', 'k3-gummy': 'Desni bez zuba', 'k3-lipstick-smile': 'Osmijeh s ružem', 'k3-lipstick-pout': 'Napučene usne s ružem', 'k3-crooked-grin': 'Šašavi osmijeh' },
    hair: { fonze: 'Fonze', 'mr-t': 'Mr. T', 'doug-funny': 'Doug smiješni', 'mr-clean': 'Rupa u glavi', 'danny-phantom': 'Danny Phantom', full: 'Puna kosa', turban: 'Turban', pixie: 'Pixie', 'k2-crop': 'Kratko ošišana', 'k2-side-part': 'Razdjeljak sa strane', 'k2-waves': 'Valovita kratka kosa', 'k2-curls': 'Kratke kovrče', 'k2-high-puff': 'Visoki oblak kovrča', 'k2-double-bun': 'Dvije punđice', 'k2-spiky': 'Razbarušena kosa', 'k2-bob': 'Ravni bob', 'k2-short-fringe': 'Kratke šiške', 'k2-topknot': 'Punđa na vrhu', 'k3-long-straight': 'Duga ravna kosa', 'k3-long-waves': 'Dugi valovi', 'k3-pigtails': 'Dva duga repića', 'k3-twin-braids': 'Dvije pletenice', 'k3-side-braid': 'Pletenica sa strane', 'k3-high-ponytail': 'Visoki rep', 'k3-low-ponytail': 'Niski rep', 'k3-curtain-bangs': 'Duga kosa sa zavjesa šiškama', 'k3-curly-lob': 'Kovrčavi dugi bob', 'k3-space-buns-loose': 'Punđice i pramenovi', 'k3-bow-bob': 'Bob s mašnom', 'k3-sleek-bun': 'Glatka kosa s niskom punđom' },
    eyes: { eyes: 'Obične', smiling: 'Vesele', eyeshadow: 'Na LSD-u', round: 'Okrugle', 'k2-wink': 'Namigivanje', 'k2-closed': 'Zatvorene oči', 'k2-sleepy': 'Pospane oči', 'k2-wide': 'Razrogačene oči', 'k2-look-left': 'Pogled ulijevo', 'k2-look-right': 'Pogled udesno', 'k3-long-lashes': 'Duge trepavice', 'k3-winged-liner': 'Naglašene oči', 'k3-wink-lashes': 'Namig s trepavicama', 'k3-dreamy-lashes': 'Sanjive oči', 'k3-starry': 'Zvjezdice u očima' },
    eyebrows: { up: 'Podignute', down: 'Spuštene', 'eyelashes-up': 'Trepavice gore', 'eyelashes-down': 'Trepavice dolje', 'k2-straight': 'Ravne obrve', 'k2-bold': 'Guste obrve', 'k2-one-up': 'Jedna podignuta', 'k2-concerned': 'Zabrinute obrve', 'k2-soft-arch': 'Blagi luk', 'k2-split': 'Obrve s prorezom', 'k3-slender-arch': 'Tanke lučne obrve', 'k3-swoop': 'Izdužene obrve', 'k3-zigzag': 'Cik-cak obrve' },
    nose: { curve: 'Zaobljeni', pointed: 'Šiljasti', round: 'Okrugli', 'k2-button': 'Gumbić', 'k2-bridge': 'Izduženi nos', 'k2-wide': 'Širi nos', 'k2-angular-soft': 'Blago uglati nos', 'k3-giant-button': 'Veliki okrugli nos', 'k3-trumpet': 'Nos truba', 'k3-curly': 'Zavrnuti nos', 'k3-zigzag': 'Cik-cak nos', 'k3-piggy': 'Praščić nos' },
    shirt: { open: 'Otvorena', crew: 'Obična', collared: 'S kragnom', 'k2-v-neck': 'V-izrez', 'k2-hoodie': 'Duks s kapuljačom', 'k2-turtleneck': 'Dolčevita', 'k2-jersey': 'Sportski dres', 'k2-bomber': 'Jakna', 'k2-striped': 'Prugasta majica', 'k3-peter-pan': 'Bluza s okruglim ovratnikom', 'k3-ruffle': 'Bluza s volanima', 'k3-sweetheart': 'Srcoliki izrez', 'k3-bow-blouse': 'Bluza s mašnom' },
    glasses: { round: 'Okrugle', square: 'Četvrtaste', 'k2-hexagon': 'Šesterokutne naočale', 'k2-oval': 'Ovalne naočale', 'k2-cat-eye': 'Mačkaste naočale', 'k2-aviator': 'Pilot naočale', 'k2-browline': 'Naglašen gornji okvir', 'k2-sport': 'Sportske naočale', 'k2-rimless': 'Naočale s tankim okvirom', 'k2-heart': 'Srcolike naočale', 'k3-sun-cat': 'Sunčane mačkaste', 'k3-sun-round': 'Velike okrugle sunčane', 'k3-sun-butterfly': 'Sunčane leptir', 'k3-sun-visor': 'Sunčani vizir', 'k3-sun-heart': 'Srcolike sunčane', 'k3-sun-pixel': 'Piksel sunčane' },
    earrings: { hoop: 'Karike', stud: 'Čepići', 'k2-drop': 'Kapljica', 'k2-diamond': 'Romb', 'k2-double-hoop': 'Dvostruka karika', 'k2-bar': 'Viseći štapić', 'k3-heart-drop': 'Srce naušnica', 'k3-moon-drop': 'Mjesec naušnica', 'k3-flower': 'Cvijet naušnica', 'k3-triple-drop': 'Tri viseća kruga', 'k3-star-drop': 'Zvijezda naušnica' },
    facialHair: { beard: 'Prava brada', scruff: 'Trodnevna brada', 'k2-moustache': 'Brkovi', 'k2-goatee': 'Kozja bradica', 'k2-chin-patch': 'Mala bradica', 'k2-sideburns': 'Zalisci', 'k3-curly-handlebar': 'Zavrnuti brkovi', 'k3-three-whiskers': 'Tri smiješne dlačice' },
    ears: { attached: 'Priljubljene', detached: 'Odvojene', 'k2-compact': 'Male uši', 'k2-rounded': 'Okrugle uši', 'k2-pointed': 'Šiljaste uši', 'k2-angular': 'Uglate uši', 'k3-elephant': 'Ogromne klempave uši', 'k3-fan': 'Uši lepeze', 'k3-long-pointed': 'Duge vilenjačke uši', 'k3-floppy': 'Viseće komične uši' },
  };

  const presetiBoja: Record<string, readonly string[]> = PRESETI_BOJA_AVATARA;

  // Naušnice nemaju smisla uz odvojene uši jer se tada taj sloj uopće ne crta.
  const vidljiveKategorije = $derived(
    kategorije.filter((kategorija) => !(kategorija.kljuc === 'earrings' && draft.parts.ears === 'detached')),
  );
  const aktivnaKategorija = $derived(
    vidljiveKategorije.find((kategorija) => kategorija.kljuc === aktivniKljuc) ?? vidljiveKategorije[0],
  );
  const aktivneVrijednosti = $derived([
    ...(aktivnaKategorija.obavezno ? [] : [null]),
    ...(AVATAR_DIJELOVI[aktivnaKategorija.kljuc] as readonly string[]),
  ]);
  const aktivnaVrijednost = $derived(draft.parts[aktivnaKategorija.kljuc]);

  function nazivDijela(kategorija: string, vrijednost: string | null): string {
    return vrijednost ? naziviDijelova[kategorija]?.[vrijednost] ?? vrijednost : 'Bez dodatka';
  }

  /** Boja kojom se slicica dijela boji; usta i nos nemaju vlastitu ulogu boje. */
  function bojaZaIzbor(): string | null {
    const uloga = ulogaBojeKategorije(aktivnaKategorija.kljuc) as keyof AvatarConfigV1['colors'] | null;
    return uloga ? draft.colors[uloga] ?? null : null;
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

  function idiNaKategoriju(kljuc: keyof AvatarDijelovi) {
    aktivniKljuc = kljuc;
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

  async function spremi() {
    if ((!izmijenjeno && !spremiBezPromjene) || spremanje) return;
    await onSpremi(kopirajKonfiguraciju(draft));
    spremljeno = kopirajKonfiguraciju(draft);
  }
</script>

<section class="editor" aria-labelledby="avatar-editor-naslov">
  <div class="editor-zaglavlje">
    <h1 id="avatar-editor-naslov">{naslov}</h1>
  </div>

  <div class="radni-prostor">
    <aside class="panel">
      <div class="panel-vrh">
        <div class="preview"><AvatarKonfiguracijaPreview konfiguracija={draft} velicina={280} rang="Lektor" /></div>

        <div class="akcije">
          <button type="button" class="odustani" onclick={odustani} disabled={!izmijenjeno || spremanje}>Odustani</button>
          <button type="button" class="spremi" onclick={spremi} disabled={(!izmijenjeno && !spremiBezPromjene) || spremanje}>{spremanje ? 'Spremanje…' : tekstSpremanja}</button>
        </div>
      </div>

      <div class="boje" role="group" aria-label="Boje avatara">
        {#each bojneUloge as stavka (stavka.uloga)}
          <label class="boja">
            <input
              type="color"
              value={draft.colors[stavka.uloga] ?? '#000000'}
              aria-label={`Boja: ${stavka.naziv}`}
              oninput={(dogadaj) => promijeniBoju(stavka.uloga, dogadaj.currentTarget.value)}
            />
            <span>{stavka.naziv}</span>
          </label>
        {/each}
      </div>

      <button type="button" class="nasumicno" onclick={nasumicno} disabled={spremanje}>
        <img src="/ikone/29-random-avatar.png" alt="" aria-hidden="true" />
        <span>Nasumični avatar</span>
      </button>
    </aside>

    <section class="izbori" aria-labelledby="naslov-kategorije">
      <h2 id="naslov-kategorije">{aktivnaKategorija.naziv}</h2>

      <nav class="kategorije" aria-label="Kategorije dijelova">
        {#each vidljiveKategorije as kategorija (kategorija.kljuc)}
          <button
            type="button"
            aria-pressed={kategorija.kljuc === aktivnaKategorija.kljuc}
            onclick={() => idiNaKategoriju(kategorija.kljuc)}
          >
            {kategorija.naziv}
            <small>{(AVATAR_DIJELOVI[kategorija.kljuc] as readonly string[]).length}</small>
          </button>
        {/each}
      </nav>

      <div class="mrezica" role="group" aria-label={`Izbor za: ${aktivnaKategorija.naziv}`}>
        {#each aktivneVrijednosti as vrijednost (vrijednost ?? 'bez')}
          <button
            type="button"
            class="kartica"
            class:bez-dodatka={vrijednost === null}
            aria-pressed={vrijednost === aktivnaVrijednost}
            title={nazivDijela(aktivnaKategorija.kljuc, vrijednost)}
            aria-label={nazivDijela(aktivnaKategorija.kljuc, vrijednost)}
            onclick={() => promijeniDio(aktivnaKategorija.kljuc, vrijednost as never)}
          >
            {#if vrijednost === null}
              <span>Bez dodatka</span>
            {:else}
              <AvatarDioPreview kategorija={aktivnaKategorija.kljuc} {vrijednost} boja={bojaZaIzbor()} />
            {/if}
          </button>
        {/each}
      </div>
    </section>
  </div>
</section>

<style>
  .editor { display: grid; gap: 20px; padding: 24px 0 56px; }
  .editor-zaglavlje { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  h1 { margin: 0; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); }
  h2 { margin: 0 0 12px; color: var(--boja-tekst-naslov); font-family: var(--font-naslov); font-size: var(--naslov-3); }

  .radni-prostor { display: grid; gap: 20px; }
  .panel { display: grid; gap: 16px; align-content: start; }
  .panel-vrh { display: grid; gap: 12px; justify-items: center; }
  .preview { display: grid; place-items: center; }

  .boje { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 8px; }
  .boja { display: grid; justify-items: center; gap: 5px; font-size: var(--tekst-mikro); color: var(--boja-tekst-sekundarni); }
  .boja input { width: 100%; max-width: 52px; height: 32px; padding: 0; border: 1px solid var(--boja-obrub); border-radius: 6px; background: transparent; cursor: pointer; }
  .boja input:focus-visible { outline: 3px solid var(--boja-fokus); outline-offset: 2px; }

  .nasumicno { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 14px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-pill); background: var(--boja-povrsina-2); color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .nasumicno img { width: 28px; height: 28px; object-fit: contain; }

  .akcije { display: flex; gap: 10px; width: 100%; }
  .akcije button { flex: 1; padding: 11px 14px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-pill); background: var(--boja-povrsina-2); color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .akcije .spremi { border-color: var(--boja-cta-pozadina); background: var(--boja-cta-pozadina); color: var(--boja-cta-tekst); }
  button:disabled { cursor: wait; opacity: .55; }

  .kategorije { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .kategorije button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-pill); background: var(--boja-povrsina-2); color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; cursor: pointer; }
  .kategorije button[aria-pressed='true'] { border-color: var(--boja-isticanje-slova); background: var(--boja-povrsina-3); color: var(--boja-isticanje-tekst); }
  .kategorije small { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mikro); font-weight: 600; }

  .mrezica { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .kartica { display: grid; place-items: center; padding: 4px; border: 2px solid var(--boja-obrub); border-radius: 12px; background: var(--boja-povrsina); cursor: pointer; }
  .kartica[aria-pressed='true'] { border-color: var(--boja-isticanje-slova); background: var(--boja-povrsina-3); }
  .kartica:focus-visible { outline: 3px solid var(--boja-fokus); outline-offset: 2px; }
  .kartica.bez-dodatka { aspect-ratio: 1; color: var(--boja-tekst-sekundarni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; text-align: center; }

  @media (min-width: 1000px) {
    .radni-prostor { grid-template-columns: 320px minmax(0, 1fr); align-items: start; gap: 32px; }
    .panel { position: sticky; top: 20px; }
  }

  @media (max-width: 999px) {
    /*
     * display: contents podize sadrzaj panela u mrezu radnog prostora.
     * Bez toga bi se .panel-vrh lijepio samo unutar niskog .panel i odlijepio prije mrezice.
     */
    .radni-prostor { gap: 16px; }
    .panel { display: contents; }

    /* Samo avatar i akcije prate skrol; boje i nasumicni avatar ostaju gore. */
    .panel-vrh {
      position: sticky;
      top: 0;
      z-index: 2;
      padding-block: 8px 10px;
      background: var(--boja-pozadina-podloga);
    }
    .preview { transform: scale(.62); transform-origin: center top; height: 176px; }
    .mrezica { grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 8px; }
    .kartica.bez-dodatka { font-size: var(--tekst-mikro); }
    /* Lijepljivi avatar jede vrh ekrana, pa dno treba vise zraka da se zadnji red moze doskrolati. */
    .editor { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  }
</style>
