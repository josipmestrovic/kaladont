<script lang="ts">
  import { page } from '$app/stores';
  import { RANGOVI, RANGOVI_1V1 } from 'zajednicko';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';
  import { bojaBordera } from '$lib/avatari.js';

  type Tema = 'kako-igrati' | 'pravila' | 'nacini' | 'bodovi' | 'napredak' | 'dnk' | 'pitanja' | 'pristupacnost';
  const teme: { id: Tema; naziv: string }[] = [
    { id: 'kako-igrati', naziv: 'O igri' },
    { id: 'nacini', naziv: 'Kako sve možeš igrati?' },
    { id: 'bodovi', naziv: 'Bodovi i rangovi' },
    { id: 'napredak', naziv: 'Iskustvo' },
    { id: 'dnk', naziv: 'Kaladont DNK' },
    { id: 'pristupacnost', naziv: 'Pristupačnost' },
    { id: 'pitanja', naziv: 'Pitanja i problemi' },
  ];

  const odabranaTema = $derived.by(() => {
    const trazena = $page.url.searchParams.get('tema');
    if (trazena === 'pravila') return 'pravila';
    return teme.some((tema) => tema.id === trazena) ? (trazena as Tema) : 'kako-igrati';
  });

  const seoNaslovi: Record<Tema, string> = {
    'kako-igrati': 'O igri - Kaladont',
    nacini: 'Kako sve možeš igrati? - Kaladont',
    bodovi: 'Bodovi i rangovi u Kaladontu',
    napredak: 'Iskustvo u Kaladontu',
    dnk: 'Kaladont DNK - što mjeri i kako ga razvijati',
    pitanja: 'Pitanja i problemi - Kaladont',
    pravila: 'O igri - Kaladont',
    pristupacnost: 'Pristupačnost i čitanje naglas - Kaladont',
  };

  const seoOpisi: Record<Tema, string> = {
    'kako-igrati': 'Saznaj kako se igra Kaladont online, kako povezati riječi i kada igrač ispada.',
    nacini: 'Usporedi načine igre: Dvoboj, Četveroboj, Zagrijavanje i privatne sobe.',
    bodovi: 'Saznaj kako funkcioniraju bodovi, pobjede, rangovi i ljestvice u Kaladontu.',
    napredak: 'Saznaj kako se dobiva iskustvo i kako se množi u Kaladontu.',
    dnk: 'Saznaj što mjeri šest osi Kaladont DNK-a i kako načinom igre utječeš na njih.',
    pitanja: 'Odgovori na najčešća pitanja o riječima, čitanju, disleksiji, rangu i Kaladontu.',
    pravila: 'Saznaj osnovna pravila igre Kaladont i kako se povezuju riječi.',
    pristupacnost: 'Font za disleksiju, čitanje naglas i igra bez tajmera.',
  };

  function rasponRanga(indeks: number, rangovi: readonly { minimalniProsjek: number }[]): string {
    const formatiraj = (prag: number) => prag.toFixed(2).replace('.', ',');
    if (indeks === 0) return `< ${formatiraj(rangovi[1]!.minimalniProsjek)}`;
    if (indeks === rangovi.length - 1) return `> ${formatiraj(rangovi[indeks]!.minimalniProsjek)}`;
    return `${formatiraj(rangovi[indeks]!.minimalniProsjek)} - ${formatiraj(rangovi[indeks + 1]!.minimalniProsjek)}`;
  }

  const opisMrtvihSlova = 'Zadnja dva slova nemaju nijednu slobodnu riječ: ili je nema u rječniku, ili su svi oblici već odigrani u ovoj igri.';

  const aktivnaTemaId = $derived(odabranaTema === 'pravila' ? 'kako-igrati' : odabranaTema);
  const naslovPovezanih = $derived(
    aktivnaTemaId === 'kako-igrati' ? 'Saznaj više o' : 'Možda će te zanimati i ovo',
  );
</script>

<svelte:head>
  <title>{seoNaslovi[odabranaTema]}</title>
  <meta name="description" content={seoOpisi[odabranaTema]} />
</svelte:head>

