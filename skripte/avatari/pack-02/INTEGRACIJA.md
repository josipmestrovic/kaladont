# Upute agentu za ugradnju

Paket je pripremljen prema reviziji `87bf60439cda67ab921e4a33683ea2f858c01dbe`. Prije primjene usporedi navedene datoteke s aktualnim kodom. Ovo je isporuka asseta i registracijskih podataka, ne već primijenjena promjena aplikacije.

1. Kopiraj 60 SVG datoteka iz svih kategorijskih foldera u `aplikacije/web/static/avatari/dijelovi/`. Zadrži imena datoteka. Folderi ZIP-a služe organizaciji; postojeći renderer očekuje zajednički folder. Ne prepisuj postojeće SVG-ove.
2. U `paketi/zajednicko/src/avatar.ts` nadopuni svaku odgovarajuću listu `AVATAR_DIJELOVI` vrijednostima iz `AVATAR_PACK_02_DIJELOVI` u `registracija.ts`. Zadrži postojeće vrijednosti i `null` ponašanje. Novi ID-jevi moraju proći zajedničku validaciju na webu i serveru. Nije potrebna promjena schemaVersion ni oblika spremljene konfiguracije.
3. U `aplikacije/web/src/lib/komponente/AvatarKonfiguracijaPreview.svelte` nadopuni `varijante` mapama iz `AVATAR_PACK_02_DATOTEKE`. Svaku kategoriju spoji sa starom mapom, nemoj je zamijeniti. Zadrži `base`, pozadinu, sve položaje, `preserveAspectRatio="none"` i redoslijed slojeva.
4. Posebno prilagodi postojeći rani povrat za `ears`. Trenutno prihvaća samo `attached`; nove uši bi inače bile nevidljive. Sačuvaj sadašnju semantiku `detached` (bez sloja) i prepusti nove vrijednosti mapi `varijante.ears`:

```ts
if (kategorija === 'base') return putanje.base;
if (kategorija === 'ears' && vrijednost === 'attached') return putanje.ears;
if (kategorija === 'ears' && vrijednost === 'detached') return null;
const nazivDatoteke = varijante[kategorija]?.[vrijednost];
return nazivDatoteke ? `/avatari/dijelovi/${nazivDatoteke}` : null;
```

5. U `aplikacije/web/src/lib/komponente/AvatarEditor.svelte` nadopuni `naziviDijelova` mapama iz `AVATAR_PACK_02_NAZIVI`. Sva četiri nova tipa ušiju ponašaju se kao pričvršćene uši i podržavaju naušnice; nemoj ih tretirati kao `detached`. Novi izbori trebaju sudjelovati u postojećem listanju i randomizaciji preko nadopunjenih registara.
6. Ako projekt zadržava izvorni inventory proces, prenesi SVG-ove i u izvorne kategorije pod `skripte/avatari/izvor/avatar-assets/`, dopuni `skripte/avatari/manifest.mjs` i prilagodi inventory provjeru. Ne dodaj gotove kompozicije iz preglednika kao nove dijelove. Stari manifest poznaje samo originalnih 39 komponenti.
7. Zadrži postojeću atribuciju Micahu Lanieru / Avatar Illustration System u projektu i oznaku da je sustav proširen za Kaladont.

## Boje i proporcije

- Kosa, oči, brada/brkovi: boja na `fill`; tanki fiksni detalji mogu ostati tamni.
- Uši: `fill` boje kože, fiksna tamna kontura.
- Odjeća: `fill` boje odjeće, fiksne tamne konture i šavovi.
- Obrve, naočale, naušnice: bojaju se i `fill` i `stroke`.
- Usta i nos: koriste postojeće fiksne boje; ne uključivati ih u globalno bojanje.

Paket koristi standardne `fill="#{6 hex znamenki}"` i `stroke="#{6 hex znamenki}"` vrijednosti, kompatibilne s trenutnim regexom. `fill="none"` ostaje proziran. Nema `currentColor`, CSS varijabli, vanjskih resursa ni zajedničkih SVG ID-jeva. Ako SVG optimiziraš, nemoj pretvoriti šesteroznamenkaste boje u troznamenkaste, premjestiti boje u CSS ili obrezati viewBox: postojeći regex i sidrišta ovise o tom formatu.

Sve nove datoteke iste kategorije koriste okvir prikaznog sloja. To je namjerno: neki originalni asseti imaju drugačije lokalne omjere, koje postojeći renderer rasteže. Novi SVG-ovi već su nacrtani za ciljnu geometriju iz `manifest.json`. Donji rub odjeće završava na rubu lokalnog viewBoxa, kao kod postojećih majica; avatar ga dodatno kružno reže.

## Provjera nakon ugradnje

- Odaberi, spremi i ponovno učitaj barem jedan novi dio svake kategorije; provjeri da ga server ne odbaci.
- Provjeri svaku novu ušnu varijantu s naušnicom, uz očuvano staro `detached` ponašanje.
- Provjeri randomizaciju dijelova i zasebnu randomizaciju boja.
- Provjeri da se novi dijelovi prikazuju u editoru, profilu i malom avataru tijekom igre.
- Pokreni postojeće provjere tipova/builda i dopunjeni inventory ako je aktivan.
- Ne mijenjaj već spremljene konfiguracije niti automatski dodjeljuj nove dijelove igračima.
