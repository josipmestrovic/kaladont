# Gdje koristiti ilustracije

Pregledan repozitorij `josipmestrovic/kaladont`, grana `main`, commit `87bf60439cda67ab921e4a33683ea2f858c01dbe`, provjeren 1. listopada 2026. Ovo je paket asseta i uputa za povezivanje; nije izvršena izmjena aplikacije ili deploy.

PNG-ove iz direktorija `png/` kopirati u `aplikacije/web/static/ikone/`. U aplikaciji su tada dostupni pod `/ikone/49-ispadanje.png` itd. Imena nastavljaju raniji set 01–48.

## Mjesta prikaza

| Asset | Komponenta ili stranica | Postojeći podatak / predložena uporaba |
| --- | --- | --- |
| 49-ispadanje | `routes/partija/[id]/+page.svelte` | `jeEliminiran` iz `stanje.eliminacije`, za vlastitog igrača. Kratko objašnjenje ispadanja. Prikaz ne smije zaključati gledanje igre. Za konkretan razlog može se koristiti specifična ilustracija ispod. |
| 50-istek-vremena | ista stranica | Eliminacija s `razlog === 'istek'`. Koristiti potvrđenu eliminaciju sa servera; lokalno odbrojavanje do nule samo po sebi nije potvrda ispadanja. |
| 51-ne-znam | ista stranica | Eliminacija s `razlog === 'ne_znam'`, odnosno potvrđena predaja poteza. Ne koristiti za običnu neispravnu riječ. |
| 52-cekanje-igraca | `routes/red/+page.svelte` i po potrebi `routes/soba/[kod]/+page.svelte` | Red koristi `brojIgraca`, `preostaloIgraca` i odbrojavanje. Prikaz uz čekanje popunjavanja mjesta; u privatnoj sobi uz tekst čekanja/spremnosti, dok igra nije započela. |
| 53-nova-runda | `routes/partija/[id]/+page.svelte` | Uz `stanje.sustavBiraRijec` i tekst odabira početne riječi; nova runda potvrđuje se događajem `partija:runda-otvorena`. Nakon odabira ukloniti veliku ilustraciju iz prostora za unos. |
| 54-ponovno-povezivanje | `lib/komponente/VezaObavijest.svelte` | `stanjeVeze.stanje === 'ponovno_spajanje'` ili privremeni `prekid`. Nestaje kad je veza ponovno spremna. Ne prikazivati kao objašnjenje isteka sesije. |
| 55-igra-nedostupna | `VezaObavijest.svelte`, po potrebi stranica igre | Uz `stanjeVeze.partijaNedostupna`; može se koristiti i uz postojeću `stanje.ponistenaPoruka`. Tekst mora razlikovati poništenu i nedostupnu igru. Ne prikazivati ovo kao poraz igrača. |
| 56-nova-razina | `lib/komponente/IskustvoPartije.svelte` | Uz povećanje `obracun.poslije.razina > obracun.prije.razina`. Prikazati jednom za završni obračun. Ne prikazivati za svaki mali dobitak XP-a. |
| 57-novo-dostignuce | `routes/partija/[id]/+page.svelte` | Uz `stanje.novaDostignucaTijekomPartije` / postojeći `status-dostignuca`. U konačnom popisu `stanje.kraj.novaDostignuca` prednost imaju specifični badgevi 39–48; ovaj je opći simbol otključavanja. |
| 58-promatranje-igre | ista stranica, `promatranje-traka` | Nakon ispadanja, dok igra traje: `jeEliminiran && !stanje.kraj`. Malo dalekozorno pomagalo uz „Promatraš igru”. Ne prikazivati trajno veliku ilustraciju ispadanja i ovu istodobno. |
| 59-postolje-2-igraca | završni poredak na istoj stranici | Kada `stanje.kraj && prikaziRezultate` i valjan završni poredak s točno dva igrača. |
| 60-postolje-4-igraca | završni poredak na istoj stranici | Isti uvjet, s točno četiri igrača. Četiri mjesta predstavljaju sve igrače, ne samo tri najbolja. |

Putanje u tablici relativne su prema `aplikacije/web/src/`.

## Prikaz tijekom igre

Jedna glavna ilustracija po statusnom bloku. U aktivnoj igri uglavnom 48–80 CSS piksela; u praznim stanjima do 128 px. Nemoj prikazivati svih 320 px preko polja za unos, odbrojavanja ili gumba. Za ponovno povezivanje koristiti malu ilustraciju uz postojeću poruku i radnje.

Zadržati postojeće razumljive tekstove: ilustracija je dopuna. Kad tekst već prenosi značenje, koristiti `alt=""` i eksplicitne `width` / `height` radi stabilnog rasporeda. Ne premještati fokus niti uvoditi obvezno zatvaranje popupa za nastavak igre.

Promjene prikaza moraju slijediti serverove događaje. Dekorativna animacija ne smije odgađati ulazak u red, slanje poteza ili prikaz rezultata. Poštovati postojeće postavke kretanja i `prefers-reduced-motion` ako se kasnije dodaju animacije.

