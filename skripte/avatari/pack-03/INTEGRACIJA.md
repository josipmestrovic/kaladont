# Ugradnja packa 03

Nadogradnja postojećeg avatar kreatora i, ako je već ugrađen, packa 02. Sačuvati postojeće ID-jeve, konfiguracije i datoteke.

## Registracija

1. Kopirati 52 nova SVG-a iz kategorijskih foldera u `aplikacije/web/static/avatari/dijelovi/`. Sačuvati imena datoteka; ne kopirati PNG pregled kao avatar komponentu.
2. Nadopuniti `AVATAR_DIJELOVI` u `paketi/zajednicko/src/avatar.ts` podacima iz `AVATAR_PACK_03_DIJELOVI` (`registracija.ts`). Spojiti s postojećim izborima, uključujući pack 02 ako postoji. Zajednička validacija mora prihvatiti nove ID-jeve i na serveru.
3. Nadopuniti `varijante` u `aplikacije/web/src/lib/komponente/AvatarKonfiguracijaPreview.svelte` mapama `AVATAR_PACK_03_DATOTEKE`.
4. Nadopuniti `naziviDijelova` u `AvatarEditor.svelte` mapama `AVATAR_PACK_03_NAZIVI`. Sve kategorije već postoje; dijelove ne razdvajati u obavezne muške/ženske konfiguracije.
5. Ako već nije napravljeno za pack 02, maknuti ograničenje koje za `ears` vraća samo originalni `attached`. Sačuvati izvornu semantiku `detached`, a nove uši razriješiti preko `varijante.ears`. Nove `k3-*` uši podržavaju naušnice kao `attached`.

```ts
if (!vrijednost) return null;
if (kategorija === 'base') return putanje.base;
if (kategorija === 'ears' && vrijednost === 'attached') return putanje.ears;
if (kategorija === 'ears' && vrijednost === 'detached') return null;
const nazivDatoteke = varijante[kategorija]?.[vrijednost];
return nazivDatoteke ? `/avatari/dijelovi/${nazivDatoteke}` : null;
```

## Prošireni okviri — obavezno za 20 dodataka

Iz `registracija.ts` preuzeti `AVATAR_PACK_03_OKVIRI`. Sadrži samo dodatke čija geometrija izlazi iz starog prostora: dugu kosu, velike nosove i velike uši. `manifest.json` ima apsolutni `frame` za svaki novi dio.

Zadržati postojeći redoslijed slojeva. Na postojeći niz `slojevi` primijeniti mapiranje unutar njegova `$derived(...)` izraza. Primjer za postojeća hrvatska imena polja:

```ts
type OkvirDijela = {
  x: number;
  y: number;
  width: number;
  height: number;
};
const okviriPack03: Record<string, Record<string, OkvirDijela>> =
  AVATAR_PACK_03_OKVIRI;

// Postojeci niz unutar $derived([...]) zavrsiti ovim .map(...):
.map((sloj) => {
  if (!sloj.vrijednost) return sloj;
  const okvir = okviriPack03[sloj.kategorija]?.[sloj.vrijednost];
  if (!okvir) return sloj;
  return {
    ...sloj,
    x: okvir.x,
    y: okvir.y,
    sirina: okvir.width,
    visina: okvir.height,
  };
})
```

Ovo je fragment za postojeći izraz, ne samostalna naredba. Ne mijenjati zadane okvire cijele kategorije: originalni dijelovi i pack 02 moraju zadržati svoje pozicije. Primijeniti prilagodbu u zajedničkom rendereru, kako bi vrijedila u editoru, profilu i igri. Zadržati `preserveAspectRatio="none"` i kružno rezanje gotovog avatara.

Kod duge kose ostaje isti početak sloja `(59, 28)` i širina 240; povećava se samo raspoloživa visina. Kosa se i dalje crta zadnja. Pramenovi su oblikovani uz rubove lica, a mogu prekriti uši/naušnice i dio odjeće, kao prava kosa.

Kod velikih ušiju proširenje ide ulijevo i po potrebi prema dolje. Mjesto spajanja s glavom i ušna resica ostaju uz postojeći položaj. `earrings` sloj ne pomicati zajedno s vanjskim rubom velikog uha.

## Boje i leće

Zadržati aktualna pravila bojanja: hex `fill` za kožu, kosu, odjeću, oči i brkove; hex `fill` i `stroke` za obrve, naočale i naušnice. Nos i usta nemaju vlastiti birač boje.

Sunčane naočale imaju leće s `fill="rgb(23,25,33)"` i punom neprozirnošću. Namjerno se razlikuju od promjenjivog hex okvira: postojeći regex ih ne boja. Refleksi imaju fiksnu RGB bijelu i malu neprozirnost, ali ispod njih uvijek ostaje puna neprozirna leća. Fiksni bijeli detalji mašne/pletenice imaju istu namjenu.

Ne pretvarati RGB leće u hex boju prilikom optimizacije i ne proširivati globalni regex na sve fill/stroke vrijednosti. U suprotnom će se mijenjati boja leća. Ne koristiti globalni opacity na naočalama. Ne pretvarati šesteroznamenkaste promjenjive hex boje u troznamenkaste niti ih premještati u CSS.

## Inventory i provjera

Ako je aktivan originalni inventory proces, dodati i izvorne SVG-ove/manifest unose u `skripte/avatari/izvor/avatar-assets/` i `skripte/avatari/manifest.mjs`. Sačuvati atribuciju iz `ATRIBUCIJA.md`.

Nakon ugradnje provjeriti odabir, spremanje, ponovno učitavanje, randomizaciju i male avatare. Posebno provjeriti:

- duga kosa zadržava visinu i ne rasteže crte lica;
- sve četiri velike uši i veliki nosovi koriste svoje okvire;
- sunčane leće ostaju tamne i neprozirne kad je okvir svijetložut;
- naušnice s novim ušima, uz nepromijenjeno staro `detached` ponašanje;
- postojeće konfiguracije i pack 02 i dalje se prikazuju jednako.

Nije potrebna promjena schemaVersion niti migracija već spremljenih konfiguracija. Nove assete ne dodjeljivati igračima automatski.
