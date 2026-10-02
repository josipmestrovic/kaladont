/**
 * Dohvat i bojanje SVG dijelova avatara.
 * Cache je na razini modula jer mrežica u editoru istovremeno crta do dvadesetak sličica.
 */

const OSNOVNE_PUTANJE: Record<string, string> = {
  base: '/avatari/dijelovi/Base-1.svg',
  ears: '/avatari/dijelovi/Ear-Attached.svg',
};

const VARIJANTE: Record<string, Record<string, string>> = {
  mouth: { surprised: 'Mouth-surprised.svg', laughing: 'Mouth-Laughing.svg', smile: 'Mouth-smile.svg', smirk: 'Mouth-smirk.svg', sad: 'Mouth-sad.svg', frown: 'Mouth-frown.svg', pucker: 'Mouth-pucker.svg', nervous: 'Mouth-nervous.svg', 'k2-grin': 'Mouth-k2-grin.svg', 'k2-tooth-gap': 'Mouth-k2-tooth-gap.svg', 'k2-tongue-out': 'Mouth-k2-tongue-out.svg', 'k2-braces': 'Mouth-k2-braces.svg', 'k2-gentle': 'Mouth-k2-gentle.svg', 'k2-whistle': 'Mouth-k2-whistle.svg', 'k2-determined': 'Mouth-k2-determined.svg', 'k2-small-oh': 'Mouth-k2-small-oh.svg', 'k3-toothless-laugh': 'Mouth-k3-toothless-laugh.svg', 'k3-toothless-wide': 'Mouth-k3-toothless-wide.svg', 'k3-gummy': 'Mouth-k3-gummy.svg', 'k3-lipstick-smile': 'Mouth-k3-lipstick-smile.svg', 'k3-lipstick-pout': 'Mouth-k3-lipstick-pout.svg', 'k3-crooked-grin': 'Mouth-k3-crooked-grin.svg' },
  eyebrows: { up: 'Eyebrows-Up.svg', down: 'Eyebrows-down.svg', 'eyelashes-up': 'Eyebrows-eyelashes-up.svg', 'eyelashes-down': 'Eyebrows-eyelashes-down.svg', 'k2-straight': 'Eyebrows-k2-straight.svg', 'k2-bold': 'Eyebrows-k2-bold.svg', 'k2-one-up': 'Eyebrows-k2-one-up.svg', 'k2-concerned': 'Eyebrows-k2-concerned.svg', 'k2-soft-arch': 'Eyebrows-k2-soft-arch.svg', 'k2-split': 'Eyebrows-k2-split.svg', 'k3-slender-arch': 'Eyebrows-k3-slender-arch.svg', 'k3-swoop': 'Eyebrows-k3-swoop.svg', 'k3-zigzag': 'Eyebrows-k3-zigzag.svg' },
  hair: { fonze: 'Hair-fonze.svg', 'mr-t': 'Hair-Mr-T.svg', 'doug-funny': 'Hair-doug-funny.svg', 'mr-clean': 'Hair-mr-clean.svg', 'danny-phantom': 'Hair-danny-phantom.svg', full: 'Hair-full.svg', turban: 'Hair-turban.svg', pixie: 'Hair-pixie.svg', 'k2-crop': 'Hair-k2-crop.svg', 'k2-side-part': 'Hair-k2-side-part.svg', 'k2-waves': 'Hair-k2-waves.svg', 'k2-curls': 'Hair-k2-curls.svg', 'k2-high-puff': 'Hair-k2-high-puff.svg', 'k2-double-bun': 'Hair-k2-double-bun.svg', 'k2-spiky': 'Hair-k2-spiky.svg', 'k2-bob': 'Hair-k2-bob.svg', 'k2-short-fringe': 'Hair-k2-short-fringe.svg', 'k2-topknot': 'Hair-k2-topknot.svg', 'k3-long-straight': 'Hair-k3-long-straight.svg', 'k3-long-waves': 'Hair-k3-long-waves.svg', 'k3-pigtails': 'Hair-k3-pigtails.svg', 'k3-twin-braids': 'Hair-k3-twin-braids.svg', 'k3-side-braid': 'Hair-k3-side-braid.svg', 'k3-high-ponytail': 'Hair-k3-high-ponytail.svg', 'k3-low-ponytail': 'Hair-k3-low-ponytail.svg', 'k3-curtain-bangs': 'Hair-k3-curtain-bangs.svg', 'k3-curly-lob': 'Hair-k3-curly-lob.svg', 'k3-space-buns-loose': 'Hair-k3-space-buns-loose.svg', 'k3-bow-bob': 'Hair-k3-bow-bob.svg', 'k3-sleek-bun': 'Hair-k3-sleek-bun.svg' },
  eyes: { eyes: 'Eyes-eyes.svg', smiling: 'Eyes-Smiling.svg', eyeshadow: 'Eyes-eyeshadow.svg', round: 'Eyes-round.svg', 'k2-wink': 'Eyes-k2-wink.svg', 'k2-closed': 'Eyes-k2-closed.svg', 'k2-sleepy': 'Eyes-k2-sleepy.svg', 'k2-wide': 'Eyes-k2-wide.svg', 'k2-look-left': 'Eyes-k2-look-left.svg', 'k2-look-right': 'Eyes-k2-look-right.svg', 'k3-long-lashes': 'Eyes-k3-long-lashes.svg', 'k3-winged-liner': 'Eyes-k3-winged-liner.svg', 'k3-wink-lashes': 'Eyes-k3-wink-lashes.svg', 'k3-dreamy-lashes': 'Eyes-k3-dreamy-lashes.svg', 'k3-starry': 'Eyes-k3-starry.svg' },
  nose: { curve: 'Nose-curve.svg', pointed: 'Nose-pointed.svg', round: 'Nose-Round.svg', 'k2-button': 'Nose-k2-button.svg', 'k2-bridge': 'Nose-k2-bridge.svg', 'k2-wide': 'Nose-k2-wide.svg', 'k2-angular-soft': 'Nose-k2-angular-soft.svg', 'k3-giant-button': 'Nose-k3-giant-button.svg', 'k3-trumpet': 'Nose-k3-trumpet.svg', 'k3-curly': 'Nose-k3-curly.svg', 'k3-zigzag': 'Nose-k3-zigzag.svg', 'k3-piggy': 'Nose-k3-piggy.svg' },
  shirt: { open: 'Shirt-open.svg', crew: 'Shirt-crew.svg', collared: 'Shirt-Collared.svg', 'k2-v-neck': 'Shirt-k2-v-neck.svg', 'k2-hoodie': 'Shirt-k2-hoodie.svg', 'k2-turtleneck': 'Shirt-k2-turtleneck.svg', 'k2-jersey': 'Shirt-k2-jersey.svg', 'k2-bomber': 'Shirt-k2-bomber.svg', 'k2-striped': 'Shirt-k2-striped.svg', 'k3-peter-pan': 'Shirt-k3-peter-pan.svg', 'k3-ruffle': 'Shirt-k3-ruffle.svg', 'k3-sweetheart': 'Shirt-k3-sweetheart.svg', 'k3-bow-blouse': 'Shirt-k3-bow-blouse.svg' },
  glasses: { round: 'Glasses-round.svg', square: 'Glasses-square.svg', 'k2-hexagon': 'Glasses-k2-hexagon.svg', 'k2-oval': 'Glasses-k2-oval.svg', 'k2-cat-eye': 'Glasses-k2-cat-eye.svg', 'k2-aviator': 'Glasses-k2-aviator.svg', 'k2-browline': 'Glasses-k2-browline.svg', 'k2-sport': 'Glasses-k2-sport.svg', 'k2-rimless': 'Glasses-k2-rimless.svg', 'k2-heart': 'Glasses-k2-heart.svg', 'k3-sun-cat': 'Glasses-k3-sun-cat.svg', 'k3-sun-round': 'Glasses-k3-sun-round.svg', 'k3-sun-butterfly': 'Glasses-k3-sun-butterfly.svg', 'k3-sun-visor': 'Glasses-k3-sun-visor.svg', 'k3-sun-heart': 'Glasses-k3-sun-heart.svg', 'k3-sun-pixel': 'Glasses-k3-sun-pixel.svg' },
  earrings: { hoop: 'EarRing-hoop.svg', stud: 'EarRing-stud.svg', 'k2-drop': 'EarRing-k2-drop.svg', 'k2-diamond': 'EarRing-k2-diamond.svg', 'k2-double-hoop': 'EarRing-k2-double-hoop.svg', 'k2-bar': 'EarRing-k2-bar.svg', 'k3-heart-drop': 'EarRing-k3-heart-drop.svg', 'k3-moon-drop': 'EarRing-k3-moon-drop.svg', 'k3-flower': 'EarRing-k3-flower.svg', 'k3-triple-drop': 'EarRing-k3-triple-drop.svg', 'k3-star-drop': 'EarRing-k3-star-drop.svg' },
  facialHair: { beard: 'FacialHair-beard.svg', scruff: 'FacialHair-scruff.svg', 'k2-moustache': 'FacialHair-k2-moustache.svg', 'k2-goatee': 'FacialHair-k2-goatee.svg', 'k2-chin-patch': 'FacialHair-k2-chin-patch.svg', 'k2-sideburns': 'FacialHair-k2-sideburns.svg', 'k3-curly-handlebar': 'FacialHair-k3-curly-handlebar.svg', 'k3-three-whiskers': 'FacialHair-k3-three-whiskers.svg' },
  ears: { 'k2-compact': 'Ear-k2-compact.svg', 'k2-rounded': 'Ear-k2-rounded.svg', 'k2-pointed': 'Ear-k2-pointed.svg', 'k2-angular': 'Ear-k2-angular.svg', 'k3-elephant': 'Ear-k3-elephant.svg', 'k3-fan': 'Ear-k3-fan.svg', 'k3-long-pointed': 'Ear-k3-long-pointed.svg', 'k3-floppy': 'Ear-k3-floppy.svg' },
};