## Postolja i avatari

Podloga se renderira u kvadratnom spremniku, preporučeno do 320 CSS px širokom. Sačuvati omjer 1:1 i sav prozirni prostor. Ne koristiti `object-fit: cover`, obrezivanje prozirnih rubova niti rastezanje slike po visini.

`postolja.json` definira koordinate na originalnoj mreži 320 × 320:

- `x`: horizontalno središte avatara.
- `surfaceY`: donji rub avatara, odnosno mjesto na vrhu platforme.
- `avatarSize`: širina i visina spremnika avatara.
- `rank`: koji stvarni plasman ide na to mjesto.

Za responzivni prikaz pretvoriti `x`, `surfaceY` i `avatarSize` u postotke: `vrijednost / 320 * 100`. Avatar ima `position: absolute`, `left`, `top` i `transform: translate(-50%, -100%)`. To ga postavlja iznad svoje platforme. Pozicije su provjerene s probnim avatarima; stvarni `Avatar` render treba provjeriti i s njegovim okvirima/vatrom. Dekoracije koje izlaze iz okvira mogu trebati malo manju veličinu.

```css
.postolje {
  position: relative;
  width: min(100%, 320px);
  aspect-ratio: 1;
  margin-inline: auto;
}

.postolje-podloga {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.postolje-avatar {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--velicina);
  aspect-ratio: 1;
  transform: translate(-50%, -100%);
}
```

Ne sortirati avatare prema korisniku koji gleda igru niti prema rasporedu sjedala. Za svaki `slot.rank` pronaći igrača pomoću `stanje.kraj.plasmani.find(p => p.plasman === slot.rank)`, a njegov avatar po `igracId` iz postojećih podataka o igračima. Poštovati postojeći prikaz gostiju; ne izmišljati im registrirani avatar.

Redoslijed lijevo–desno:

- Dvoboj: drugo mjesto, prvo mjesto.
- Četvero: drugo mjesto, prvo mjesto, treće mjesto, četvrto mjesto.

Broj plasmana dodati kroz kod iznad avatara. Imena, bodove i eventualne eliminacije zadržati u postojećem pristupačnom popisu `plasmani-lista` ispod postolja: puni nadimci ne stanu pouzdano na četiri uska bloka.

Postolje koristiti samo kad broj igrača i jedinstveni plasmani odgovaraju predlošku (1–2 ili 1–4). Za privatne sobe s drugim brojem igrača, nedostajući ili neočekivani plasman prikazati postojeći popis rezultata. Bez izmišljenog pobjednika, bez dupliranja avatara i bez dodjeljivanja javnih bodova privatnim igrama.

## Iskoristi i postojeće assete

- `43-kaladont.png`: pobjednička poruka / Kaladont! dostignuće.
- `44-ka-zna.png`: ispadanje zbog Kaladonta, ako želiš specifičnu ilustraciju umjesto opće 49.
- `46-slijepa-ulica.png`: ispadanje zbog mrtvih slova, uz točan tekst razloga.
- `38-pobjednicki-niz.png`: prikaz aktivnog pobjedničkog niza u rezultatima.
- `36-dnk-rijetke-rijeci.png` i `35-dnk-duge-rijeci.png`: male vizualne dopune postojećih nagrada za riječi.

Te datoteke ostaju u ranijem ZIP-u 32–48; ovaj paket sadrži samo nove 49–60.

## Provjera nakon ugradnje

Provjeriti dvoboj i igru učetvero, javnu i privatnu igru, vlastitu i tuđu eliminaciju, istek, predaju, ponovno spajanje i nedostupnu igru. Provjeriti prikaz rezultata s različitim pobjednicima: prvo mjesto mora uvijek ostati na zlatnom bloku. Na mobitelu avatari ne smiju prekriti susjedni avatar, a dugi nadimci ostaju u popisu ispod.

## Pregledani izvori

- [Stranica igre i završni poredak](https://github.com/josipmestrovic/kaladont/blob/87bf60439cda67ab921e4a33683ea2f858c01dbe/aplikacije/web/src/routes/partija/%5Bid%5D/%2Bpage.svelte)
- [Red čekanja](https://github.com/josipmestrovic/kaladont/blob/87bf60439cda67ab921e4a33683ea2f858c01dbe/aplikacije/web/src/routes/red/%2Bpage.svelte)
- [Privatna soba](https://github.com/josipmestrovic/kaladont/blob/87bf60439cda67ab921e4a33683ea2f858c01dbe/aplikacije/web/src/routes/soba/%5Bkod%5D/%2Bpage.svelte)
- [Obavijest o vezi](https://github.com/josipmestrovic/kaladont/blob/87bf60439cda67ab921e4a33683ea2f858c01dbe/aplikacije/web/src/lib/komponente/VezaObavijest.svelte)
- [Obračun iskustva](https://github.com/josipmestrovic/kaladont/blob/87bf60439cda67ab921e4a33683ea2f858c01dbe/aplikacije/web/src/lib/komponente/IskustvoPartije.svelte)
