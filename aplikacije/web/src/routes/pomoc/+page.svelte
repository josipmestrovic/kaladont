<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { RANGOVI, RANGOVI_1V1 } from 'zajednicko';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';
  import StatistikaRjecnika from '$lib/komponente/StatistikaRjecnika.svelte';
  import { bojaBordera } from '$lib/avatari.js';

  type Tema = 'kako-igrati' | 'pravila' | 'nacini' | 'bodovi' | 'napredak' | 'dnk' | 'pitanja' | 'pristupacnost';
  const teme: { id: Tema; naziv: string }[] = [
    { id: 'kako-igrati', naziv: 'Kako igrati' },
    { id: 'nacini', naziv: 'Načini igre' },
    { id: 'bodovi', naziv: 'Bodovi i rangovi' },
    { id: 'napredak', naziv: 'Napredak' },
    { id: 'dnk', naziv: 'Kaladont DNK' },
    { id: 'pristupacnost', naziv: 'Pristupačnost' },
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
    napredak: 'Napredak u Kaladontu',
    dnk: 'Kaladont DNK - što mjeri i kako ga razvijati',
    pitanja: 'Pitanja i problemi - Kaladont',
    pravila: 'Pravila Kaladonta - Kako se igra Kaladont',
    pristupacnost: 'Pristupačnost i čitanje naglas - Kaladont',
  };

  const seoOpisi: Record<Tema, string> = {
    'kako-igrati': 'Saznaj kako se igra Kaladont online, kako povezati riječi i kada igrač ispada.',
    nacini: 'Usporedi načine igre Kaladont: Dvoboj, Četveroboj i privatne sobe.',
    bodovi: 'Saznaj kako funkcioniraju bodovi, pobjede, rangovi i ljestvice u Kaladontu.',
    napredak: 'Saznaj kako rade XP, dostignuća i ocjena partije.',
    dnk: 'Saznaj što mjeri šest osi Kaladont DNK-a i kako načinom igre utječeš na njih.',
    pitanja: 'Odgovori na najčešća pitanja o riječima, potezima, rangu i Kaladontu.',
    pravila: 'Saznaj osnovna pravila igre Kaladont i kako se povezuju riječi.',
    pristupacnost: 'Postavi čitanje naglas na uređaju i saznaj kako Kaladont podržava različite načine učenja.',
  };

  async function otvoriTemu(tema: Tema, sidro?: string): Promise<void> {
    await goto(`/pravila-kaladonta?tema=${tema}${sidro ? `#${sidro}` : ''}`, { replaceState: true, noScroll: true });
    requestAnimationFrame(() => document.getElementById(sidro ?? 'sadrzaj-pomoci')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function rasponRanga(indeks: number, rangovi: readonly { minimalniProsjek: number }[], postotak = false): string {
    const formatiraj = (prag: number) => postotak ? `${Math.round(prag * 100)} %` : prag.toFixed(2).replace('.', ',');
    if (indeks === 0) return `manje od ${formatiraj(rangovi[1]!.minimalniProsjek)}`;
    if (indeks === rangovi.length - 1) return `${formatiraj(rangovi[indeks]!.minimalniProsjek)} ili više`;
    return `${formatiraj(rangovi[indeks]!.minimalniProsjek)} – manje od ${formatiraj(rangovi[indeks + 1]!.minimalniProsjek)}`;
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
    <p>Kako igrati, pravila, riječi, načini igre, napredak, Kaladont DNK i pristupačnost.</p>
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
        <li><strong>Odaberi igru.</strong> U javnoj igri možeš birati Dvoboj (2 igrača) ili Četveroboj (4 igrača), a možeš igrati i kao gost.</li>
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
        <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim grafemima i pripadati dopuštenoj vrsti riječi. U javnoj igri prihvaćaju se oblici imenica, glagola, pridjeva, priloga, zamjenica, brojeva, prijedloga, veznika, čestica, usklica i vlastitih imena.</p><ul><li>Vlastita imena, primjerice „Ana”, „Zagreb” i „Italija”, jesu dopuštena.</li><li>Dijakritici su važni: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Kratice, brojke te zapisi s crticama ili razmacima nisu u igri.</li><li>U privatnoj sobi vlasnik može ograničiti vrste riječi; imenice su uvijek uključene.</li></ul><StatistikaRjecnika prikaz="tablica" /></section>
        <section><h3>Kako sustav bira početnu riječ?</h3><p>Sustav prvo nasumičnim redoslijedom provjerava odobreni skup od 52 sigurne riječi. Riječ se bira samo ako je dopuštena i još nije potrošena, ako na nju postoji barem jedan dopušten odgovor te ako <strong>svaki dopušten odgovor</strong>, nakon potrošnje svojih povezanih oblika, ima barem jedan slobodan nastavak.</p><p>Provjera poštuje vrste riječi dopuštene u privatnoj sobi i sve oblike potrošene u ranijim rundama. Time se izbjegava da početna riječ ili neki od mogućih prvih odgovora odmah stavi igrača u slijepu ulicu. To ne jamči nastavak cijele partije: kasniji potez može završiti <PojamPomoc tekst="mrtvim slovima" opis="Tražena zadnja dva grafema nemaju nijednu dostupnu dopuštenu riječ: takva riječ ne postoji u rječniku ili su svi njezini oblici već potrošeni u ovoj partiji." id="mrtva-slova-sigurnost" />.</p><p>Ako nema dostupne sigurne riječi, sustav koristi rezervnu riječ s barem jednim slobodnim dopuštenim nastavkom. Rezervna riječ ne jamči da će svi odgovori nakon nje također imati nastavak. Ako nema ni rezervne riječi, partija se automatski završava; igrač se ne eliminira zbog pogreške u rječniku. Pravilo vrijedi u javnim i privatnim partijama.</p></section>
        <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije</strong>. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></section>
        <section><h3>Kaladont efekt i ispadanje</h3><p>Kada igrač ostavi „ka”, protivnik može odigrati „kaladont” i izbaciti igrača koji mu je omogućio taj potez. Ispadaš i kada odabereš „Ne znam”, istekne vrijeme, ostanu <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-kako-igrati" /> ili se ne vratiš nakon prekida veze.</p></section>
      </section>
      <p class="poveznica">Spreman? <a href="/">Odaberi način igre →</a></p>
    </section>
  {:else if odabranaTema === 'pravila'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="pravila-naslov">
      <h2 id="pravila-naslov">Pravila</h2>
      <section><h3>Kako povezujemo riječi</h3><p>Nova riječ mora početi na posljednja dva grafema prethodne riječi. Primjer: <strong>sova → vaza → zabava</strong>.</p><p><strong>Nj, lj i dž</strong> računaju se kao jedno slovo. Zato nakon „konj” tražimo <strong>onj</strong>: slovo o i grafem nj.</p></section>
      <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim grafemima i pripadati dopuštenoj vrsti riječi. Javni rječnik prihvaća uvezene oblike imenica, glagola, pridjeva, priloga, zamjenica, brojeva, prijedloga, veznika, čestica, usklica i vlastitih imena.</p><ul><li>Vlastita imena poput „Ana”, „Zagreb” i „Italija” dopuštena su.</li><li>Dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Kratice, brojke te riječi sa spojnicom ili razmakom nisu u igrivom rječniku.</li><li>Vlasnik privatne sobe može ograničiti vrste riječi, ali imenice su uvijek uključene.</li></ul></section>
      <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije, uključujući nove runde</strong>. Dobar, dobra, dobro — ista ekipa u drugoj majici. Nakon jednog oblika ostali više ne prolaze.</p><p>Stručnije: odigrani oblik troši sve svoje leksemske grupe. „Bolji” i „najbolji” mogu pripadati zasebnim grupama. „Kaladont” i „kalodont” posebne su riječi i mogu se ponoviti.</p></section>
      <section><h3>Riječ sustava na početku runde: sigurne riječi</h3><p>Na početku partije, nakon eliminacije i nakon Kaladont-efekta riječ bira sustav, a ne igrač. Najprije nasumičnim redoslijedom provjerava odobreni skup od 52 riječi.</p><ol><li>Početna riječ mora biti dopuštena i ne smije biti potrošena u ranijoj rundi.</li><li>Nakon nje mora postojati barem jedan valjani odgovor.</li><li>Svaki valjani prvi odgovor, nakon što potroši sve svoje povezane oblike, mora imati barem jedan slobodan dopušten nastavak.</li></ol><p>Provjera uzima u obzir dopuštene vrste riječi u privatnoj sobi i sve grupe već potrošene u partiji. Tako sustav sprječava početak koji bi odmah prisilio sljedećeg igrača na ispadanje. Kasniji potez ipak može završiti <PojamPomoc tekst="mrtvim slovima" opis="Tražena zadnja dva grafema nemaju nijednu dostupnu dopuštenu riječ: takva riječ ne postoji u rječniku ili su svi njezini oblici već potrošeni u ovoj partiji." id="mrtva-slova-pravila-sigurne" />.</p><p>Ako nijedna od 52 riječi ne zadovolji uvjete, sustav bira rezervnu riječ koja ima barem jedan slobodan dopušten nastavak. Rezervna riječ jamči samo neposredan nastavak, ne i nastavak nakon svakog mogućeg odgovora. Ako ni rezervne riječi nema, partija se automatski završava i igrač se ne eliminira zbog kvara rječnika. Isto pravilo vrijedi u javnim i privatnim partijama.</p></section>
      <section><h3>Kaladont efekt</h3><p>Ana odigra „jabuka” i ostavi <strong>ka</strong>. Boris odgovori „kaladont”. <strong>Ana ispada</strong>, a sustav otvara novu rundu. Ne ispada igrač koji je sljedeći na redu.</p><ul><li>Ako je „ka” ostavila početna riječ sustava, nitko ne ispada i nitko ne dobiva bod za eliminaciju.</li><li>U Četveroboju izvođač dobiva bod za eliminaciju. U Dvoboju vrijedi fiksno bodovanje pobjede, a u privatnoj sobi bod ovisi o postavci eliminacija.</li></ul></section>
      <section><h3><PojamPomoc tekst="Mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-naslov" /></h3><p><PojamPomoc tekst="Mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-definicija" /> su traženi nastavak za koji više nema dopuštene riječi. To se može dogoditi zato što nastavka nema u rječniku igre ili zato što su sve dostupne riječi na taj nastavak već potrošene.</p></section>
      <section><h3>Kada ispadaš?</h3><ul><li>odabereš <strong>Ne znam</strong> — to nije preskakanje poteza;</li><li>istekne vrijeme prije valjane riječi;</li><li>prethodni igrač ostavi <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-ispadanje" />;</li><li>protivnik izvede Kaladont na „ka” koje si mu ostavio;</li><li>ne vratiš se nakon prekida veze u roku od 10 sekundi.</li></ul><p>Odbijena riječ ne izbacuje te odmah. Probaj drugu riječ, ali sat nema razumijevanja.</p></section>
      <details class="jezicne-iznimke"><summary>Jezične iznimke i grafemi</summary><p>Kod većine riječi nj, lj i dž čitamo kao jedan grafem. Iznimke se vode u rječniku igre: primjerice, „injekcija” počinje grafemima i-n, a ne i-nj. Server uvijek provjerava konačni potez.</p></details>
    </section>
  {:else if odabranaTema === 'nacini'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="nacini-naslov">
      <h2 id="nacini-naslov">Načini igre</h2>
      <p class="uvod">Pravila riječi ista su svugdje. Razlikuju se broj igrača, napredak i tko odlučuje o postavkama.</p>
      <div class="tablica-omotac usporedba-modova"><table class="tablica-mobilni-retci"><thead><tr><th scope="col">Svojstvo</th><th scope="col">Četveroboj</th><th scope="col">Dvoboj</th><th scope="col">Privatna soba</th></tr></thead><tbody>
        <tr><th scope="row">S kim igraš?</th><td data-label="Četveroboj">Igrači iz javnog reda</td><td data-label="Dvoboj">Protivnik iz javnog reda</td><td data-label="Privatna soba">Ekipa koju pozoveš poveznicom</td></tr>
        <tr><th scope="row">Broj igrača</th><td data-label="Četveroboj">4</td><td data-label="Dvoboj">2</td><td data-label="Privatna soba">2–8</td></tr>
        <tr><th scope="row">Vrijeme po potezu</th><td data-label="Četveroboj">30 sekundi</td><td data-label="Dvoboj">30 sekundi</td><td data-label="Privatna soba">15, 30 ili 60 sekundi ili bez tajmera</td></tr>
        <tr><th scope="row">Rang i javna ljestvica</th><td data-label="Četveroboj">Da, zasebni Četveroboj</td><td data-label="Dvoboj">Da, zasebni Dvoboj</td><td data-label="Privatna soba">Ne; samo privremena ljestvica sobe</td></tr>
        <tr><th scope="row">XP i DNK</th><td data-label="Četveroboj">Da</td><td data-label="Dvoboj">Da</td><td data-label="Privatna soba">Ne</td></tr>
        <tr><th scope="row">Bodovi</th><td data-label="Četveroboj">Plasman + eliminacije + bonus pobjedniku</td><td data-label="Dvoboj">Pobjeda 1, poraz 0</td><td data-label="Privatna soba">Pobjeda 2; vlasnik može uključiti +1 po eliminaciji</td></tr>
        <tr><th scope="row">Dostignuća u privatnoj igri</th><td data-label="Četveroboj">Da</td><td data-label="Dvoboj">Da</td><td data-label="Privatna soba">Rijetkolovac, Dugometraš i Jezik u plamenu</td></tr>
      </tbody></table></div>
      <section><h3>Igra s prijateljima</h3><p><strong>Stvori sobu → odaberi postavke → kopiraj pozivnu poveznicu → pošalji je ekipi → vlasnik pokreće igru.</strong></p><p>Vlasnik bira trajanje poteza, dopuštene vrste riječi i hoće li izazvane eliminacije donositi po 1 bod. Ta je opcija pri stvaranju uključena. Pobjeda donosi 2 boda na ljestvici sobe; bodovi se zbrajaju samo dok je soba aktivna.</p><p>Privatnoj sobi možeš dopustiti: imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice, usklice i vlastita imena. Imenice su uvijek uključene. Pravila grafema, ponavljanja i sigurne početne riječi ostaju na snazi.</p><p class="poveznica"><a href="/soba/kreiraj">Stvori privatnu sobu →</a></p></section>
      <section><h3>Što napreduje u privatnoj sobi?</h3><p>Privatna partija ne mijenja javni rang, javne bodove, XP, Kaladont DNK, formu ni javni niz pobjeda. Možeš napredovati i otključati samo tri jezična dostignuća: <strong>Rijetkolovac</strong>, <strong>Dugometraš</strong> i <strong>Jezik u plamenu</strong>. Ostala dostignuća zahtijevaju javnu partiju.</p></section>
    </section>
  {:else if odabranaTema === 'bodovi'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="bodovi-naslov">
      <h2 id="bodovi-naslov">Bodovi i rangovi</h2>
      <section><h3>Kako dobivaš bodove?</h3><p><strong>Četveroboj:</strong> plasman donosi 1. mjestu 3 boda, 2. mjestu 2, 3. mjestu 1, a 4. mjestu 0. Svaka eliminacija koju izazoveš donosi +1, a pobjednik dobiva još +1. Maksimum je 7 bodova: 3 za prvo mjesto, 1 pobjednički bonus i najviše 3 za eliminacije.</p><p>Eliminacijski bod dobiva igrač čija riječ ostane bez valjanog odgovora zbog „Ne znam”, isteka vremena ili <PojamPomoc tekst="mrtvih slova" opis="Tražena zadnja dva grafema nemaju nijednu dostupnu dopuštenu riječ: takva riječ ne postoji u rječniku ili su svi njezini oblici već potrošeni u ovoj partiji." id="mrtva-slova-bodovi" />. Prekid veze izvan poteza je samoeliminacija i ne daje bod nikome. Prekid na potezu može dati bod igraču koji je otvorio traženi nastavak.</p><p><strong>Dvoboj:</strong> pobjeda donosi 1 bod, poraz 0; plasman i eliminacije ne dodaju Dvoboju bodova.</p><p><strong>Privatna soba:</strong> pobjeda donosi 2 boda na ljestvici sobe. Vlasnik može uključiti +1 bod za svaku izazvanu eliminaciju; ta je postavka zadano uključena. Ti bodovi ne mijenjaju javni rezultat.</p><p class="primjer-izracuna"><strong>Primjer za Četveroboj:</strong> 2. mjesto (2 boda) + jedna izazvana eliminacija (1) = <strong>3 boda</strong>. Pobjednik s dvije eliminacije dobiva 3 + 2 + 1 = <strong>6 bodova</strong>.</p></section>
      <section><h3>Kako dobivaš rang?</h3><p>Rang dobivaš nakon <strong>10 završenih javnih partija u tom načinu igre</strong>. Do tada se prikazuje „Piskaralo”. Rang ovisi o prosjeku bodova, može rasti i padati, a Dvoboj i Četveroboj računaju se zasebno. U Dvoboju prosjek bodova jednak je udjelu pobjeda jer pobjeda vrijedi 1 bod, a poraz 0. Pragovi se primjenjuju na nezaokružene vrijednosti.</p><p>Obrub avatara prikazuje tvoj viši rang između dvaju javnih modova. Rang je vizualni status i ne daje prednost u igri niti utječe na uparivanje.</p><p>Ljestvice imaju dnevni, tjedni, mjesečni, godišnji i ukupni poredak, zasebno za svaki javni način. Za dnevnu treba 10 završenih javnih igara toga dana, a za ostale 20 igara unutar tog razdoblja.</p></section>
      <section>
        <h3>Rangovi u Četveroboju i Dvoboju</h3>
        <div class="tablica-omotac"><table class="tablica-mobilni-retci tablica-rangova">
          <thead><tr><th scope="col">Rang</th><th scope="col">Četveroboj · prosjek bodova</th><th scope="col">Dvoboj · udio pobjeda</th></tr></thead>
          <tbody>{#each RANGOVI as rang, indeks}
            <tr>
              <th scope="row"><span class="rang-uzorak" style:--boja-ranga={bojaBordera(rang.naziv)} aria-hidden="true"></span>{rang.naziv}</th>
              <td data-label="Četveroboj · prosjek bodova">{rasponRanga(indeks, RANGOVI)}</td>
              <td data-label="Dvoboj · udio pobjeda">{rasponRanga(indeks, RANGOVI_1V1, true)}</td>
            </tr>
          {/each}</tbody>
        </table></div>
      </section>
      <p class="poveznica"><a href="/ljestvice">Otvori ljestvice igrača →</a></p>
    </section>
  {:else if odabranaTema === 'napredak'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="napredak-naslov">
      <h2 id="napredak-naslov">Napredak</h2>
      <dl class="oznake-pojmova">
        <dt>Rang</dt><dd>Rezultati kroz prosjek bodova u određenom načinu igre.</dd>
        <dt>Razina / LVL</dt><dd>Ukupno prikupljeno iskustvo.</dd>
        <dt>Dostignuća</dt><dd>Ostvareni zadaci i njihove razine.</dd>
        <dt>Ocjena partije</dt><dd>Automatska ocjena završene partije, povezana s dodatnim XP-om.</dd>
        <dt><a href="/pravila-kaladonta?tema=dnk">Kaladont DNK</a></dt><dd>Šest obilježja tvog načina igranja; svako je detaljno objašnjeno u zasebnoj temi.</dd>
      </dl>
      <section><h3>XP i razine</h3><p>XP je dugoročni napredak odvojen od bodova i ranga. Dobivaš ga samo u normalno završenim javnim partijama; privatne partije ne daju XP. Maksimalna je razina 100, a nakon nje novi XP više ne podiže razinu.</p><div class="tablica-omotac"><table><thead><tr><th>Događaj</th><th>XP</th></tr></thead><tbody><tr><td>Prihvaćena riječ</td><td>5</td></tr><tr><td>Duga riječ (10–11 grafema)</td><td>+10</td></tr><tr><td>Srednje duga riječ (12–14 grafema)</td><td>+20</td></tr><tr><td>Jako duga riječ (15+ grafema)</td><td>+35</td></tr><tr><td>Rijetka riječ (frekvencija 10–99)</td><td>+15</td></tr><tr><td>Srednje rijetka riječ (1–9)</td><td>+30</td></tr><tr><td>Jako rijetka riječ (0, uz najmanje 4 grafema)</td><td>+50</td></tr><tr><td>Izazvana eliminacija</td><td>+25</td></tr><tr><td>Pobjeda</td><td>+50</td></tr><tr><td>Kaladont / kalodont</td><td>+100 umjesto uobičajene nagrade za tu riječ</td></tr></tbody></table></div><p>Duljinski i rijetkosni dodatak mogu se zbrojiti s osnovnih 5 XP za prihvaćenu riječ, a i međusobno. `Nj`, `lj` i `dž` računaju se kao jedan grafem. Dugi i rijetki oblici donose XP svaki put kada su prihvaćeni, ne samo pri prvom otključavanju u kolekciji. Dobrovoljni izlazak ili nepovratak nakon prekida veze poništava XP za tu partiju.</p></section>
      <section><h3>Niz prihvaćenih riječi tijekom partije</h3><p>Svaka uzastopna prihvaćena riječ povećava niz. Odbijena riječ vraća ga na nulu, ali sama po sebi ne izbacuje te iz partije. Najdulji niz u partiji množi osnovni XP zbroj:</p><div class="tablica-omotac"><table><thead><tr><th>Najdulji niz</th><th>XP-množitelj</th></tr></thead><tbody><tr><td>0–2 riječi</td><td>×1,00</td></tr><tr><td>3</td><td>×1,10</td></tr><tr><td>4</td><td>×1,25</td></tr><tr><td>5</td><td>×1,40</td></tr><tr><td>6</td><td>×1,60</td></tr><tr><td>7</td><td>×1,75</td></tr><tr><td>8</td><td>×1,90</td></tr><tr><td>9 ili više</td><td>×2,00</td></tr></tbody></table></div><p>Ovaj niz vrijedi unutar jedne partije i nije isto što i niz pobjeda kroz više partija.</p></section>
      <section><h3>Niz pobjeda i bonus XP</h3><p>Uzastopne javne pobjede povećavaju bonus na XP za osvojenu igru. Niz se vodi odvojeno za Četveroboj i Dvoboj; poraz ga prekida u tom modu. Privatne igre ne povećavaju niti prekidaju javni niz.</p><p>Bonus počinje drugom pobjedom. U Četveroboju raste za 10 postotnih bodova po pobjedi, a u Dvoboju za 5, do najviše +100%.</p><div class="tablica-omotac"><table class="tablica-mobilni-retci"><thead><tr><th scope="col">Uzastopne pobjede</th><th scope="col">Četveroboj</th><th scope="col">Dvoboj</th></tr></thead><tbody>
        {#each Array.from({ length: 21 }, (_, indeks) => indeks + 1) as pobjede}
          <tr><th scope="row">{pobjede === 21 ? '21 ili više' : pobjede}</th><td data-label="Četveroboj">+{Math.min(100, (pobjede - 1) * 10)}%</td><td data-label="Dvoboj">+{Math.min(100, (pobjede - 1) * 5)}%</td></tr>
        {/each}
      </tbody></table></div><p>Maksimalni bonus stiže na 11. uzastopnoj pobjedi u Četveroboju i na 21. u Dvoboju. Profil, red i završetak igre pokazuju trenutačni niz i bonus sljedeće pobjede.</p></section>
      <section><h3>Duge i rijetke riječi</h3><ul><li>Duga riječ ima 10–11, srednje duga 12–14, a jako duga 15 ili više grafema.</li><li>Rijetkost ovisi o učestalosti oblika u rječniku igre: 10–99 je rijetka, 1–9 srednje rijetka, a 0 jako rijetka; za posljednju treba imati najmanje 4 grafema.</li><li><strong>Nj, lj i dž</strong> računaju se kao jedan grafem.</li></ul></section>
      <section><h3>Dostignuća</h3><p>U profilu je 10 dostignuća s po pet razina, ukupno 50 zvjezdica. Pragovi su:</p><ul><li><strong>Iskusnjara:</strong> razine XP-a 10, 20, 40, 70, 100.</li><li><strong>Rijetkolovac:</strong> 1, 5, 15, 40, 100 rijetkih leksemskih grupa.</li><li><strong>Dugometraš:</strong> 1, 10, 30, 75, 150 dugih riječi.</li><li><strong>Jezik u plamenu:</strong> najdulji niz prihvaćenih riječi u partiji od 3, 5, 7, 10, 15.</li><li><strong>Kaladont!:</strong> 1, 3, 10, 25, 50 izvedenih Kaladonata.</li><li><strong>KA-zna:</strong> 1, 5, 15, 25, 50 ispadanja zbog Kaladonta.</li><li><strong>Lovac na glave:</strong> 1, 10, 30, 75, 150 izazvanih eliminacija.</li><li><strong>Slijepa ulica:</strong> 1, 5, 15, 40, 100 eliminacija izazvanih mrtvim slovima.</li><li><strong>Završna riječ:</strong> 1, 5, 20, 50, 100 javnih pobjeda.</li><li><strong>Glas zajednice:</strong> 1, 2, 3, 4, 5 poslanih povratnih informacija.</li></ul><p>U privatnoj sobi mogu napredovati i otključati se samo Rijetkolovac, Dugometraš i Jezik u plamenu. Zvjezdice dostignuća nisu isto što i ocjena partije.</p></section>
      <section><h3>Forma i vatra</h3><p>Forma se računa iz najviše zadnjih 10 javnih partija odabranog moda: u Dvoboju kao udio pobjeda, a u Četveroboju kao prosjek bodova. Naziv se prikazuje nakon 5 partija; nakon 10 koristi puni uzorak. S 20 partija posljednjih 10 može se usporediti s prethodnih 10 radi trenda. Pragovi za puni uzorak:</p><div class="tablica-omotac"><table class="tablica-mobilni-retci"><thead><tr><th scope="col">Forma</th><th scope="col">Udio pobjeda u Dvoboju</th><th scope="col">Prosjek bodova u Četveroboju</th></tr></thead><tbody>
        <tr><th scope="row">Loša</th><td data-label="Dvoboj · udio pobjeda">&lt;10%</td><td data-label="Četveroboj · prosjek bodova">&lt;0,75</td></tr>
        <tr><th scope="row">Slaba</th><td data-label="Dvoboj · udio pobjeda">10–&lt;20%</td><td data-label="Četveroboj · prosjek bodova">0,75–&lt;1,25</td></tr>
        <tr><th scope="row">Prolazna</th><td data-label="Dvoboj · udio pobjeda">20–&lt;30%</td><td data-label="Četveroboj · prosjek bodova">1,25–&lt;1,75</td></tr>
        <tr><th scope="row">Dobra</th><td data-label="Dvoboj · udio pobjeda">30–&lt;50%</td><td data-label="Četveroboj · prosjek bodova">1,75–&lt;2,50</td></tr>
        <tr><th scope="row">Odlična</th><td data-label="Dvoboj · udio pobjeda">50–&lt;70%</td><td data-label="Četveroboj · prosjek bodova">2,50–&lt;3,25</td></tr>
        <tr><th scope="row">Izvanredna</th><td data-label="Dvoboj · udio pobjeda">70–&lt;80%</td><td data-label="Četveroboj · prosjek bodova">3,25–&lt;4,00</td></tr>
        <tr><th scope="row">Sjajna</th><td data-label="Dvoboj · udio pobjeda">80–&lt;90%</td><td data-label="Četveroboj · prosjek bodova">4,00–&lt;5,00</td></tr>
        <tr><th scope="row">Top forma</th><td data-label="Dvoboj · udio pobjeda">≥90%</td><td data-label="Četveroboj · prosjek bodova">≥5,00</td></tr>
      </tbody></table></div><p>Vatra ovisi samo o trenutnom nizu pobjeda: u Četveroboju jedna/dvije/tri vatre počinju na 3/5/8 pobjeda, a u Dvoboju na 4/8/14. Forma i vatra nisu isto; ne donose dodatne bodove ni zaseban XP.</p></section>
      <section id="ocjena-partije"><h3>Ocjena partije</h3><p>Javna partija dobiva ocjenu od 0 do 5 zvjezdica ako imaš najmanje 3 prihvaćena poteza. Za svaku od šest osi Kaladont DNK-a izračuna se promjena vrijednosti (nakon minus prije), a zatim prosjek promjena. Osnovne zvjezdice su zaokruženi rezultat <code>(prosječna promjena + 20) / 10</code>, ograničen na 0–4. Pobjeda dodaje jednu zvjezdicu, a konačna ocjena ograničena je na 0–5. Privatna partija nema ocjenu.</p><p>Ocjena ne mijenja bodove ni rang. Njezina XP-nagrada iznosi: 0–1 zvjezdica +0%, 2 +5%, 3 +10%, 4 +15%, 5 +20%. Primjer: 200 osnovnih XP uz niz pobjeda +20% daje 240 XP; pet zvjezdica zatim dodaje 48 XP, ukupno 288 prije ograničenja razine 100.</p></section>
      <section><h3>Kaladont DNK</h3><p>DNK se otključava nakon 10 javnih igara u pojedinom modu, a Dvoboj i Četveroboj računaju se odvojeno. <a href="/pravila-kaladonta?tema=dnk">U temi Kaladont DNK</a> možeš vidjeti što mjeri svaka os i što utječe na njezin rast.</p></section>
    </section>
  {:else if odabranaTema === 'dnk'}
    <section id="sadrzaj-pomoci" class="sadrzaj dnk-pomoc" aria-labelledby="dnk-naslov">
      <h2 id="dnk-naslov">Kaladont DNK</h2>
      <p class="uvod">Kaladont DNK opisuje tvoj način igranja kroz šest brojčanih osi. Otključava se nakon 10 javnih igara u pojedinom modu; Dvoboj i Četveroboj imaju zaseban profil. Privatne igre ne ulaze u izračun.</p>
      <p>Vrijednosti se računaju iz rezultata i poteza, ne iz jedne odabrane riječi. Zato jedan potez ne mora odmah promijeniti prikaz, a viša vrijednost nije cilj po svaku cijenu: igra ostaje najprije igra.</p>
      <section aria-labelledby="dnk-vjestina">
        <h3 id="dnk-vjestina">Vještina</h3>
        <p><strong>Što mjeri:</strong> prosječne bodove po javnoj igri u tom modu.</p>
        <p><strong>Kako raste:</strong> skupljaj bodove prema pravilima moda. U Dvoboju pobjeda donosi bod; u Četveroboju rezultat ovisi o plasmanu, izazvanim eliminacijama i pobjedničkom bonusu. Stabilno uspješni rezultati kroz više partija najviše utječu na prosjek.</p>
      </section>
      <section aria-labelledby="dnk-taktika">
        <h3 id="dnk-taktika">Taktika</h3>
        <p><strong>Što mjeri:</strong> eliminacije koje su ti pripisane po javnoj igri.</p>
        <p><strong>Kako raste:</strong> traži prilike za valjane taktičke nastavke koji mogu izazvati eliminaciju. Klasičan primjer je Kaladont na „ka”; eliminacije se pripisuju prema pravilima moda i razloga ispadanja, pa nije svaki ispad bod za tebe.</p>
      </section>
      <section aria-labelledby="dnk-fokus">
        <h3 id="dnk-fokus">Fokus</h3>
        <p><strong>Što mjeri:</strong> najdulji niz uzastopno prihvaćenih riječi u jednoj partiji.</p>
        <p><strong>Kako raste:</strong> održavaj niz točnim, prihvaćenim potezima. Odbijena riječ prekida niz i vraća trenutačni niz na nulu; sama odbijena riječ ne izbacuje te iz partije.</p>
      </section>
      <section aria-labelledby="dnk-brzina">
        <h3 id="dnk-brzina">Brzina</h3>
        <p><strong>Što mjeri:</strong> prosječno vrijeme tvojih prihvaćenih poteza.</p>
        <p><strong>Kako raste:</strong> pronađi i pošalji valjan nastavak ranije. Mjeri se samo prihvaćeni potez; brzina ne vrijedi ako zbog žurbe češće šalješ nevaljane riječi.</p>
      </section>
      <section aria-labelledby="dnk-duge">
        <h3 id="dnk-duge">Duge riječi</h3>
        <p><strong>Što mjeri:</strong> prosjek prihvaćenih dugih riječi po javnoj igri. Duga riječ ima 10–11 grafema, srednje duga 12–14, a jako duga 15 ili više. Dulji razredi više doprinose osi: duga vrijedi 1, srednje duga 1,5, a jako duga 2.</p>
        <p><strong>Kako raste:</strong> kada odgovara traženim grafemima i dopuštenim pravilima, odaberi dužu valjanu riječ. `Nj`, `lj` i `dž` računaju se kao po jedan grafem.</p>
      </section>
      <section aria-labelledby="dnk-rijetke">
        <h3 id="dnk-rijetke">Rijetke riječi</h3>
        <p><strong>Što mjeri:</strong> prosjek prihvaćenih rijetkih riječi po javnoj igri prema učestalosti oblika u rječniku. Rijetka ima frekvenciju 10–99, srednje rijetka 1–9, a jako rijetka 0; jako rijetka riječ mora imati najmanje 4 grafema. Rjeđi razredi više doprinose osi: rijetka vrijedi 1, srednje rijetka 1,5, a jako rijetka 2.</p>
        <p><strong>Kako raste:</strong> pronađi riječ koja odgovara traženim grafemima, još nije potrošena u partiji i ima nižu frekvenciju. Sama rijetkost ne čini riječ valjanom ako ne zadovoljava ostala pravila.</p>
      </section>
      <p class="poveznica"><a href="/profil">Otvori profil i pogledaj svoje osi →</a></p>
    </section>
  {:else if odabranaTema === 'pristupacnost'}
    <section id="sadrzaj-pomoci" class="sadrzaj pristupacnost" aria-labelledby="pristupacnost-naslov">
      <h2 id="pristupacnost-naslov">Pristupačnost</h2>
      <p class="uvod">Postavke čitanja i izgleda možeš prilagoditi svojim potrebama. Promjene su osobne i ne utječu na druge igrače.</p>

      <section id="upute-opcenito" aria-labelledby="citanje-naslov">
        <h3 id="citanje-naslov">Što radi čitanje naglas?</h3>
        <p>Uključi „Čitanje naglas” u <a href="/postavke">Postavkama</a>. Tijekom partije Kaladont zatraži od preglednika da izgovori novu riječ hrvatskim jezikom (`hr-HR`). Ta je mogućnost namijenjena riječima u igri: ne čita gumbe, upute ni sav tekst na zaslonu. Nije zamjena za čitač zaslona kao što su VoiceOver, TalkBack, Narrator ili Orca.</p>
        <p>Izgovor ovisi o tome podržava li preglednik govornu sintezu i koje glasove izlaže. Preglednik može koristiti glasove uređaja, ali web-stranica ne može pouzdano pročitati stvarni jezik operacijskog sustava niti dodati glas umjesto tebe. Ako uređaj ili preglednik koristi engleski glas, hrvatske riječi mogu zvučati pogrešno. Obavijest u aplikaciji prikazuje prijavljeni jezik preglednika i glasove koje preglednik trenutačno izlaže.</p>
        <p>Ako hrvatskog glasa nema, pokušaj ga dodati u postavkama govora uređaja, zatim ponovno učitaj Kaladont. Nazivi izbornika mogu se razlikovati prema verziji sustava, jeziku i proizvođaču.</p>
      </section>

      <section id="upute-android" aria-labelledby="android-naslov">
        <h3 id="android-naslov">Android</h3>
        <ol>
          <li>Otvori <strong>Postavke → Pristupačnost → Izlaz pretvaranja teksta u govor</strong> (naziv može varirati).</li>
          <li>Odaberi mehanizam za pretvaranje teksta u govor, jezik i glas. Ako je ponuđen hrvatski, preuzmi glasovne podatke i postavi hrvatski kao jezik govora.</li>
          <li>Vrati se u Kaladont i ponovno učitaj stranicu pa provjeri prijavljene glasove u obavijesti.</li>
        </ol>
        <p>Put i dostupnost ovise o proizvođaču i odabranom TTS mehanizmu. <a href="https://support.google.com/accessibility/android/answer/6006983?hl=hr" target="_blank" rel="noreferrer">Googleove upute za izlaz pretvaranja teksta u govor na Androidu</a>.</p>
      </section>

      <section id="upute-ios" aria-labelledby="ios-naslov">
        <h3 id="ios-naslov">iPhone i iPad</h3>
        <ol>
          <li>Otvori <strong>Postavke → Pristupačnost → Pročitani sadržaj</strong> ili <strong>Read &amp; Speak</strong>, ovisno o jeziku sustava i verziji iOS-a/iPadOS-a.</li>
          <li>U odjeljku glasova odaberi hrvatski glas i preuzmi ga ako je ponuđen. Provjeri i zadani jezik govora.</li>
          <li>Ponovno učitaj Kaladont. Dostupnost tog glasa u pregledniku može se razlikovati od dostupnosti u Appleovim značajkama čitanja zaslona.</li>
        </ol>
        <p><a href="https://support.apple.com/guide/iphone/hear-whats-on-screen-or-typed-iph96b214f0/ios" target="_blank" rel="noreferrer">Appleove upute za govorni sadržaj na iPhoneu</a>.</p>
      </section>

      <section id="upute-windows" aria-labelledby="windows-naslov">
        <h3 id="windows-naslov">Windows</h3>
        <ol>
          <li>Pritisni <kbd>Windows + Ctrl + N</kbd> za postavke Pripovjedača (Narrator).</li>
          <li>U odjeljku glasa odaberi <strong>Dodaj naslijeđene glasove</strong>, zatim u postavkama govora otvori <strong>Upravljanje glasovima → Dodaj glasove</strong>.</li>
          <li>Odaberi hrvatski i pričekaj preuzimanje. Po potrebi odaberi ga kao glas Pripovjedača, a zatim ponovno učitaj Kaladont.</li>
        </ol>
        <p>Instalirani glas Pripovjedača ne jamči da će ga svaki preglednik izložiti web-stranicama. <a href="https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices" target="_blank" rel="noreferrer">Microsoftove upute za podržane Windows glasove i dodavanje TTS glasa</a>.</p>
      </section>

      <section id="upute-macos" aria-labelledby="macos-naslov">
        <h3 id="macos-naslov">Mac</h3>
        <ol>
          <li>Otvori <strong>System Settings → Accessibility → Read &amp; Speak</strong>.</li>
          <li>Uz <strong>System voice</strong> otvori popis glasova, pronađi hrvatski i preuzmi ga ako je ponuđen. Provjeri i <strong>System speech language</strong>.</li>
          <li>Nakon preuzimanja ponovno učitaj Kaladont i provjeri glasove prikazane u obavijesti.</li>
        </ol>
        <p><a href="https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac" target="_blank" rel="noreferrer">Appleove upute za promjenu glasa koji govori tekst na Macu</a>.</p>
      </section>

      <section id="upute-linux" aria-labelledby="linux-naslov">
        <h3 id="linux-naslov">Linux</h3>
        <p>Linux nema jedinstveno mjesto za upravljanje glasovima. Dostupnost ovisi o distribuciji, radnom okruženju, pregledniku i instaliranom TTS mehanizmu.</p>
        <ol>
          <li>Najprije provjeri popis glasova u Kaladontovoj obavijesti. Ako je na njemu hrvatski glas, ne trebaš mijenjati sistemske postavke.</li>
          <li>Ako ga nema, u upravitelju programa ili dokumentaciji distribucije potraži govorni mehanizam i hrvatski glasovni paket; neke Linux okoline koriste eSpeak NG ili Speech Dispatcher, no podrška ovisi o distribuciji i pregledniku.</li>
          <li>Nakon instalacije ponovno pokreni preglednik i provjeri izlaže li hrvatski glas web-stranicama.</li>
        </ol>
        <p>Orca je GNOME-ov čitač zaslona i nije isto što i glas koji preglednik izlaže Kaladontu. <a href="https://help.gnome.org/gnome-help/a11y-screen-reader.html" target="_blank" rel="noreferrer">GNOMEove upute za čitanje zaslona pomoću Orca čitača</a>.</p>
      </section>

      <section id="disleksija" aria-labelledby="disleksija-naslov">
        <h3 id="disleksija-naslov">Disleksija i igra riječima</h3>
        <p>Disleksija je specifična teškoća učenja koja najčešće utječe na čitanje, pisanje i pravopis. Ne govori ništa o nečijoj inteligenciji, a iskustvo i potrebe razlikuju se od osobe do osobe. <a href="https://www.nhs.uk/conditions/dyslexia-in-children/" target="_blank" rel="noreferrer">NHS-ov pregled disleksije u djece</a>.</p>
        <p>Kaladont je igra aktivnog povezivanja riječi: igrač prepoznaje grafeme, prisjeća se riječi i smišlja nastavak, umjesto da samo čita gotov tekst. Takva jezična igra može biti zanimljiv način sudjelovanja i vježbe, a čitanje naglas nekim igračima pruža dodatni slušni oslonac. Font za disleksiju omogućuje isprobati drukčiji izgled teksta. To su mogućnosti za uključiviju igru, a ne dokaz da igra poboljšava čitanje ili ublažava teškoće.</p>
        <p>Djeca mogu igrati uz podršku odrasle osobe i odabrati ono što im odgovara. U privatnoj sobi domaćin može isključiti mjerač vremena. Kaladont nije zamjena za sustavnu poduku ili podršku učitelja, logopeda i stručnjaka za čitanje.</p>
        <p>Postavke fonta, čitanja naglas i izgleda nalaze se u <a href="/postavke">Postavkama</a>.</p>
      </section>
    </section>
  {:else}
    <section id="sadrzaj-pomoci" class="sadrzaj faq" aria-labelledby="pitanja-naslov">
      <h2 id="pitanja-naslov">Pitanja i problemi</h2>
      <details><summary>Zašto moja riječ nije prihvaćena?</summary><p>Provjeri tražena slova, dijakritike, dopuštenu vrstu riječi i je li riječ ili njezin oblik već potrošen. Pokušaj drugu riječ dok vrijeme još traje.</p></details>
      <details><summary>Zašto je drugi oblik iste riječi već iskorišten?</summary><p>Povezani oblici troše se zajedno do kraja cijele partije. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></details>
      <details><summary>Zašto sam odmah ispao?</summary><p>„Ne znam” znači ispadanje. Ispadaš i kada vrijeme istekne, ostanu <PojamPomoc tekst="mrtva slova" opis="Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi." id="mrtva-slova-faq" />, protivnik izvede Kaladont na tvoje „ka” ili se ne vratiš nakon prekida veze.</p></details>
      <details><summary>Zašto više nemam niz bez pogreške?</summary><p>Svaka odbijena riječ prekida tvoj trenutni niz, iako te sama pogreška ne izbacuje iz partije.</p></details>
      <details><summary>Zašto sam još Piskaralo?</summary><p>Rang se dodjeljuje nakon 10 završenih javnih partija u pojedinom načinu igre. Dvoboj i Četveroboj računaju se zasebno.</p></details>
      <details><summary>Zašto nisam na ljestvici?</summary><p>Za dnevnu ljestvicu trebaš završiti najmanje 10 javnih igara toga dana, a za tjednu, mjesečnu, godišnju i ukupnu najmanje 20 igara unutar tog razdoblja, u odabranom načinu. Na stranici ljestvica uz svako razdoblje piše koliko ti igara još nedostaje. Igra pripada danu u kojem je završila, po hrvatskom vremenu.</p></details>
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
  .teme a { flex: 0 0 auto; padding: 9px 14px; border: 1px solid var(--boja-obrub); border-radius: var(--radijus-pill); background: var(--boja-povrsina-2); color: var(--boja-tekst-osnovni); font: inherit; font-size: var(--tekst-sitni); font-weight: 700; text-decoration: none; }
  .teme a.aktivna { border-color: var(--boja-cta-pozadina); background: var(--boja-cta-pozadina); color: var(--boja-cta-tekst); }
  #sadrzaj-pomoci { scroll-margin-top: 16px; outline: none; }
  .sadrzaj { padding: 22px 0; }
  .sadrzaj h2 { margin: 0 0 18px; font-size: var(--naslov-2); }
  .sadrzaj > section { padding: 18px 0; border-top: 1px solid var(--boja-obrub); }
  h3 { margin: 0 0 8px; font-size: var(--naslov-3); }
  p, li, td, th { line-height: 1.6; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li + li { margin-top: 7px; }
  a { color: var(--boja-pozadina-primarna); font-weight: 700; }
  .poveznica { margin-top: 24px; }
  .koraci { margin-top: 20px; }
  .tablica-omotac { margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; background: var(--boja-povrsina); }
  th, td { padding: 11px 12px; border-bottom: 1px solid var(--boja-obrub); text-align: left; vertical-align: top; }
  th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .usporedba-modova table { min-width: 700px; }
  .rang-uzorak { display: inline-block; width: 16px; height: 16px; margin-right: 12px; border: 4px solid var(--boja-ranga); border-radius: 50%; vertical-align: middle; }
  .tablica-rangova tbody th { color: var(--boja-tekst-osnovni); }
  .napomena, .primjer-izracuna { padding: 14px 16px; border-left: 4px solid var(--boja-isticanje-tekst); background: var(--boja-povrsina-2); color: var(--boja-tekst-osnovni); }
  .jezicne-iznimke, .faq details { padding: 14px 0; border-bottom: 1px solid var(--boja-obrub); }
  .jezicne-iznimke { border-top: 1px solid var(--boja-obrub); }
  summary { cursor: pointer; font-weight: 700; }
  details p { margin: 10px 0 0; color: var(--boja-tekst-sekundarni); }
  .oznake-pojmova { display: grid; grid-template-columns: minmax(120px, 180px) minmax(0, 1fr); margin: 20px 0; background: var(--boja-povrsina); }
  .oznake-pojmova dt, .oznake-pojmova dd { margin: 0; padding: 11px 12px; border-bottom: 1px solid var(--boja-obrub); overflow-wrap: anywhere; }
  .oznake-pojmova dt { color: var(--boja-tekst-naslov); font-weight: 700; }
  @media (max-width: 999px) {
    .pomoc { padding-top: 24px; }
    .teme a { flex: 1 1 calc(50% - 4px); text-align: center; }
    .oznake-pojmova { grid-template-columns: minmax(0, 1fr); }
    .oznake-pojmova dt { padding-bottom: 3px; border: 0; }
    .oznake-pojmova dd { padding-top: 3px; }
    .usporedba-modova table { min-width: 0; }
    .tablica-mobilni-retci tbody th, .tablica-mobilni-retci tbody td { border-bottom: 0; padding: 5px 0; }
    .tablica-mobilni-retci tbody th { display: block; width: auto; font-size: var(--tekst-baza); }
  }
</style>