const KATEGORIJE_SA_STROKE = ['eyebrows', 'glasses', 'earrings'];

export interface OkvirDijela {
  x: number;
  y: number;
  sirina: number;
  visina: number;
}

/**
 * Dijelovi paketa 03 kojima geometrija izlazi iz zadanog okvira kategorije.
 * Zadani okviri ostaju netaknuti da se originalni dijelovi i paket 02 prikazuju jednako.
 */
const OKVIRI_DIJELOVA: Record<string, Record<string, OkvirDijela>> = {
  hair: {
    'k3-long-straight': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-long-waves': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-pigtails': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-twin-braids': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-side-braid': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-high-ponytail': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-low-ponytail': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-curtain-bangs': { x: 59, y: 28, sirina: 240, visina: 300 },
    'k3-curly-lob': { x: 59, y: 28, sirina: 240, visina: 260 },
    'k3-space-buns-loose': { x: 59, y: 28, sirina: 240, visina: 225 },
    'k3-bow-bob': { x: 59, y: 28, sirina: 240, visina: 220 },
  },
  nose: {
    'k3-giant-button': { x: 176, y: 163, sirina: 64, visina: 52 },
    'k3-trumpet': { x: 176, y: 163, sirina: 64, visina: 52 },
    'k3-curly': { x: 176, y: 163, sirina: 64, visina: 52 },
    'k3-zigzag': { x: 176, y: 163, sirina: 64, visina: 52 },
    'k3-piggy': { x: 176, y: 163, sirina: 64, visina: 52 },
  },
  ears: {
    'k3-elephant': { x: 36, y: 148, sirina: 100, visina: 92 },
    'k3-fan': { x: 36, y: 148, sirina: 100, visina: 92 },
    'k3-long-pointed': { x: 36, y: 148, sirina: 100, visina: 92 },
    'k3-floppy': { x: 36, y: 148, sirina: 100, visina: 128 },
  },
};