<main class="pomoc">
  <header class="zaglavlje">
    <p class="nadnaslov">Vodič kroz Kaladont</p>
    <h1>Pravila Kaladonta</h1>
  </header>

  <nav class="teme" aria-label="Teme pomoći">
    {#each teme as tema}
      <a
        href={`/pravila-kaladonta?tema=${tema.id}`}
        class:aktivna={odabranaTema === tema.id || (tema.id === 'kako-igrati' && odabranaTema === 'pravila')}
        aria-current={odabranaTema === tema.id || (tema.id === 'kako-igrati' && odabranaTema === 'pravila') ? 'page' : undefined}
      >{tema.naziv}</a>
    {/each}
  </nav>

  {#if odabranaTema === 'kako-igrati' || odabranaTema === 'pravila'}
    <section id="sadrzaj-pomoci" class="sadrzaj pregled-igre" aria-labelledby={odabranaTema === 'pravila' ? 'pravila-naslov' : 'kako-igrati-naslov'}>
      <h2 id={odabranaTema === 'pravila' ? 'pravila-naslov' : 'kako-igrati-naslov'}>O igri</h2>
      <p class="uvod" style="margin-bottom:24px;">Natječi se s drugima, penji se rangovima i ljestvicama, skupljaj riječi u kolekciju i otključavaj dostignuća!
      I paralelno razvijaš svoje vještine jezika i širiš vokabular.</p>

      <section>
        <h3>Što je Kaladont?</h3>
        <p>
          Nekad pasta za zube. Danas igra: reci riječ na zadnja dva slova prethodne.
          Riječ <strong>kaladont</strong> (prihvaćamo i kalodont) završava na <strong>nt</strong>, a nijedna hrvatska riječ
          ne počinje tim slovima.
        </p>
        <p>Cilj je jednostavan: ostani zadnji za stolom. Ostali ispadaju, ti slavodobitno skupljaš bodove, penješ se na ljestvicama i otključavaš dostignuća.</p>
      </section>

      <section>
        <h3>Kako se igra</h3>
        <ul>
          <li>svaka riječ počinje zadnjim <strong>dvama slovima</strong> prethodne (npr. sova → vaza)</li>
          <li>u javnoj igri imaš <strong>30 sekundi</strong> po potezu</li>
          <li>kriva riječ ne izbacuje, samo pokušaj opet</li>
          <li>„Ne znam” je predaja: ispadaš i gledaš dalje ili možeš izaći i sve će ti se spremiti</li>
          <li><strong>lj, nj, dž</strong> broje se kao jedno slovo (konj → onj)</li>
          <li>kvačice su bitne! Jer č nije c, š nije s, ć nije c…</li>
        </ul>
      </section>

      <section>
        <h3>Pametan sustav riječi</h3>
        <p>
          Igra ne gleda samo točno slovo po slovo. Kad netko kaže <strong>kuća</strong>,
          potrošena je cijela „obitelj” pa <strong>kućom</strong> više ne prolazi.
        </p>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci tablica-bez-oznaka">
            <thead>
              <tr>
                <th scope="col">Primjer</th>
                <th scope="col">Što to znači</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">kuća → kućom</th>
                <td data-label="Što to znači">Isti oblik u drugom padežu, već potrošeno.</td>
              </tr>
              <tr>
                <th scope="row">dobar → dobra</th>
                <td data-label="Što to znači">Ista obitelj. Nakon „dobar” nema „dobra” ni „dobro”.</td>
              </tr>
              <tr>
                <th scope="row">dobar → bolji</th>
                <td data-label="Što to znači">Drugi stupanj i druga obitelj. Smije se.</td>
              </tr>
              <tr>
                <th scope="row">kaladont</th>
                <td data-label="Što to znači">Jedina iznimka: može se ponavljati (i kalodont isto).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Kako ispadaš iz igre?</h3>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci tablica-bez-oznaka">
            <thead>
              <tr>
                <th scope="col">Razlog</th>
                <th scope="col">Što se događa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Istek vremena</th>
                <td data-label="Što se događa">Tajmer istekne prije valjane riječi - van!</td>
              </tr>
              <tr>
                <th scope="row">„Ne znam”</th>
                <td data-label="Što se događa">Predaja. Možeš ostati gledati.</td>
              </tr>
              <tr>
                <th scope="row">Mrtva slova</th>
                <td data-label="Što se događa">Nema slobodnog nastavka - ispada sljedeći na redu.</td>
              </tr>
              <tr>
                <th scope="row">Kaladont na „ka”</th>
                <td data-label="Što se događa">Rekao si riječ na ka, protivnik kaže kaladont - ti ispadaš.</td>
              </tr>
              <tr>
                <th scope="row">Napuštanje</th>
                <td data-label="Što se događa">Izađeš ili se ne vratiš u 10 sekundi.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <aside class="napomena">
          <strong>Obično</strong> ispada onaj tko ne zna reći nastavak.
          <strong>Iznimka:</strong> kad netko odigra riječ na <strong>ka</strong>, a protivnik kaže
          <strong>kaladont</strong> ili <strong>kalodont</strong>, ispada onaj koji je to omogućio
          (onaj s riječju na ka), ne onaj tko je rekao kaladont.
        </aside>
      </section>
    </section>
  {:else if odabranaTema === 'nacini'}
    <section id="sadrzaj-pomoci" class="sadrzaj pregled-igre" aria-labelledby="nacini-naslov">
      <h2 id="nacini-naslov">Kako sve možeš igrati?</h2>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci tablica-s-oznakama">
          <thead>
            <tr>
              <th scope="col">Način</th>
              <th scope="col">Tko igra</th>
              <th scope="col">Bodovi i rang</th>
              <th scope="col">Dostignuća</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Četveroboj</th>
              <td data-label="Tko igra">4 igrača</td>
              <td data-label="Bodovi i rang">Da</td>
              <td data-label="Dostignuća">Da</td>
            </tr>
            <tr>
              <th scope="row">Dvoboj</th>
              <td data-label="Tko igra">2 igrača</td>
              <td data-label="Bodovi i rang">Da</td>
              <td data-label="Dostignuća">Da</td>
            </tr>
            <tr>
              <th scope="row">Privatna soba</th>
              <td data-label="Tko igra">2 do 8 prijatelja, šalješ im link</td>
              <td data-label="Bodovi i rang">Ne</td>
              <td data-label="Dostignuća">Djelomično</td>
            </tr>
            <tr>
              <th scope="row">Zagrijavanje</th>
              <td data-label="Tko igra">Ti vs. Računalo</td>
              <td data-label="Bodovi i rang">Ne</td>
              <td data-label="Dostignuća">Djelomično</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  {:else if odabranaTema === 'bodovi'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="bodovi-naslov">
      <h2 id="bodovi-naslov">Bodovi i rangovi</h2>

      <section>
        <h3>Četveroboj</h3>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Rezultat</th><th scope="col">Bodovi</th></tr></thead>
            <tbody>
              <tr><th scope="row">1. mjesto</th><td data-label="Bodovi">4 boda</td></tr>
              <tr><th scope="row">2. mjesto</th><td data-label="Bodovi">2 boda</td></tr>
              <tr><th scope="row">3. mjesto</th><td data-label="Bodovi">1 bod</td></tr>
              <tr><th scope="row">4. mjesto</th><td data-label="Bodovi">0 bodova</td></tr>
              <tr><th scope="row">Izazvana eliminacija</th><td data-label="Bodovi">+1 bod (najviše 3)</td></tr>
              <tr class="red-maksimum">
                <th scope="row"><strong>Maksimalno moguće ostvariti</strong></th>
                <td data-label="Bodovi"><strong>7 bodova</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Dvoboj</h3>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Rezultat</th><th scope="col">Bodovi</th></tr></thead>
            <tbody>
              <tr><th scope="row">Pobjeda</th><td data-label="Bodovi">1 bod</td></tr>
              <tr><th scope="row">Poraz</th><td data-label="Bodovi">0 bodova</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Pragovi rangova</h3>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci tablica-rangova tablica-s-oznakama">
            <thead><tr><th scope="col">Rang</th><th scope="col">Četveroboj · prosjek bodova</th><th scope="col">Dvoboj · prosjek bodova</th></tr></thead>
            <tbody>
              {#each RANGOVI as rang, indeks}
                <tr>
                  <th scope="row"><span class="rang-uzorak" style:--boja-ranga={bojaBordera(rang.naziv)} aria-hidden="true"></span>{rang.naziv}</th>
                  <td data-label="Četveroboj · prosjek bodova">{rasponRanga(indeks, RANGOVI)}</td>
                  <td data-label="Dvoboj · prosjek bodova">{rasponRanga(indeks, RANGOVI_1V1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  {:else if odabranaTema === 'napredak'}
    <section id="sadrzaj-pomoci" class="sadrzaj" aria-labelledby="napredak-naslov">
      <h2 id="napredak-naslov">Iskustvo</h2>
      <p>Samo normalno završene javne igre. Izlazak ili nepovratak nakon prekida briše iskustvo te igre. <strong>lj, nj i dž</strong> broje se kao jedno slovo.</p>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead><tr><th scope="col">Događaj</th><th scope="col">Iskustvo</th></tr></thead>
          <tbody>
            <tr><th scope="row">Prihvaćena riječ</th><td data-label="Iskustvo">5</td></tr>
            <tr><th scope="row">Duga riječ, 10–11 slova</th><td data-label="Iskustvo">+10</td></tr>
            <tr><th scope="row">Srednje duga, 12–14 slova</th><td data-label="Iskustvo">+20</td></tr>
            <tr><th scope="row">Jako duga, 15+ slova</th><td data-label="Iskustvo">+35</td></tr>
            <tr><th scope="row">Rijetka, učestalost 10–99</th><td data-label="Iskustvo">+15</td></tr>
            <tr><th scope="row">Srednje rijetka, 1–9</th><td data-label="Iskustvo">+30</td></tr>
            <tr><th scope="row">Jako rijetka, 0 i barem 4 slova</th><td data-label="Iskustvo">+50</td></tr>
            <tr><th scope="row">Izazvana eliminacija</th><td data-label="Iskustvo">+25</td></tr>
            <tr><th scope="row">Pobjeda</th><td data-label="Iskustvo">+50</td></tr>
            <tr><th scope="row">kaladont / kalodont</th><td data-label="Iskustvo">+100 umjesto ostalih nagrada za tu riječ</td></tr>
          </tbody>
        </table>
      </div>
      <p>Dodaci za duljinu i rijetkost zbrajaju se s osnovnih 5. Mogu se dobiti svaki put, ne samo pri prvom otključavanju riječi.</p>

      <section>
        <h3>Kako povećati iskustvo</h3>
        <h4>Niz točnih riječi unutar igre</h4>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Niz točnih riječi u igri</th><th scope="col">Bonus iskustva</th></tr></thead>
            <tbody>
              <tr><th scope="row">0–2</th><td data-label="Bonus iskustva">+0 %</td></tr>
              <tr><th scope="row">3</th><td data-label="Bonus iskustva">+10 %</td></tr>
              <tr><th scope="row">4</th><td data-label="Bonus iskustva">+25 %</td></tr>
              <tr><th scope="row">5</th><td data-label="Bonus iskustva">+40 %</td></tr>
              <tr><th scope="row">6</th><td data-label="Bonus iskustva">+60 %</td></tr>
              <tr><th scope="row">7</th><td data-label="Bonus iskustva">+75 %</td></tr>
              <tr><th scope="row">8</th><td data-label="Bonus iskustva">+90 %</td></tr>
              <tr><th scope="row">9 ili više</th><td data-label="Bonus iskustva">+100 %</td></tr>
            </tbody>
          </table>
        </div>
        <p>Bonus se računa na zbroj osnovnog iskustva u toj igri. Odbijena riječ vraća trenutni niz na nulu. To nije niz pobjeda kroz više igara.</p>

        <h4>Pobjede za redom</h4>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Uzastopne javne pobjede</th><th scope="col">Četveroboj</th><th scope="col">Dvoboj</th></tr></thead>
            <tbody>
              <tr><th scope="row">1.</th><td data-label="Četveroboj">+0 %</td><td data-label="Dvoboj">+0 %</td></tr>
              <tr><th scope="row">Svaka sljedeća</th><td data-label="Četveroboj">+10 %</td><td data-label="Dvoboj">+5 %</td></tr>
              <tr><th scope="row">Najviše</th><td data-label="Četveroboj">+100 % od 11. pobjede</td><td data-label="Dvoboj">+100 % od 21. pobjede</td></tr>
            </tbody>
          </table>
        </div>
        <p>Nizovi Četveroboja i Dvoboja odvojeni su. Poraz prekida niz tog načina. Privatne igre ga ne diraju.</p>

        <h4 id="ocjena-partije">Ocjena igre</h4>
        <p>Javna igra uvijek dobiva 1–5 zvjezdica prema učinku u toj partiji (prihvaćene riječi, bodovi, eliminacije, XP). Bez doprinosa je 1, bilo kakav potez barem 2, duže partije lakše daju 3–4, a pobjeda ili vrlo jak učinak daje 5. Ne ovisi o Kaladont DNK-u.</p>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Zvjezdice</th><th scope="col">Bonus iskustva</th></tr></thead>
            <tbody>
              <tr><th scope="row">0–1</th><td data-label="Bonus iskustva">+0 %</td></tr>
              <tr><th scope="row">2</th><td data-label="Bonus iskustva">+5 %</td></tr>
              <tr><th scope="row">3</th><td data-label="Bonus iskustva">+10 %</td></tr>
              <tr><th scope="row">4</th><td data-label="Bonus iskustva">+15 %</td></tr>
              <tr><th scope="row">5</th><td data-label="Bonus iskustva">+20 %</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  {:else if odabranaTema === 'dnk'}
    <section id="sadrzaj-pomoci" class="sadrzaj dnk-pomoc" aria-labelledby="dnk-naslov">
      <h2 id="dnk-naslov">Kaladont DNK</h2>
      <p class="uvod">Šest brojeva od 0 do 100. Otključava se nakon 10 javnih igara, zasebno za Dvoboj i Četveroboj. Privatne igre i Zagrijavanje ne ulaze.</p>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead><tr><th scope="col">Os</th><th scope="col">Što mjeri</th></tr></thead>
          <tbody>
            <tr>
              <th scope="row">Vještina</th>
              <td data-label="Što mjeri">Prosjek bodova po javnoj igri</td>
            </tr>
            <tr>
              <th scope="row">Taktika</th>
              <td data-label="Što mjeri">Eliminacije po igri</td>
            </tr>
            <tr>
              <th scope="row">Fokus</th>
              <td data-label="Što mjeri">Najdulji niz prihvaćenih riječi</td>
            </tr>
            <tr>
              <th scope="row">Brzina</th>
              <td data-label="Što mjeri">Prosječno vrijeme prihvaćenog poteza</td>
            </tr>
            <tr>
              <th scope="row">Duge riječi</th>
              <td data-label="Što mjeri">Prosjek dugih riječi po igri</td>
            </tr>
            <tr>
              <th scope="row">Rijetke riječi</th>
              <td data-label="Što mjeri">Prosjek rijetkih riječi po igri</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>Stil igre na profilu</h3>
      <p>Odvojen je od DNK radara. Gleda ukupne eliminacije po igri.</p>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead><tr><th scope="col">Stil</th><th scope="col">Eliminacije po igri</th></tr></thead>
          <tbody>
            <tr><th scope="row">Dobrica</th><td data-label="Eliminacije po igri">manje od 0,2</td></tr>
            <tr><th scope="row">Uravnotežen</th><td data-label="Eliminacije po igri">0,2–0,8</td></tr>
            <tr><th scope="row">Agresivan</th><td data-label="Eliminacije po igri">više od 0,8</td></tr>
          </tbody>
        </table>
      </div>
      <p class="poveznica"><a href="/profil">Otvori profil →</a></p>
    </section>
  {:else if odabranaTema === 'pristupacnost'}
    <section id="sadrzaj-pomoci" class="sadrzaj pristupacnost" aria-labelledby="pristupacnost-naslov">
      <h2 id="pristupacnost-naslov">Pristupačnost</h2>
      <p class="uvod">Postavke su samo tvoje. Drugi igrači ih ne vide i igra im se ne mijenja.</p>

      <section id="disleksija" aria-labelledby="disleksija-naslov">
        <h3 id="disleksija-naslov">Disleksija i lakše čitanje</h3>
        <p>Disleksija utječe na čitanje, pisanje i prepoznavanje slova. Ne govori ništa o inteligenciji, a potrebe se razlikuju od osobe do osobe. <a href="https://www.nhs.uk/conditions/dyslexia-in-children/" target="_blank" rel="noreferrer">NHS-ov pregled disleksije</a>.</p>
        <p>Kaladont spaja tri oslonca: riječ na ekranu, obojena zadnja slova i izgovor naglas. To olakšava igru. Nije dokaz da igra liječi teškoće čitanja, niti zamjena za logopeda ili učitelja.</p>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Pomoć</th><th scope="col">Što radi u igri</th></tr></thead>
            <tbody>
              <tr>
                <th scope="row">Font za disleksiju</th>
                <td data-label="Što radi u igri">OpenDyslexic ima teže dno slova, pa se b/d, p/q i u/n teže zamijene. Uključuje se na naslovnici ili u <a href="/postavke">Postavkama</a>.</td>
              </tr>
              <tr>
                <th scope="row">Obojena zadnja slova</th>
                <td data-label="Što radi u igri">Na stolu su zadnja 2 slova u drugoj boji. Kod „kralj” to je <strong>alj</strong>, jer je lj jedno slovo. Ne moraš sam tražiti kraj riječi.</td>
              </tr>
              <tr>
                <th scope="row">Već upisana prva slova</th>
                <td data-label="Što radi u igri">Polje već ima tražena 2 slova. Tipkaš samo nastavak, pa je manje tipfelera na početku.</td>
              </tr>
              <tr>
                <th scope="row">Čitanje naglas</th>
                <td data-label="Što radi u igri">Svaka nova riječ na stolu izgovara se naglas, sporije (0,9×). Vidiš slova i čuješ riječ. Gumbi i izbornici se ne čitaju.</td>
              </tr>
              <tr>
                <th scope="row">Kriva riječ</th>
                <td data-label="Što radi u igri">Zamjena slova ne izbacuje te. Možeš odmah pokušati drugu riječ dok vrijeme traje.</td>
              </tr>
              <tr>
                <th scope="row">Bez tajmera</th>
                <td data-label="Što radi u igri"><a href="/zagrijavanje">Zagrijavanje</a> nema odbrojavanje. U <a href="/soba/kreiraj">privatnoj sobi</a> domaćin može ugasiti tajmer. Dobro za djecu i vježbu bez žurbe.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="upute-opcenito" aria-labelledby="citanje-naslov">
        <h3 id="citanje-naslov">Čitanje naglas</h3>
        <ul>
          <li><strong>Što čita.</strong> Samo novu riječ na stolu, na hrvatskom (hr-HR). Nije čitač zaslona poput VoiceOvera, TalkBacka, Pripovjedača ili Orce.</li>
          <li><strong>Zašto zvuči engleski ili šuti.</strong> Preglednik koristi glasove s tvog uređaja. Bez hrvatskog glasa čita engleskim ili uopće ne čita.</li>
          <li><strong>Što napraviti.</strong> Preuzmi hrvatski glas prema retku svog uređaja, pa osvježi Kaladont. Obavijest u igri pokazuje glasove koje preglednik vidi.</li>
          <li><strong>Digrafi.</strong> Izgovor lj, nj i dž ovisi o glasu. Igra ih i dalje broji kao jedno slovo, iako glas ponekad rastavi krivo.</li>
        </ul>
      </section>

      <section aria-labelledby="glasovi-naslov">
        <h3 id="glasovi-naslov">Hrvatski glas na uređaju</h3>
        <div class="tablica-omotac">
          <table class="tablica-mobilni-retci">
            <thead><tr><th scope="col">Uređaj</th><th scope="col">Gdje uključiti hrvatski glas</th></tr></thead>
            <tbody>
              <tr id="upute-android">
                <th scope="row">Android</th>
                <td data-label="Gdje uključiti hrvatski glas">Postavke → Pristupačnost → Izlaz pretvaranja teksta u govor. Odaberi hrvatski i preuzmi glas. <a href="https://support.google.com/accessibility/android/answer/6006983?hl=hr" target="_blank" rel="noreferrer">Googleove upute</a>.</td>
              </tr>
              <tr id="upute-ios">
                <th scope="row">iPhone i iPad</th>
                <td data-label="Gdje uključiti hrvatski glas">Postavke → Pristupačnost → Pročitani sadržaj ili Read &amp; Speak → Glasovi. Preuzmi hrvatski. Glas u Safariju može se razlikovati od glasa čitača zaslona. <a href="https://support.apple.com/guide/iphone/hear-whats-on-screen-or-typed-iph96b214f0/ios" target="_blank" rel="noreferrer">Appleove upute</a>.</td>
              </tr>
              <tr id="upute-windows">
                <th scope="row">Windows</th>
                <td data-label="Gdje uključiti hrvatski glas"><kbd>Windows + Ctrl + N</kbd> → Dodaj naslijeđene glasove → Upravljanje glasovima → Dodaj glasove → Hrvatski. Preglednik ne mora vidjeti glas Pripovjedača. <a href="https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices" target="_blank" rel="noreferrer">Microsoftove upute</a>.</td>
              </tr>
              <tr id="upute-macos">
                <th scope="row">Mac</th>
                <td data-label="Gdje uključiti hrvatski glas">System Settings → Accessibility → Read &amp; Speak → System voice. Preuzmi hrvatski i provjeri jezik govora. <a href="https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac" target="_blank" rel="noreferrer">Appleove upute</a>.</td>
              </tr>
              <tr id="upute-linux">
                <th scope="row">Linux</th>
                <td data-label="Gdje uključiti hrvatski glas">Nema jednog mjesta. Ako obavijest već vidi hrvatski glas, gotovo je. Inače instaliraj govorni paket (često eSpeak NG ili Speech Dispatcher) i ponovno otvori preglednik. Orca nije isti glas. <a href="https://help.gnome.org/gnome-help/a11y-screen-reader.html" target="_blank" rel="noreferrer">GNOMEove upute</a>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  {:else}
    <section id="sadrzaj-pomoci" class="sadrzaj faq" aria-labelledby="pitanja-naslov">
      <h2 id="pitanja-naslov">Pitanja i problemi</h2>

      <h3>Disleksija i čitanje</h3>
      <details>
        <summary>Kako olakšati čitanje kod disleksije?</summary>
        <p>Uključi font za disleksiju i čitanje naglas na naslovnici ili u <a href="/postavke">Postavkama</a>. Za igru bez odbrojavanja otvori <a href="/zagrijavanje">Zagrijavanje</a> ili privatnu sobu bez tajmera.</p>
      </details>
      <details>
        <summary>Zašto čitanje zvuči engleski ili čudno?</summary>
        <p>Uređaj nema hrvatski glas, pa preglednik koristi engleski. Dodaj glas hr-HR prema <a href="/pravila-kaladonta?tema=pristupacnost#upute-opcenito">uputama</a> i osvježi stranicu. lj, nj i dž i dalje ovise o kvaliteti tog glasa.</p>
      </details>
      <details>
        <summary>Zašto se čitanje uopće ne čuje?</summary>
        <p>Provjeri glasnoću, da preglednik dopušta govor i da je glas instaliran. Zatim ponovno učitaj Kaladont. Obavijest pri uključivanju kaže vidi li preglednik hrvatski glas.</p>
      </details>
      <details>
        <summary>Zašto su kod „kralj” i „konj” istaknuta tri znaka?</summary>
        <p>lj, nj i dž jedno su slovo. Zadnja dva slova od „konj” su o + nj, dakle onj. Od „kralj” su a + lj, dakle alj.</p>
      </details>
      <details>
        <summary>Kako igrati bez tajmera?</summary>
        <p><a href="/zagrijavanje">Zagrijavanje</a> nema tajmer. U privatnoj sobi domaćin bira „Bez tajmera”. Javni Dvoboj i Četveroboj imaju 30 sekundi.</p>
      </details>
      <details>
        <summary>Vide li drugi moj font i čitanje naglas?</summary>
        <p>Ne. Spremaju se na ovom uređaju i vrijede samo tebi.</p>
      </details>

      <h3>Riječi i ispadanje</h3>
      <details>
        <summary>Zašto riječ nije prihvaćena?</summary>
        <p>Provjeri početna slova, kvačice, vrstu riječi i je li oblik već odigran. Pokušaj drugu dok vrijeme traje.</p>
      </details>
      <details>
        <summary>Zašto drugi oblik iste riječi ne prolazi?</summary>
        <p>Povezani oblici troše se zajedno do kraja igre. Nakon „dobar” ne prolaze „dobra” ni „dobro”.</p>
      </details>
      <details>
        <summary>Zašto sam odmah ispao?</summary>
        <p>„Ne znam”, istek vremena, <PojamPomoc tekst="mrtva slova" opis={opisMrtvihSlova} id="mrtva-slova-faq" />, Kaladont na tvoje „ka”, ili prekid veze dulji od 10 sekundi.</p>
      </details>
      <details>
        <summary>Kako prijaviti riječ ili problem?</summary>
        <p>Na kraju igre otvori poteze i uz spornu riječ odaberi <strong>Prijavi</strong>.</p>
      </details>

      <h3>Rang i napredak</h3>
      <details>
        <summary>Dobivam li u Zagrijavanju bodove i XP?</summary>
        <p>Ne. Trening ne dira rang, XP, DNK ni formu. Registriranima pobjeda broji dostignuće Zagrijan.</p>
      </details>
      <details>
        <summary>Zašto piše Piskaralo?</summary>
        <p>Rang i DNK stižu nakon 10 javnih igara u tom načinu. Dvoboj i Četveroboj broje se odvojeno.</p>
      </details>
      <details>
        <summary>Zašto nisam na ljestvici?</summary>
        <p>Dnevno treba 10 javnih igara tog dana, a tjedno, mjesečno, godišnje i ukupno 20 u tom razdoblju. Igra pripada danu završetka, po hrvatskom vremenu.</p>
      </details>
      <details>
        <summary>Zašto privatna soba ne daje XP?</summary>
        <p>Ima svoju ljestvicu. XP, rang i DNK ostaju za javne igre. U sobi napreduju Rijetkolovac, Dugometraš i Jezik u plamenu.</p>
      </details>
      <details>
        <summary>Kako prenijeti napredak ili promijeniti avatar?</summary>
        <p>Gost ima napredak samo na ovom uređaju. Registracijom ga zadržavaš. Avatar i zvuk su u <a href="/profil?tab=postavke">postavkama profila</a>.</p>
      </details>
      <p class="poveznica">Nisi pronašao odgovor? <a href="https://forum.kaladont.hr">Otvori Kaladont forum →</a></p>
    </section>
  {/if}

  <nav class="povezano" aria-label={naslovPovezanih}>
    <h2 class="povezano-naslov">{naslovPovezanih}</h2>
    <ul>
      {#each teme as tema}
        {#if tema.id !== aktivnaTemaId}
          <li><a href={`/pravila-kaladonta?tema=${tema.id}`}>{tema.naziv}</a></li>
        {/if}
      {/each}
    </ul>
    <a href="/" class="povratak-pocetna">
      <img src="/ikone/04-naslovna.png" alt="" aria-hidden="true" />
      <span>Povratak na početnu stranicu</span>
    </a>
  </nav>
</main>

<style>
  .pomoc { width: min(780px, 100%); margin: 0 auto; padding: 0 4px 64px; }
  .pregled-igre .tablica-mobilni-retci tbody th { color: var(--boja-tekst-osnovni); font-weight: 700; }
  .zaglavlje { margin-bottom: 24px; }
  .nadnaslov { margin: 0 0 4px; color: var(--boja-mint); font-size: var(--tekst-sitni); font-weight: 700; text-transform: uppercase; }
  h1, h2, h3, h4 { font-family: var(--font-naslov); color: var(--boja-tekst-naslov); }
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
  h4 {
    margin: 20px 0 10px;
    font-size: calc((var(--naslov-3) + var(--tekst-baza)) / 2);
    font-weight: 700;
    line-height: 1.3;
  }
  p, li, td, th { line-height: 1.6; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li + li { margin-top: 7px; }
  a { color: var(--boja-pozadina-primarna); font-weight: 700; }
  .poveznica { margin-top: 24px; }
  .koraci { margin-top: 20px; }
  .tablica-omotac { margin: 20px 0; overflow-x: auto; }
  @media (min-width: 1000px) {
    .tablica-omotac {
      border-radius: var(--radijus-kartica);
      overflow: hidden;
    }
  }
  table { width: 100%; border-collapse: collapse; background: var(--boja-povrsina); }
  th, td { padding: 11px 12px; border-bottom: 1px solid var(--boja-obrub); text-align: left; vertical-align: top; }
  th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .povezano {
    margin-top: 8px;
    padding-top: 24px;
    border-top: 1px solid var(--boja-obrub);
  }
  .povezano-naslov {
    margin: 0 0 12px;
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    font-size: var(--naslov-3);
  }
  .povezano ul {
    margin: 0 0 20px;
    padding-left: 22px;
  }
  .povezano li + li { margin-top: 7px; }
  .povratak-pocetna {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }
  .povratak-pocetna img {
    width: 36px;
    height: 36px;
  }
  .rang-uzorak { display: inline-block; width: 16px; height: 16px; margin-right: 12px; border: 5px solid var(--boja-ranga); border-radius: 50%; vertical-align: middle; box-sizing: border-box; }
  .tablica-rangova tbody th { color: var(--boja-tekst-osnovni); }
  .red-maksimum th,
  .red-maksimum td {
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-naslov);
  }
  .napomena, .primjer-izracuna {
    padding: 14px 16px;
    border-left: 4px solid var(--boja-isticanje-tekst);
    border-radius: var(--radijus-kartica);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
  }
  .faq details { padding: 14px 0; border-bottom: 1px solid var(--boja-obrub); }
  .faq h3 { margin-top: 22px; }
  summary { cursor: pointer; font-weight: 700; }
  details p { margin: 10px 0 0; color: var(--boja-tekst-sekundarni); }
  kbd { font-family: inherit; font-weight: 700; }
  .oznake-pojmova { display: grid; grid-template-columns: minmax(120px, 180px) minmax(0, 1fr); margin: 20px 0; background: var(--boja-povrsina); }
  .oznake-pojmova dt, .oznake-pojmova dd { margin: 0; padding: 11px 12px; border-bottom: 1px solid var(--boja-obrub); overflow-wrap: anywhere; }
  .oznake-pojmova dt { color: var(--boja-tekst-naslov); font-weight: 700; }
  @media (max-width: 999px) {
    .pomoc { padding-top: 0; }
    .sadrzaj h2 { font-size: 28px; }
    h3, .povezano-naslov { font-size: 22px; }
    h4 { font-size: 19px; }
    .teme a { flex: 1 1 calc(50% - 4px); text-align: center; }
    .oznake-pojmova { grid-template-columns: minmax(0, 1fr); }
    .oznake-pojmova dt { padding-bottom: 3px; border: 0; }
    .oznake-pojmova dd { padding-top: 3px; }
    .tablica-omotac { overflow-x: visible; }
    .tablica-mobilni-retci thead { display: none; }
    .tablica-mobilni-retci {
      display: block;
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: transparent;
    }
    .tablica-mobilni-retci tbody {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .tablica-mobilni-retci tr,
    .tablica-mobilni-retci tbody th,
    .tablica-mobilni-retci tbody td {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
    .tablica-mobilni-retci tr {
      margin: 0;
      padding: 14px 16px;
      border: 1px solid var(--boja-obrub);
      border-radius: var(--radijus-kartica);
      background: var(--boja-povrsina);
    }
    .tablica-mobilni-retci tbody th,
    .tablica-mobilni-retci tbody td {
      border: 0;
      padding: 0;
      overflow-wrap: anywhere;
    }
    .tablica-mobilni-retci tbody th {
      margin: 0 0 10px;
      font-size: var(--tekst-baza);
      color: var(--boja-tekst-naslov);
    }
    .tablica-mobilni-retci tbody td + td { margin-top: 10px; }
    .tablica-mobilni-retci tbody td[data-label] {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      column-gap: 40px;
      row-gap: 4px;
    }
    .tablica-mobilni-retci tbody td[data-label]::before {
      content: attr(data-label);
      color: var(--boja-tekst-sekundarni);
      font-size: var(--tekst-mali);
      font-weight: 700;
      line-height: 1.35;
    }
    .tablica-bez-oznaka tbody td[data-label] { display: block; }
    .tablica-bez-oznaka tbody td[data-label]::before { display: none; }
    .tablica-mobilni-retci tr.red-maksimum {
      background: var(--boja-povrsina-2);
    }
    .tablica-mobilni-retci tr.red-maksimum th,
    .tablica-mobilni-retci tr.red-maksimum td {
      background: transparent;
    }
  }
  @media (max-width: 500px) {
    .teme {
      flex-direction: column;
    }
    .teme a {
      flex: none;
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
    }
  }
</style>
