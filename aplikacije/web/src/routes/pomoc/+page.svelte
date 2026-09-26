<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { RANGOVI, RANGOVI_1V1 } from 'zajednicko';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';

  type Tema = 'kako-igrati' | 'pravila' | 'nacini' | 'bodovi' | 'napredak' | 'pitanja';
  const teme: { id: Tema; naziv: string }[] = [
    { id: 'kako-igrati', naziv: 'Kako igrati' },
    { id: 'nacini', naziv: 'Načini igre' },
    { id: 'bodovi', naziv: 'Bodovi i rangovi' },
    { id: 'napredak', naziv: 'Napredak' },
    { id: 'pitanja', naziv: 'Pitanja i problemi' },
  ];

  const odabranaTema = $derived(
    teme.some((tema) => tema.id === $page.url.searchParams.get('tema'))
      ? ($page.url.searchParams.get('tema') as Tema)
      : 'kako-igrati',
  );

  const seoNaslovi: Record<Tema, string> = {
    'kako-igrati': 'Pravila Kaladonta - Kako se igra Kaladont',
    nacini: 'Načini igre Kaladont - Igraj online',
    bodovi: 'Bodovi i rangovi u Kaladontu',
    napredak: 'Napredak i Kaladont DNK',
    pitanja: 'Pitanja i problemi - Kaladont',
    pravila: 'Pravila Kaladonta - Kako se igra Kaladont',
  };

  const seoOpisi: Record<Tema, string> = {
    'kako-igrati': 'Saznaj kako se igra Kaladont online, kako povezati riječi i kada igrač ispada.',
    nacini: 'Usporedi načine igre Kaladont: dva igrača, četiri igrača i privatne sobe.',
    bodovi: 'Saznaj kako funkcioniraju bodovi, pobjede, rangovi i ljestvice u Kaladontu.',
    napredak: 'Saznaj kako rade XP, dostignuća, ocjena partije i Kaladont DNK.',
    pitanja: 'Odgovori na najčešća pitanja o riječima, potezima, rangu i Kaladontu.',
    pravila: 'Saznaj osnovna pravila igre Kaladont i kako se povezuju riječi.',
  };

  async function otvoriTemu(tema: Tema, sidro?: string): Promise<void> {
    await goto(`/pravila-kaladonta?tema=${tema}${sidro ? `#${sidro}` : ''}`, { replaceState: true, noScroll: true });
    requestAnimationFrame(() => document.getElementById(sidro ?? 'sadrzaj-pomoci')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function rasponRanga(indeks: number, rangovi: readonly { minimalniProsjek: number }[]): string {
    if (indeks === 0) return `manje od ${rangovi[1]!.minimalniProsjek.toFixed(2).replace('.', ',')}`;
    if (indeks === rangovi.length - 1) return `${rangovi[indeks]!.minimalniProsjek.toFixed(2).replace('.', ',')} ili više`;
    return `${rangovi[indeks]!.minimalniProsjek.toFixed(2).replace('.', ',')} – ${(rangovi[indeks + 1]!.minimalniProsjek - 0.01).toFixed(2).replace('.', ',')}`;
  }
</script>

<svelte:head>
  <title>{seoNaslovi[odabranaTema]}</title>
  <meta name="description" content={seoOpisi[odabranaTema]} />
</svelte:head>

<main class="pomoc">
  <header class="zaglavlje">
    <p class="nadnaslov">Vodič kroz Kaladont</p>
    <h1>Pravila Kaladonta</h1>
    <p>Kako igrati, pravila, načini igre, bodovi, rangovi i Kaladont DNK.</p>
  </header>

  <nav class="teme" aria-label="Teme pomoći">
    {#each teme as tema}
      <a href={`/pravila-kaladonta?tema=${tema.id}`} class:aktivna={odabranaTema === tema.id} aria-current={odabranaTema === tema.id ? 'page' : undefined}>{tema.naziv}</a>
    {/each}
  </nav>

  {#if odabranaTema === 'kako-igrati'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="kako-igrati-naslov">
      <h2 id="kako-igrati-naslov">Kako igrati</h2>
      <p class="uvod">Cilj je ostati posljednji igrač. Na svom potezu upiši valjanu riječ koja počinje prikazanim grafemima.</p>
      <ol class="koraci">
        <li><strong>Odaberi igru.</strong> U javnoj igri možeš birati dva ili četiri igrača, a možeš igrati i kao gost.</li>
        <li><strong>Pričekaj početnu riječ.</strong> Sustav je bira na početku svake runde; igrači ne biraju otvarajuću riječ.</li>
        <li><strong>Smisli nastavak.</strong> U javnoj partiji imaš 30 sekundi po potezu.</li>
        <li><strong>Dopiši samo ostatak riječi.</strong> Početna slova već su u polju. Pritisni <strong>Pošalji</strong> ili Enter.</li>
        <li><strong>Ako riječ ne prođe, pokušaj ponovno.</strong> Ne ispadaš odmah, ali vrijeme nastavlja teći.</li>
        <li><strong>„Ne znam” znači ispadanje.</strong> Nakon toga možeš promatrati ostatak partije.</li>
      </ol>
      <aside class="napomena"><strong>Pazi na „ka”.</strong> Ako protivniku ostaviš „ka”, može odigrati „kaladont” i izbaciti te iz partije.</aside>
      <section aria-labelledby="pravila-naslov">
        <h2 id="pravila-naslov">Pravila igre</h2>
        <section><h3>Kako povezujemo riječi</h3><p>Nova riječ mora početi na posljednja dva grafema prethodne riječi. Primjer: <strong>sova → vaza → zabava</strong>.</p><p><strong>Nj, lj i dž</strong> računaju se kao jedan grafem, odnosno jedno slovo. Zato nakon „konj” tražimo <strong>onj</strong>: grafeme o i nj. Iznimke izgovora i rastava riječi provjerava rječnik igre; primjerice, „injekcija” počinje na i-n, a ne i-nj.</p><p>Unos možeš ispraviti dok vrijeme traje. Nevaljan pokušaj ne izbacuje te, ali troši vrijeme.</p></section>
        <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim grafemima i pripadati dopuštenoj vrsti riječi. U javnoj igri dopuštene su imenice, glagoli, pridjevi, prilozi, zamjenice, brojevi, prijedlozi, veznici, čestice, usklici i vlastita imena u oblicima iz rječnika.</p><ul><li>Vlastita imena, primjerice „Ana”, „Zagreb” i „Italija”, jesu dopuštena.</li><li>Dijakritici su važni: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Kratice, brojke te zapisi s crticama ili razmacima nisu u igri.</li><li>U privatnoj sobi vlasnik može ograničiti vrste riječi; imenice su uvijek uključene.</li></ul></section>
        <section><h3>Kako sustav bira početnu riječ?</h3><p>Sustav prvo nasumičnim redoslijedom provjerava odobreni skup od 52 sigurnih riječi. Riječ se bira samo ako je dopuštena i još nije potrošena, ako na nju postoji barem jedan dopušten odgovor te ako <strong>svaki dopušten odgovor</strong>, nakon potrošnje svojih povezanih oblika, ima barem jedan slobodan nastavak.</p><p>Provjera poštuje vrste riječi dopuštene u privatnoj sobi i sve oblike potrošene u ranijim rundama. Time se izbjegava da početna riječ ili neki od mogućih prvih odgovora odmah stavi igrača u slijepu ulicu. To ne jamči nastavak cijele partije: kasnija situacija i dalje može završiti mrtvim slovima.</p><p>Ako nema dostupne sigurne riječi, sustav koristi rezervnu riječ s barem jednim slobodnim dopuštenim nastavkom. Rezervna riječ ne jamči da će svi odgovori nakon nje također imati nastavak. Ako nema ni rezervne riječi, partija se automatski završava; igrač se ne eliminira zbog pogreške u rječniku. Pravilo vrijedi u javnim i privatnim partijama.</p></section>
        <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije</strong>. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></section>
        <section><h3>Kaladont efekt i ispadanje</h3><p>Kada igrač ostavi „ka”, protivnik može odigrati „kaladont” i izbaciti igrača koji mu je omogućio taj potez. Ispadaš i kada odabereš „Ne znam”, istekne vrijeme, ostanu <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-kako-igrati" /> ili se ne vratiš nakon prekida veze.</p></section>
      </section>
      <p class="poveznica">Spreman? <a href="/">Odaberi način igre →</a></p>
    </section>
  {:else if odabranaTema === 'pravila'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="pravila-naslov">
      <h2 id="pravila-naslov">Pravila</h2>
      <section><h3>Kako povezujemo riječi</h3><p>Nova riječ mora početi na posljednja dva grafema prethodne riječi. Primjer: <strong>sova → vaza → zabava</strong>.</p><p><strong>Nj, lj i dž</strong> računaju se kao jedno slovo. Zato nakon „konj” tražimo <strong>onj</strong>: slovo o i grafem nj.</p></section>
      <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim grafemima i pripadati dopuštenoj vrsti riječi. Javni rječnik prihvaća imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice, usklice i vlastita imena, u uvezenim oblicima.</p><ul><li>Vlastita imena poput „Ana”, „Zagreb” i „Italija” dopuštena su.</li><li>Dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Kratice, brojke te riječi sa spojnicom ili razmakom nisu u igrivom rječniku.</li><li>Vlasnik privatne sobe može ograničiti vrste riječi, ali imenice su uvijek uključene.</li></ul></section>
      <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije, uključujući nove runde</strong>. Dobar, dobra, dobro — ista ekipa u drugoj majici. Nakon jednog oblika ostali više ne prolaze.</p><p>Stručnije: odigrani oblik troši sve svoje leksemske grupe. „Bolji” i „najbolji” mogu pripadati zasebnim grupama. „Kaladont” i „kalodont” posebne su riječi i mogu se ponoviti.</p></section>
      <section><h3>Riječ sustava na početku runde: sigurne riječi</h3><p>Na početku partije, nakon eliminacije i nakon Kaladont-efekta riječ bira sustav, a ne igrač. Najprije nasumičnim redoslijedom provjerava odobreni skup od 52 riječi.</p><ol><li>Početna riječ mora biti dopuštena i ne smije biti potrošena u ranijoj rundi.</li><li>Nakon nje mora postojati barem jedan valjani odgovor.</li><li>Svaki valjani prvi odgovor, nakon što potroši sve svoje povezane oblike, mora imati barem jedan slobodan dopušten nastavak.</li></ol><p>Provjera uzima u obzir dopuštene vrste riječi u privatnoj sobi i sve grupe već potrošene u partiji. Tako sustav sprječava početak koji bi odmah prisilio sljedećeg igrača na ispadanje. To nije jamstvo da cijela partija ne može doći do mrtvih slova.</p><p>Ako nijedna od 52 riječi ne zadovolji uvjete, sustav bira rezervnu riječ koja ima barem jedan slobodan dopušten nastavak. Rezervna riječ ne jamči nastavak nakon svakog mogućeg odgovora. Ako ni rezervne riječi nema, partija se automatski završava i igrač se ne eliminira zbog kvara rječnika. Isto pravilo vrijedi u javnim i privatnim partijama.</p></section>
      <section><h3>Kaladont efekt</h3><p>Ana odigra „jabuka” i ostavi <strong>ka</strong>. Boris odgovori „kaladont”. <strong>Ana ispada</strong>, a sustav otvara novu rundu. Ne ispada igrač koji je sljedeći na redu.</p><ul><li>Ako je „ka” ostavila početna riječ sustava, nitko ne ispada i nitko ne dobiva bod za eliminaciju.</li><li>U javnoj igri za četiri igrača izvođač dobiva bod za eliminaciju. U dvoboju vrijedi fiksno bodovanje pobjede, a u privatnoj sobi bod ovisi o postavci eliminacija.</li></ul></section>
      <section><h3><PojamPomoc tekst="Mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-naslov" /></h3><p><PojamPomoc tekst="Mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-definicija" /> su traženi nastavak za koji više nema dopuštene riječi. To se može dogoditi zato što nastavka nema u rječniku igre ili zato što su sve dostupne riječi na taj nastavak već potrošene.</p></section>
      <section><h3>Kada ispadaš?</h3><ul><li>odabereš <strong>Ne znam</strong> — to nije preskakanje poteza;</li><li>istekne vrijeme prije valjane riječi;</li><li>prethodni igrač ostavi <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-ispadanje" />;</li><li>protivnik izvede Kaladont na „ka” koje si mu ostavio;</li><li>ne vratiš se nakon prekida veze u roku od 10 sekundi.</li></ul><p>Odbijena riječ ne izbacuje te odmah. Probaj drugu riječ, ali sat nema razumijevanja.</p></section>
      <details class="jezicne-iznimke"><summary>Jezične iznimke i grafemi</summary><p>Kod većine riječi nj, lj i dž čitamo kao jedan grafem. Iznimke se vode u rječniku igre: primjerice, „injekcija” počinje grafemima i-n, a ne i-nj. Server uvijek provjerava konačni potez.</p></details>
    </section>
  {:else if odabranaTema === 'nacini'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="nacini-naslov">
      <h2 id="nacini-naslov">Načini igre</h2>
      <p class="uvod">Pravila riječi ista su svugdje. Razlikuju se broj igrača, napredak i tko odlučuje o postavkama.</p>
      <div class="tablica-omotac usporedba-modova"><table><thead><tr><th></th><th>4 igrača</th><th>2 igrača</th><th>Privatna soba</th></tr></thead><tbody><tr><th>S kim igraš?</th><td>Igrači iz javnog reda</td><td>Protivnik iz javnog reda</td><td>Ekipa koju pozoveš poveznicom</td></tr><tr><th>Broj igrača</th><td>4</td><td>2</td><td>2–8</td></tr><tr><th>Vrijeme po potezu</th><td>30 sekundi</td><td>30 sekundi</td><td>15, 30 ili 60 sekundi ili bez tajmera</td></tr><tr><th>Rang i javna ljestvica</th><td>Da, zasebni 4 igrača</td><td>Da, zasebni dvoboj</td><td>Ne; samo privremena ljestvica sobe</td></tr><tr><th>XP i DNK</th><td>Da</td><td>Da</td><td>Ne</td></tr><tr><th>Bodovi</th><td>Plasman + eliminacije + bonus pobjedniku</td><td>Pobjeda 1, poraz 0</td><td>Pobjeda 2; vlasnik može uključiti +1 po eliminaciji</td></tr><tr><th>Dostignuća u privatnoj igri</th><td>Da</td><td>Da</td><td>Rijetkolovac, Dugometraš i Jezik u plamenu</td></tr></tbody></table></div>
      <section><h3>Igra s prijateljima</h3><p><strong>Stvori sobu → odaberi postavke → kopiraj pozivnu poveznicu → pošalji je ekipi → vlasnik pokreće igru.</strong></p><p>Vlasnik bira trajanje poteza, dopuštene vrste riječi i hoće li izazvane eliminacije donositi po 1 bod. Ta je opcija pri stvaranju uključena. Pobjeda donosi 2 boda na ljestvici sobe; bodovi se zbrajaju samo dok je soba aktivna.</p><p>Privatnoj sobi možeš dopustiti: imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice, usklice i vlastita imena. Imenice su uvijek uključene. Pravila grafema, ponavljanja i sigurne početne riječi ostaju na snazi.</p><p class="poveznica"><a href="/soba/kreiraj">Stvori privatnu sobu →</a></p></section>
      <section><h3>Što napreduje u privatnoj sobi?</h3><p>Privatna partija ne mijenja javni rang, javne bodove, XP, Kaladont DNK, formu ni javni niz pobjeda. Možeš napredovati i otključati samo tri jezična dostignuća: <strong>Rijetkolovac</strong>, <strong>Dugometraš</strong> i <strong>Jezik u plamenu</strong>. Ostala dostignuća zahtijevaju javnu partiju.</p></section>
    </section>
  {:else if odabranaTema === 'bodovi'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="bodovi-naslov">
      <h2 id="bodovi-naslov">Bodovi i rangovi</h2>
      <section><h3>Kako dobivaš bodove?</h3><p><strong>Igra za četiri igrača:</strong> plasman donosi 1. mjestu 3 boda, 2. mjestu 2, 3. mjestu 1, a 4. mjestu 0. Svaka eliminacija koju izazoveš donosi +1, a pobjednik dobiva još +1. Maksimum je 7 bodova: 3 za prvo mjesto, 1 pobjednički bonus i najviše 3 za eliminacije.</p><p>Eliminacijski bod dobiva igrač čija riječ ostane bez valjanog odgovora zbog „Ne znam”, isteka vremena ili mrtvih slova. Prekid veze izvan poteza je samoeliminacija i ne daje bod nikome. Prekid na potezu može dati bod igraču koji je otvorio traženi nastavak.</p><p><strong>Dvoboj:</strong> pobjeda donosi 1 bod, poraz 0; plasman i eliminacije ne dodaju dvoboju bodova.</p><p><strong>Privatna soba:</strong> pobjeda donosi 2 boda na ljestvici sobe. Vlasnik može uključiti +1 bod za svaku izazvanu eliminaciju; ta je postavka zadano uključena. Ti bodovi ne mijenjaju javni rezultat.</p><p class="primjer-izracuna"><strong>Primjer za četiri igrača:</strong> 2. mjesto (2 boda) + jedna izazvana eliminacija (1) = <strong>3 boda</strong>. Pobjednik s dvije eliminacije dobiva 3 + 2 + 1 = <strong>6 bodova</strong>.</p></section>
      <section><h3>Kako dobivaš rang?</h3><p>Rang dobivaš nakon <strong>10 završenih javnih partija u tom načinu igre</strong>. Do tada se prikazuje „Piskaralo”. Rang ovisi o prosjeku bodova, može rasti i padati, a za dva i četiri igrača računa se zasebno. U dvoboju prosjek bodova jednak je udjelu pobjeda jer pobjeda vrijedi 1 bod, a poraz 0. Pragovi se primjenjuju na nezaokružene vrijednosti.</p><p>Obrub avatara prikazuje tvoj viši rang između dvaju javnih modova. Rang je vizualni status i ne daje prednost u igri niti utječe na uparivanje.</p><p>Javna ljestvica prikazuje do 100 registriranih igrača s najmanje 10 završenih partija u odabranom modu.</p></section>
      <section><h3>Rangovi za četiri igrača</h3><div class="tablica-omotac"><table><thead><tr><th>Rang</th><th>Prosjek bodova</th></tr></thead><tbody>{#each RANGOVI as rang, indeks}<tr><td>{rang.naziv}</td><td>{rasponRanga(indeks, RANGOVI)}</td></tr>{/each}</tbody></table></div></section>
      <section><h3>Rangovi za dvoboj</h3><div class="tablica-omotac"><table><thead><tr><th>Rang</th><th>Udio pobjeda</th></tr></thead><tbody>{#each RANGOVI_1V1 as rang, indeks}<tr><td>{rang.naziv}</td><td>{rasponRanga(indeks, RANGOVI_1V1)}</td></tr>{/each}</tbody></table></div></section>
      <p class="poveznica"><a href="/ljestvica">Otvori ljestvicu igrača →</a></p>
    </section>
  {:else if odabranaTema === 'napredak'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="napredak-naslov">
      <h2 id="napredak-naslov">Napredak</h2>
      <div class="tablica-omotac oznake-tablica"><table><tbody><tr><th>Rang</th><td>Rezultati kroz prosjek bodova u određenom načinu igre.</td></tr><tr><th>Razina / LVL</th><td>Ukupno prikupljeno iskustvo.</td></tr><tr><th>Dostignuća</th><td>Ostvareni zadaci i njihove razine.</td></tr><tr><th>Ocjena partije</th><td>Automatska ocjena završene partije, povezana s dodatnim XP-om.</td></tr><tr><th>Kaladont DNK</th><td>Šest obilježja tvog načina igranja.</td></tr></tbody></table></div>
      <section><h3>XP i razine</h3><p>XP je dugoročni napredak odvojen od bodova i ranga. Dobivaš ga samo u normalno završenim javnim partijama; privatne partije ne daju XP. Maksimalna je razina 100, a nakon nje novi XP više ne podiže razinu.</p><div class="tablica-omotac"><table><thead><tr><th>Događaj</th><th>XP</th></tr></thead><tbody><tr><td>Prihvaćena riječ</td><td>5</td></tr><tr><td>Duga riječ (10–11 grafema)</td><td>+10</td></tr><tr><td>Srednje duga riječ (12–14 grafema)</td><td>+20</td></tr><tr><td>Jako duga riječ (15+ grafema)</td><td>+35</td></tr><tr><td>Rijetka riječ (frekvencija 10–99)</td><td>+15</td></tr><tr><td>Srednje rijetka riječ (1–9)</td><td>+30</td></tr><tr><td>Jako rijetka riječ (0, uz najmanje 4 grafema)</td><td>+50</td></tr><tr><td>Izazvana eliminacija</td><td>+25</td></tr><tr><td>Pobjeda</td><td>+50</td></tr><tr><td>Kaladont / kalodont</td><td>+100 umjesto uobičajene nagrade za tu riječ</td></tr></tbody></table></div><p>Duljinski i rijetkosni dodatak mogu se zbrojiti s osnovnih 5 XP za prihvaćenu riječ, a i međusobno. `Nj`, `lj` i `dž` računaju se kao jedan grafem. Dugi i rijetki oblici donose XP svaki put kada su prihvaćeni, ne samo pri prvom otključavanju u kolekciji. Dobrovoljni izlazak ili nepovratak nakon prekida veze poništava XP za tu partiju.</p></section>
      <section><h3>Niz prihvaćenih riječi tijekom partije</h3><p>Svaka uzastopna prihvaćena riječ povećava niz. Odbijena riječ vraća ga na nulu, ali sama po sebi ne izbacuje te iz partije. Najdulji niz u partiji množi osnovni XP zbroj:</p><div class="tablica-omotac"><table><thead><tr><th>Najdulji niz</th><th>XP-množitelj</th></tr></thead><tbody><tr><td>0–2 riječi</td><td>×1,00</td></tr><tr><td>3</td><td>×1,10</td></tr><tr><td>4</td><td>×1,25</td></tr><tr><td>5</td><td>×1,40</td></tr><tr><td>6</td><td>×1,60</td></tr><tr><td>7</td><td>×1,75</td></tr><tr><td>8</td><td>×1,90</td></tr><tr><td>9 ili više</td><td>×2,00</td></tr></tbody></table></div><p>Ovaj niz vrijedi unutar jedne partije i nije isto što i niz pobjeda kroz više partija.</p></section>
      <section><h3>Niz pobjeda i bonus XP</h3><p>Uzastopne javne pobjede povećavaju bonus na XP za osvojenu partiju. Niz se vodi odvojeno za igru s četiri igrača i dvoboj; poraz ga prekida u tom modu. Privatne partije ne povećavaju niti prekidaju javni niz.</p><p>Bonus počinje drugom pobjedom. U igri za četiri igrača raste za 10 postotnih bodova po pobjedi, a u dvoboju za 5, do najviše +100%.</p><div class="tablica-omotac"><table><thead><tr><th>Uzastopne pobjede</th><th>4 igrača</th><th>Dvoboj</th></tr></thead><tbody><tr><td>1</td><td>+0%</td><td>+0%</td></tr><tr><td>2</td><td>+10%</td><td>+5%</td></tr><tr><td>3</td><td>+20%</td><td>+10%</td></tr><tr><td>4</td><td>+30%</td><td>+15%</td></tr><tr><td>5</td><td>+40%</td><td>+20%</td></tr><tr><td>6</td><td>+50%</td><td>+25%</td></tr><tr><td>7</td><td>+60%</td><td>+30%</td></tr><tr><td>8</td><td>+70%</td><td>+35%</td></tr><tr><td>9</td><td>+80%</td><td>+40%</td></tr><tr><td>10</td><td>+90%</td><td>+45%</td></tr><tr><td>11</td><td>+100%</td><td>+50%</td></tr><tr><td>12</td><td>+100%</td><td>+55%</td></tr><tr><td>13</td><td>+100%</td><td>+60%</td></tr><tr><td>14</td><td>+100%</td><td>+65%</td></tr><tr><td>15</td><td>+100%</td><td>+70%</td></tr><tr><td>16</td><td>+100%</td><td>+75%</td></tr><tr><td>17</td><td>+100%</td><td>+80%</td></tr><tr><td>18</td><td>+100%</td><td>+85%</td></tr><tr><td>19</td><td>+100%</td><td>+90%</td></tr><tr><td>20</td><td>+100%</td><td>+95%</td></tr><tr><td>21 ili više</td><td>+100%</td><td>+100%</td></tr></tbody></table></div><p>Maksimalni bonus stiže na 11. uzastopnoj pobjedi u igri za četiri igrača i na 21. u dvoboju. Profil, red i završetak partije pokazuju trenutačni niz i bonus sljedeće pobjede.</p></section>
      <section><h3>Duge i rijetke riječi</h3><ul><li>Duga riječ ima 10–11, srednje duga 12–14, a jako duga 15 ili više grafema.</li><li>Rijetkost ovisi o učestalosti oblika u rječniku igre: 10–99 je rijetka, 1–9 srednje rijetka, a 0 jako rijetka; za posljednju treba imati najmanje 4 grafema.</li><li><strong>Nj, lj i dž</strong> računaju se kao jedan grafem.</li></ul></section>
      <section><h3>Dostignuća</h3><p>U profilu je 10 dostignuća s po pet razina, ukupno 50 zvjezdica. Pragovi su:</p><ul><li><strong>Iskusnjara:</strong> razine XP-a 10, 20, 40, 70, 100.</li><li><strong>Rijetkolovac:</strong> 1, 5, 15, 40, 100 rijetkih leksemskih grupa.</li><li><strong>Dugometraš:</strong> 1, 10, 30, 75, 150 dugih riječi.</li><li><strong>Jezik u plamenu:</strong> najdulji niz prihvaćenih riječi u partiji od 3, 5, 7, 10, 15.</li><li><strong>Kaladont!:</strong> 1, 3, 10, 25, 50 izvedenih Kaladonata.</li><li><strong>KA-zna:</strong> 1, 5, 15, 25, 50 ispadanja zbog Kaladonta.</li><li><strong>Lovac na glave:</strong> 1, 10, 30, 75, 150 izazvanih eliminacija.</li><li><strong>Slijepa ulica:</strong> 1, 5, 15, 40, 100 eliminacija izazvanih mrtvim slovima.</li><li><strong>Završna riječ:</strong> 1, 5, 20, 50, 100 javnih pobjeda.</li><li><strong>Glas zajednice:</strong> 1, 2, 3, 4, 5 poslanih povratnih informacija.</li></ul><p>U privatnoj sobi mogu napredovati i otključati se samo Rijetkolovac, Dugometraš i Jezik u plamenu. Zvjezdice dostignuća nisu isto što i ocjena partije.</p></section>
      <section><h3>Forma i vatra</h3><p>Forma se računa iz najviše zadnjih 10 javnih partija odabranog moda: u dvoboju kao udio pobjeda, a u igri za četiri igrača kao prosjek bodova. Naziv se prikazuje nakon 5 partija; nakon 10 koristi puni uzorak. S 20 partija posljednjih 10 može se usporediti s prethodnih 10 radi trenda. Pragovi za puni uzorak:</p><div class="tablica-omotac"><table><thead><tr><th>Forma</th><th>Udio pobjeda u dvoboju</th><th>Prosjek bodova, 4 igrača</th></tr></thead><tbody><tr><td>Loša</td><td>&lt;10%</td><td>&lt;0,75</td></tr><tr><td>Slaba</td><td>10–&lt;20%</td><td>0,75–&lt;1,25</td></tr><tr><td>Prolazna</td><td>20–&lt;30%</td><td>1,25–&lt;1,75</td></tr><tr><td>Dobra</td><td>30–&lt;50%</td><td>1,75–&lt;2,50</td></tr><tr><td>Odlična</td><td>50–&lt;70%</td><td>2,50–&lt;3,25</td></tr><tr><td>Izvanredna</td><td>70–&lt;80%</td><td>3,25–&lt;4,00</td></tr><tr><td>Sjajna</td><td>80–&lt;90%</td><td>4,00–&lt;5,00</td></tr><tr><td>Top forma</td><td>≥90%</td><td>≥5,00</td></tr></tbody></table></div><p>Vatra ovisi samo o trenutnom nizu pobjeda: za četiri igrača jedna/dvije/tri vatre počinju na 3/5/8 pobjeda, a za dvoboj na 4/8/14. Forma i vatra nisu isto; ne donose dodatne bodove ni zaseban XP.</p></section>
      <section id="ocjena-partije"><h3>Ocjena partije</h3><p>Javna partija dobiva ocjenu od 0 do 5 zvjezdica ako imaš najmanje 3 prihvaćena poteza. Za svaku od šest osi Kaladont DNK-a izračuna se promjena vrijednosti (nakon minus prije), a zatim prosjek promjena. Osnovne zvjezdice su zaokruženi rezultat <code>(prosječna promjena + 20) / 10</code>, ograničen na 0–4. Pobjeda dodaje jednu zvjezdicu, a konačna ocjena ograničena je na 0–5. Privatna partija nema ocjenu.</p><p>Ocjena ne mijenja bodove ni rang. Njezina XP-nagrada iznosi: 0–1 zvjezdica +0%, 2 +5%, 3 +10%, 4 +15%, 5 +20%. Primjer: 200 osnovnih XP uz niz pobjeda +20% daje 240 XP; pet zvjezdica zatim dodaje 48 XP, ukupno 288 prije ograničenja razine 100.</p></section>
      <section id="dnk"><h3>Kaladont DNK</h3><p>Nakon 10 javnih partija u odabranom načinu otključavaš profil svog stila igre. Uzorak sline nije potreban. DNK za dva i četiri igrača računa se zasebno.</p><div class="dnk-osi"><p><strong>Vještina</strong><span>Prati prosjek bodova. Više znači uspješnije rezultate.</span></p><p><strong>Taktika</strong><span>Prati izazvane eliminacije po partiji.</span></p><p><strong>Fokus</strong><span>Prati najduži niz prihvaćenih riječi bez pogreške.</span></p><p><strong>Brzina</strong><span>Prati prosječno vrijeme prihvaćenog poteza. Brži odgovori podižu vrijednost.</span></p><p><strong>Duge riječi</strong><span>Prati koliko često biraš duge riječi u odnosu na broj partija.</span></p><p><strong>Rijetke riječi</strong><span>Prati koliko često pronalaziš riječi male učestalosti.</span></p></div><p class="poveznica"><a href="/profil">Otvori svoj profil i Kaladont DNK →</a></p></section>
    </section>
  {:else}
    <section id="sadrzaj-pomoci" class="sadrzaj faq" aria-labelledby="pitanja-naslov">
      <h2 id="pitanja-naslov">Pitanja i problemi</h2>
      <details><summary>Zašto moja riječ nije prihvaćena?</summary><p>Provjeri tražena slova, dijakritike, dopuštenu vrstu riječi i je li riječ ili njezin oblik već potrošen. Pokušaj drugu riječ dok vrijeme još traje.</p></details>
      <details><summary>Zašto je drugi oblik iste riječi već iskorišten?</summary><p>Povezani oblici troše se zajedno do kraja cijele partije. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></details>
      <details><summary>Zašto sam odmah ispao?</summary><p>„Ne znam” znači ispadanje. Ispadaš i kada vrijeme istekne, ostanu <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-faq" />, protivnik izvede Kaladont na tvoje „ka” ili se ne vratiš nakon prekida veze.</p></details>
      <details><summary>Zašto više nemam niz bez pogreške?</summary><p>Svaka odbijena riječ prekida tvoj trenutni niz, iako te sama pogreška ne izbacuje iz partije.</p></details>
      <details><summary>Zašto sam još Piskaralo?</summary><p>Rang se dodjeljuje nakon 10 završenih javnih partija u pojedinom načinu igre. Dvoboj i igra za četiri igrača računaju se zasebno.</p></details>
      <details><summary>Zašto nisam na ljestvici?</summary><p>Za ljestvicu trebaš završiti najmanje 10 javnih partija u odabranom načinu i imati registriran profil.</p></details>
      <details><summary>Zašto u privatnoj sobi nisam dobio XP?</summary><p>Privatne sobe imaju svoju privremenu ljestvicu, ali ne dodjeljuju XP ni javne bodove. U njima mogu napredovati Rijetkolovac, Dugometraš i Jezik u plamenu.</p></details>
      <details><summary>Gdje su mi statistike na drugom uređaju?</summary><p>Kao gost napredak je vezan uz identitet na ovom uređaju. Registriraj se kako bi svoj profil mogao otvoriti i na drugom uređaju.</p></details>
      <details><summary>Kako promijeniti avatar ili utišati zvuk?</summary><p>Otvori <a href="/profil?tab=postavke">postavke profila</a>. Registrirani igrači mogu promijeniti avatar, a zvuk možeš podesiti neovisno o vrsti računa.</p></details>
      <details><summary>Kako prijaviti riječ ili problem?</summary><p>Nakon završetka partije otvori popis poteza i uz sporni potez odaberi <strong>Prijavi</strong>. Tako se prijava veže uz točnu riječ i partiju.</p></details>
      <p class="poveznica">Nisi pronašao odgovor? <a href="https://forum.kaladont.hr">Otvori Kaladont forum →</a></p>
    </section>
  {/if}
</main>

<style>
  .pomoc { max-width: 980px; margin: 0 auto; padding: 32px 4px 64px; }
  .zaglavlje { margin-bottom: 24px; }
  .nadnaslov { margin: 0 0 4px; color: var(--boja-mint); font-size: var(--tekst-sitni); font-weight: 700; text-transform: uppercase; }
  h1, h2, h3 { font-family: var(--font-naslov); color: var(--boja-tekst-naslov); }
  h1 { margin: 0; font-size: var(--naslov-1); }
  .zaglavlje > p:last-child, .uvod { margin: 8px 0 0; color: var(--boja-tekst-sekundarni); }
  .teme { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; padding-bottom: 4px; }
  .teme a { flex: 0 0 auto; padding: 10px 14px; border: 1px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-weight: 700; text-decoration: none; }
  .teme a.aktivna { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
  #sadrzaj-pomoci { scroll-margin-top: 16px; outline: none; }
  .sadrzaj { padding: 22px 0; }
  .sadrzaj h2 { margin: 0 0 18px; font-size: var(--naslov-2); }
  .sadrzaj > section { padding: 18px 0; border-top: 1px solid #e5ddc8; }
  h3 { margin: 0 0 8px; font-size: var(--naslov-3); }
  p, li, td, th { line-height: 1.6; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li + li { margin-top: 7px; }
  a { color: var(--boja-pozadina-primarna); font-weight: 700; }
  .poveznica { margin-top: 24px; }
  .koraci { margin-top: 20px; }
  .tablica-omotac { overflow-x: auto; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; background: white; }
  th, td { padding: 11px 12px; border-bottom: 1px solid #e5ddc8; text-align: left; vertical-align: top; }
  th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .usporedba-modova table { min-width: 700px; }
  .napomena, .primjer-izracuna { padding: 14px 16px; border-left: 4px solid var(--boja-mint); background: #fffdf5; }
  .jezicne-iznimke, .faq details { padding: 14px 0; border-bottom: 1px solid #e5ddc8; }
  .jezicne-iznimke { border-top: 1px solid #e5ddc8; }
  summary { cursor: pointer; font-weight: 700; }
  details p { margin: 10px 0 0; color: var(--boja-tekst-sekundarni); }
  .oznake-tablica th { width: 180px; color: var(--boja-tekst-naslov); }
  .dnk-osi { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; }
  .dnk-osi p { display: grid; gap: 2px; padding-bottom: 10px; border-bottom: 1px solid #e5ddc8; }
  .dnk-osi span { color: var(--boja-tekst-sekundarni); }
  @media (max-width: 767px) {
    .pomoc { padding-top: 24px; }
    .teme a { flex: 1 1 calc(50% - 4px); text-align: center; }
    .dnk-osi { grid-template-columns: 1fr; }
    .oznake-tablica th { width: 120px; }
  }
</style>