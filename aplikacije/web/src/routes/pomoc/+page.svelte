<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { RANGOVI, RANGOVI_1V1 } from 'zajednicko';

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
      <p class="uvod">Za prvu partiju trebaš znati samo ovo: ostani posljednji igrač i na svom potezu dovrši riječ koja počinje prikazanim slovima.</p>
      <ol class="koraci">
        <li><strong>Odaberi igru.</strong> U javnoj igri možeš birati dva ili četiri igrača, a možeš igrati i kao gost.</li>
        <li><strong>Pričekaj početnu riječ.</strong> Sustav je odabire na početku svake runde.</li>
        <li><strong>Smisli nastavak.</strong> U javnoj partiji imaš 30 sekundi po potezu.</li>
        <li><strong>Dopiši samo ostatak riječi.</strong> Početna slova već su u polju. Pritisni <strong>Pošalji</strong> ili Enter.</li>
        <li><strong>Ako riječ ne prođe, pokušaj ponovno.</strong> Ne ispadaš odmah, ali vrijeme nastavlja teći.</li>
        <li><strong>„Ne znam” znači ispadanje.</strong> Nakon toga možeš promatrati ostatak partije.</li>
      </ol>
      <aside class="napomena"><strong>Pazi na „ka”.</strong> Ako protivniku ostaviš „ka”, može odigrati „kaladont” i izbaciti te iz partije.</aside>
      <section aria-labelledby="pravila-naslov">
        <h2 id="pravila-naslov">Pravila igre</h2>
        <section><h3>Kako povezujemo riječi</h3><p>Nova riječ mora početi na posljednja dva grafema prethodne riječi. Primjer: <strong>sova → vaza → zabava</strong>.</p><p><strong>Nj, lj i dž</strong> računaju se kao jedno slovo. Zato nakon „konj” tražimo <strong>onj</strong>: slovo o i grafem nj.</p></section>
        <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim slovima i pripadati dopuštenoj vrsti riječi.</p><ul><li>Dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Vlastita imena, kratice, brojke, crtice i razmaci nisu u igri.</li></ul></section>
        <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije</strong>. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></section>
        <section><h3>Kaladont efekt i ispadanje</h3><p>Kada igrač ostavi „ka”, protivnik može odigrati „kaladont” i izbaciti igrača koji mu je omogućio taj potez. Ispadaš i kada odabereš „Ne znam”, istekne vrijeme, ostanu mrtva slova ili se ne vratiš nakon prekida veze.</p></section>
      </section>
      <p class="poveznica">Spreman? <a href="/">Odaberi način igre →</a></p>
    </section>
  {:else if odabranaTema === 'pravila'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="pravila-naslov">
      <h2 id="pravila-naslov">Pravila</h2>
      <section><h3>Kako povezujemo riječi</h3><p>Nova riječ mora početi na posljednja dva grafema prethodne riječi. Primjer: <strong>sova → vaza → zabava</strong>.</p><p><strong>Nj, lj i dž</strong> računaju se kao jedno slovo. Zato nakon „konj” tražimo <strong>onj</strong>: slovo o i grafem nj.</p></section>
      <section><h3>Koje riječi prihvaća igra?</h3><p>Riječ mora postojati <strong>u rječniku igre</strong>, početi traženim slovima i pripadati dopuštenoj vrsti riječi. Rječnik sadrži različite vrste riječi u njihovim oblicima.</p><ul><li>Dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li><li>Vlastita imena, kratice, brojke, crtice i razmaci nisu u igri.</li></ul></section>
      <section><h3>Oblici iste riječi</h3><p>Jednom odigrana riječ i svi njezini povezani oblici potrošeni su <strong>do kraja cijele partije, uključujući nove runde</strong>. Dobar, dobra, dobro — ista ekipa u drugoj majici. Nakon jednog oblika ostali više ne prolaze.</p><p>Stručnije: odigrani oblik troši sve svoje leksemske grupe. „Bolji” i „najbolji” mogu pripadati zasebnim grupama. „Kaladont” i „kalodont” posebne su riječi i mogu se ponoviti.</p></section>
      <section><h3>Kaladont efekt</h3><p>Ana odigra „jabuka” i ostavi <strong>ka</strong>. Boris odgovori „kaladont”. <strong>Ana ispada</strong>, a sustav otvara novu rundu. Ne ispada igrač koji je sljedeći na redu.</p><ul><li>Ako je „ka” ostavila početna riječ sustava, nitko ne ispada i nitko ne dobiva bod za eliminaciju.</li><li>U javnoj igri za četiri igrača izvođač dobiva bod za eliminaciju. U dvoboju vrijedi fiksno bodovanje pobjede, a u privatnoj sobi bod ovisi o postavci eliminacija.</li></ul></section>
      <section><h3>Mrtva slova</h3><p>Mrtva slova su traženi nastavak za koji više nema dopuštene riječi. To se može dogoditi zato što nastavka nema u rječniku igre ili zato što su sve dostupne riječi na taj nastavak već potrošene.</p></section>
      <section><h3>Kada ispadaš?</h3><ul><li>odabereš <strong>Ne znam</strong> — to nije preskakanje poteza;</li><li>istekne vrijeme prije valjane riječi;</li><li>prethodni igrač ostavi mrtva slova;</li><li>protivnik izvede Kaladont na „ka” koje si mu ostavio;</li><li>ne vratiš se nakon prekida veze u roku od 10 sekundi.</li></ul><p>Odbijena riječ ne izbacuje te odmah. Probaj drugu riječ, ali sat nema razumijevanja.</p></section>
      <details class="jezicne-iznimke"><summary>Jezične iznimke i grafemi</summary><p>Kod većine riječi nj, lj i dž čitamo kao jedan grafem. Iznimke se vode u rječniku igre: primjerice, „injekcija” počinje grafemima i-n, a ne i-nj. Server uvijek provjerava konačni potez.</p></details>
    </section>
  {:else if odabranaTema === 'nacini'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="nacini-naslov">
      <h2 id="nacini-naslov">Načini igre</h2>
      <p class="uvod">Pravila riječi ista su svugdje. Razlikuju se broj igrača, napredak i tko odlučuje o postavkama.</p>
      <div class="tablica-omotac usporedba-modova"><table><thead><tr><th></th><th>4 igrača</th><th>2 igrača</th><th>Privatna soba</th></tr></thead><tbody><tr><th>S kim igraš?</th><td>Igrači iz čekaonice</td><td>Protivnik iz čekaonice</td><td>Ekipa kojoj pošalješ link</td></tr><tr><th>Broj igrača</th><td>4</td><td>2</td><td>2–8</td></tr><tr><th>Vrijeme poteza</th><td>30 sekundi</td><td>30 sekundi</td><td>15, 30 ili 60 sekundi, ili bez tajmera</td></tr><tr><th>Javni rang</th><td>Da, za četiri igrača</td><td>Da, zaseban za dvoboj</td><td>Ne</td></tr><tr><th>XP</th><td>Da</td><td>Da</td><td>Ne</td></tr><tr><th>Bodovi sobe</th><td>—</td><td>—</td><td>Privremena ljestvica sobe</td></tr></tbody></table></div>
      <section><h3>Igra s prijateljima</h3><p><strong>Stvori sobu → odaberi postavke → kopiraj pozivni link → pošalji ga ekipi → vlasnik pokreće igru.</strong></p><p>Vlasnik bira trajanje poteza, dopuštene vrste riječi i dodjeljuju li se bodovi za eliminacije. Rezultati ostaju na privremenoj ljestvici dok je soba aktivna.</p><p class="poveznica"><a href="/soba/kreiraj">Stvori privatnu sobu →</a></p></section>
      <section><h3>Što napreduje u privatnoj sobi?</h3><p>Privatna igra ne mijenja javni rang, javne bodove, XP ni Kaladont DNK. Napredovati mogu jezična dostignuća <strong>Rijetkolovac</strong>, <strong>Dugometraš</strong> i <strong>Jezik u plamenu</strong>.</p></section>
    </section>
  {:else if odabranaTema === 'bodovi'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="bodovi-naslov">
      <h2 id="bodovi-naslov">Bodovi i rangovi</h2>
      <section><h3>Kako dobivaš bodove?</h3><ul><li><strong>Četiri igrača:</strong> plasman donosi 3, 2, 1 ili 0 bodova; svaka izazvana eliminacija +1; pobjeda još +1.</li><li><strong>Dvoboj:</strong> pobjeda donosi 1 bod, poraz 0.</li><li><strong>Privatna soba:</strong> pobjeda donosi 2 boda na ljestvici sobe, uz opcionalni +1 za eliminaciju.</li></ul><p class="primjer-izracuna"><strong>Primjer:</strong> drugo mjesto (2) + jedna eliminacija (1) = <strong>3 boda</strong>.</p></section>
      <section><h3>Kako dobivaš rang?</h3><p>Rang dobivaš nakon <strong>10 završenih javnih partija u tom načinu igre</strong>. Do tada se prikazuje „Piskaralo”. Rang ovisi o prosjeku bodova, može rasti i padati, a za dva i četiri igrača računa se zasebno.</p><p>Obrub avatara prikazuje tvoj rang. To je vizualni status i ne daje prednost u igri.</p></section>
      <section><h3>Rangovi za četiri igrača</h3><div class="tablica-omotac"><table><thead><tr><th>Rang</th><th>Prosjek bodova</th></tr></thead><tbody>{#each RANGOVI as rang, indeks}<tr><td>{rang.naziv}</td><td>{rasponRanga(indeks, RANGOVI)}</td></tr>{/each}</tbody></table></div></section>
      <section><h3>Rangovi za dvoboj</h3><div class="tablica-omotac"><table><thead><tr><th>Rang</th><th>Prosjek pobjeda</th></tr></thead><tbody>{#each RANGOVI_1V1 as rang, indeks}<tr><td>{rang.naziv}</td><td>{rasponRanga(indeks, RANGOVI_1V1)}</td></tr>{/each}</tbody></table></div></section>
      <p class="poveznica"><a href="/ljestvica">Otvori ljestvicu igrača →</a></p>
    </section>
  {:else if odabranaTema === 'napredak'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="napredak-naslov">
      <h2 id="napredak-naslov">Napredak</h2>
      <div class="tablica-omotac oznake-tablica"><table><tbody><tr><th>Rang</th><td>Rezultati kroz prosjek bodova u određenom načinu igre.</td></tr><tr><th>Razina / LVL</th><td>Ukupno prikupljeno iskustvo.</td></tr><tr><th>Dostignuća</th><td>Ostvareni zadaci i njihove razine.</td></tr><tr><th>Ocjena partije</th><td>Automatska ocjena završene partije, povezana s dodatnim XP-om.</td></tr><tr><th>Kaladont DNK</th><td>Šest obilježja tvog načina igranja.</td></tr></tbody></table></div>
      <section><h3>XP i razina</h3><p>XP dobivaš u javnim partijama za prihvaćene poteze, pobjede, eliminacije te duge i rijetke riječi. Nakon partije vidiš cijeli obračun i napredak prema sljedećoj razini. Privatne sobe ne dodjeljuju XP.</p></section>
      <section><h3>Niz bez pogreške</h3><p>Niz bez pogreške (streak) broji tvoje uzastopne prihvaćene poteze. Odbijena riječ prekida niz, ali ne izbacuje te iz partije. Dulji najbolji niz u partiji povećava osvojeni XP.</p></section>
      <section><h3>Duge i rijetke riječi</h3><ul><li>Duge riječi imaju 10–11, srednje duge 12–14, a jako duge 15 ili više grafema.</li><li>Rijetkost ovisi o učestalosti riječi u rječniku igre.</li><li><strong>Nj, lj i dž</strong> računaju se kao jedan grafem.</li></ul></section>
      <section><h3>Dostignuća</h3><p>Dostignuća imaju više razina. Njihove zvjezdice pokazuju koliko si razina dostignuća otključao — nisu isto što i zvjezdice ocjene partije.</p></section>
      <section id="ocjena-partije"><h3>Ocjena partije</h3><p>Nakon javne partije igra automatski dodjeljuje od nula do pet zvjezdica prema promjeni tvojih Kaladont DNK vrijednosti i pobjedi. Viša ocjena donosi veći postotni dodatak na XP te partije. Ocjena ne mijenja bodove ni rang.</p></section>
      <section id="dnk"><h3>Kaladont DNK</h3><p>Nakon 10 javnih partija u odabranom načinu otključavaš profil svog stila igre. Uzorak sline nije potreban. DNK za dva i četiri igrača računa se zasebno.</p><div class="dnk-osi"><p><strong>Vještina</strong><span>Prati prosjek bodova. Više znači uspješnije rezultate.</span></p><p><strong>Taktika</strong><span>Prati izazvane eliminacije po partiji.</span></p><p><strong>Fokus</strong><span>Prati najduži niz prihvaćenih riječi bez pogreške.</span></p><p><strong>Brzina</strong><span>Prati prosječno vrijeme prihvaćenog poteza. Brži odgovori podižu vrijednost.</span></p><p><strong>Duge riječi</strong><span>Prati koliko često biraš duge riječi u odnosu na broj partija.</span></p><p><strong>Rijetke riječi</strong><span>Prati koliko često pronalaziš riječi male učestalosti.</span></p></div><p class="poveznica"><a href="/profil">Otvori svoj profil i Kaladont DNK →</a></p></section>
    </section>
  {:else}
    <section id="sadrzaj-pomoci" class="sadrzaj faq" aria-labelledby="pitanja-naslov">
      <h2 id="pitanja-naslov">Pitanja i problemi</h2>
      <details><summary>Zašto moja riječ nije prihvaćena?</summary><p>Provjeri tražena slova, dijakritike, dopuštenu vrstu riječi i je li riječ ili njezin oblik već potrošen. Pokušaj drugu riječ dok vrijeme još traje.</p></details>
      <details><summary>Zašto je drugi oblik iste riječi već iskorišten?</summary><p>Povezani oblici troše se zajedno do kraja cijele partije. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”.</p></details>
      <details><summary>Zašto sam odmah ispao?</summary><p>„Ne znam” znači ispadanje. Ispadaš i kada vrijeme istekne, ostanu mrtva slova, protivnik izvede Kaladont na tvoje „ka” ili se ne vratiš nakon prekida veze.</p></details>
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