export function okvirDijela(kategorija: string, vrijednost: string | null): OkvirDijela | null {
  if (!vrijednost) return null;
  return OKVIRI_DIJELOVA[kategorija]?.[vrijednost] ?? null;
}

export function putanjaDijela(kategorija: string, vrijednost: string | null): string | null {
  if (!vrijednost) return null;
  if (kategorija === 'base') return OSNOVNE_PUTANJE.base;
  if (kategorija === 'ears' && vrijednost === 'attached') return OSNOVNE_PUTANJE.ears;
  if (kategorija === 'ears' && vrijednost === 'detached') return null;
  const nazivDatoteke = VARIJANTE[kategorija]?.[vrijednost];
  return nazivDatoteke ? `/avatari/dijelovi/${nazivDatoteke}` : null;
}

export function bojiStroke(kategorija: string): boolean {
  return KATEGORIJE_SA_STROKE.includes(kategorija);
}

/** Kao putanjaDijela, ali odvojene usi dobivaju vlastitu sliku jer se na avataru ne crtaju. */
export function putanjaSlicice(kategorija: string, vrijednost: string | null): string | null {
  if (kategorija === 'ears' && vrijednost === 'detached') return '/avatari/dijelovi/Ear-detached.svg';
  return putanjaDijela(kategorija, vrijednost);
}

/** Uloga boje kojom se dio boji; usta i nos zadržavaju vlastite fiksne boje. */
export function ulogaBojeKategorije(kategorija: string): string | null {
  if (kategorija === 'base' || kategorija === 'ears') return 'skin';
  if (['hair', 'shirt', 'eyes', 'eyebrows', 'glasses', 'earrings', 'facialHair'].includes(kategorija)) return kategorija;
  return null;
}

const cacheSirovih = new Map<string, Promise<string>>();
const cacheObojenih = new Map<string, string>();

function dohvatiSirovi(putanja: string): Promise<string> {
  const spremljeno = cacheSirovih.get(putanja);
  if (spremljeno) return spremljeno;

  const obecanje = fetch(putanja).then((odgovor) => {
    if (!odgovor.ok) throw new Error(`Nije moguće učitati avatar asset: ${putanja}`);
    return odgovor.text();
  });
  // Neuspjeli dohvat se ne smije trajno keširati.
  obecanje.catch(() => cacheSirovih.delete(putanja));
  cacheSirovih.set(putanja, obecanje);
  return obecanje;
}

export async function dohvatiObojeniSvg(putanja: string, boja: string, obojiStroke: boolean): Promise<string> {
  const kljuc = `${putanja}|${boja}|${obojiStroke ? 'stroke' : 'fill'}`;
  const spremljeno = cacheObojenih.get(kljuc);
  if (spremljeno) return spremljeno;

  const svg = await dohvatiSirovi(putanja);
  let obojeni = svg.replace(/fill="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `fill="${boja}"`);
  if (obojiStroke) obojeni = obojeni.replace(/stroke="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `stroke="${boja}"`);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(obojeni)}`;
  cacheObojenih.set(kljuc, dataUrl);
  return dataUrl;
}
