<script lang="ts">
  import { ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from 'zajednicko';
  import { bojaBordera } from '$lib/avatari.js';

  interface Props {
    konfiguracija?: AvatarConfigV1;
    rang?: string | null;
    velicina?: number;
  }

  let { konfiguracija = ZADANI_AVATAR_CONFIG, rang = null, velicina = 280 }: Props = $props();
  const border = $derived(bojaBordera(rang));
  const cacheObojenihPutanja = new Map<string, string>();
  let obojanePutanje = $state<Record<string, string>>({});
  let generacijaBojanja = 0;

  const putanje: Record<string, string> = {
    base: '/avatari/dijelovi/Base-1.svg',
    ears: '/avatari/dijelovi/Ear-Attached.svg',
    mouth: '/avatari/dijelovi/Mouth-Laughing.svg',
    eyebrows: '/avatari/dijelovi/Eyebrows-Up.svg',
    hair: '/avatari/dijelovi/Hair-Mr-T.svg',
    eyes: '/avatari/dijelovi/Eyes-Smiling.svg',
    nose: '/avatari/dijelovi/Nose-Round.svg',
    shirt: '/avatari/dijelovi/Shirt-Collared.svg',
  };

  const varijante: Record<string, Record<string, string>> = {
    mouth: { surprised: 'Mouth-surprised.svg', laughing: 'Mouth-Laughing.svg', smile: 'Mouth-smile.svg', smirk: 'Mouth-smirk.svg', sad: 'Mouth-sad.svg', frown: 'Mouth-frown.svg', pucker: 'Mouth-pucker.svg', nervous: 'Mouth-nervous.svg' },
    eyebrows: { up: 'Eyebrows-Up.svg', down: 'Eyebrows-down.svg', 'eyelashes-up': 'Eyebrows-eyelashes-up.svg', 'eyelashes-down': 'Eyebrows-eyelashes-down.svg' },
    hair: { fonze: 'Hair-fonze.svg', 'mr-t': 'Hair-Mr-T.svg', 'doug-funny': 'Hair-doug-funny.svg', 'mr-clean': 'Hair-mr-clean.svg', 'danny-phantom': 'Hair-danny-phantom.svg', full: 'Hair-full.svg', turban: 'Hair-turban.svg', pixie: 'Hair-pixie.svg' },
    eyes: { eyes: 'Eyes-eyes.svg', smiling: 'Eyes-Smiling.svg', eyeshadow: 'Eyes-eyeshadow.svg', round: 'Eyes-round.svg' },
    nose: { curve: 'Nose-curve.svg', pointed: 'Nose-pointed.svg', round: 'Nose-Round.svg' },
    shirt: { open: 'Shirt-open.svg', crew: 'Shirt-crew.svg', collared: 'Shirt-Collared.svg' },
    glasses: { round: 'Glasses-round.svg', square: 'Glasses-square.svg' },
    earrings: { hoop: 'EarRing-hoop.svg', stud: 'EarRing-stud.svg' },
    facialHair: { beard: 'FacialHair-beard.svg', scruff: 'FacialHair-scruff.svg' },
  };

  function dioPutanja(kategorija: string, vrijednost: string | null): string | null {
    if (!vrijednost) return null;
    if (kategorija === 'base') return putanje.base;
    if (kategorija === 'ears') return vrijednost === 'attached' ? putanje.ears : null;
    const nazivDatoteke = varijante[kategorija]?.[vrijednost];
    return nazivDatoteke ? `/avatari/dijelovi/${nazivDatoteke}` : null;
  }

  const slojevi = $derived([
    { kategorija: 'background', vrijednost: konfiguracija.parts.background, x: 0, y: 0, sirina: 380, visina: 380 },
    { kategorija: 'base', vrijednost: konfiguracija.parts.base, x: 90, y: 43, sirina: 200, visina: 320 },
    { kategorija: 'ears', vrijednost: konfiguracija.parts.ears, x: 94, y: 174, sirina: 48, visina: 48 },
    { kategorija: 'shirt', vrijednost: konfiguracija.parts.shirt ?? 'open', x: 47, y: 290, sirina: 281, visina: 93 },
    { kategorija: 'eyes', vrijednost: konfiguracija.parts.eyes, x: 152, y: 139, sirina: 96, visina: 48 },
    { kategorija: 'eyebrows', vrijednost: konfiguracija.parts.eyebrows, x: 115, y: 122, sirina: 149, visina: 51 },
    { kategorija: 'nose', vrijednost: konfiguracija.parts.nose, x: 188, y: 167, sirina: 32, visina: 40 },
    { kategorija: 'facialHair', vrijednost: konfiguracija.parts.facialHair, x: 124, y: 150, sirina: 164, visina: 154 },
    { kategorija: 'mouth', vrijednost: konfiguracija.parts.mouth, x: 172, y: 194, sirina: 72, visina: 64 },
    { kategorija: 'earrings', vrijednost: konfiguracija.parts.earrings, x: 89, y: 207, sirina: 52, visina: 52 },
    { kategorija: 'glasses', vrijednost: konfiguracija.parts.glasses, x: 116, y: 132, sirina: 151, visina: 65 },
    { kategorija: 'hair', vrijednost: konfiguracija.parts.hair, x: 59, y: 28, sirina: 240, visina: 203 },
  ]);

  function bojaZaKategoriju(kategorija: string): string | null {
    if (kategorija === 'base' || kategorija === 'ears') return konfiguracija.colors.skin ?? null;
    if (kategorija === 'shirt') return konfiguracija.parts.shirt === null ? konfiguracija.colors.skin ?? null : konfiguracija.colors.shirt ?? null;
    if (kategorija === 'hair') return konfiguracija.colors.hair ?? null;
    if (kategorija === 'eyes') return konfiguracija.colors.eyes ?? null;
    if (kategorija === 'eyebrows') return konfiguracija.colors.eyebrows ?? null;
    if (kategorija === 'facialHair') return konfiguracija.colors.facialHair ?? null;
    if (kategorija === 'glasses') return konfiguracija.colors.glasses ?? null;
    if (kategorija === 'earrings') return konfiguracija.colors.earrings ?? null;
    return null;
  }

  async function ucitajObojeniSvg(putanja: string, boja: string, obojiStroke: boolean): Promise<string> {
    const kljuc = `${putanja}|${boja}`;
    const spremljenaPutanja = cacheObojenihPutanja.get(kljuc);
    if (spremljenaPutanja) return spremljenaPutanja;

    const odgovor = await fetch(putanja);
    if (!odgovor.ok) throw new Error(`Nije moguće učitati avatar asset: ${putanja}`);
    const svg = await odgovor.text();
    const obojeniSvg = svg
      .replace(/fill="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `fill="${boja}"`)
      .replace(obojiStroke ? /stroke="(?:#[0-9A-Fa-f]{6}|black|white)"/g : /$^/g, `stroke="${boja}"`);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(obojeniSvg)}`;
    cacheObojenihPutanja.set(kljuc, dataUrl);
    return dataUrl;
  }

  $effect(() => {
    const trenutnaGeneracija = ++generacijaBojanja;
    obojanePutanje = {};
    const slojeviZaBojanje = slojevi.filter((sloj) => dioPutanja(sloj.kategorija, sloj.vrijednost) && bojaZaKategoriju(sloj.kategorija));
    const ucitavanja = slojeviZaBojanje.map(async (sloj) => {
      const putanja = dioPutanja(sloj.kategorija, sloj.vrijednost)!;
      const boja = bojaZaKategoriju(sloj.kategorija)!;
      const obojiStroke = ['eyebrows', 'glasses', 'earrings'].includes(sloj.kategorija);
      return [sloj.kategorija, await ucitajObojeniSvg(putanja, boja, obojiStroke)] as const;
    });

    void Promise.all(ucitavanja).then((rezultati) => {
      if (trenutnaGeneracija !== generacijaBojanja) return;
      obojanePutanje = Object.fromEntries(rezultati);
    });
  });
</script>

<div class="avatar-konfiguracija" style:width={`${velicina}px`} style:height={`${velicina}px`}>
  <svg viewBox="0 0 380 380" role="img" aria-label="Sastavljeni Kaladont avatar">
    <circle cx="190" cy="190" r="190" fill="#FFEDEF" />
    {#each slojevi as sloj (sloj.kategorija)}
      {@const putanja = dioPutanja(sloj.kategorija, sloj.vrijednost)}
      {#if putanja && sloj.kategorija !== 'background' && (sloj.kategorija !== 'earrings' || konfiguracija.parts.ears !== 'detached') && (!bojaZaKategoriju(sloj.kategorija) || obojanePutanje[sloj.kategorija])}
        <image href={obojanePutanje[sloj.kategorija] ?? putanja} x={sloj.x} y={sloj.y} width={sloj.sirina} height={sloj.visina} preserveAspectRatio="none" />
      {/if}
    {/each}
  </svg>
</div>

<style>
  .avatar-konfiguracija { display: inline-flex; overflow: hidden; flex-shrink: 0; border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 0 3px rgb(0 0 0 / 12%); }
  svg { display: block; width: 100%; height: 100%; }
  image { overflow: visible; }
</style>
