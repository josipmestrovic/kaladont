<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { RANGOVI } from 'zajednicko';

  type Tema = 'pravila' | 'javne' | 'privatne' | 'rangovi' | 'napredak';

  const teme: { id: Tema; puniNaziv: string; kratkiNaziv: string }[] = [
    { id: 'pravila', puniNaziv: 'Pravila igre', kratkiNaziv: 'Pravila' },
    { id: 'javne', puniNaziv: 'Javne igre', kratkiNaziv: 'Javne' },
    { id: 'privatne', puniNaziv: 'Privatne igre', kratkiNaziv: 'Privatne' },
    { id: 'rangovi', puniNaziv: 'Rangovi i obrubi', kratkiNaziv: 'Rangovi' },
    { id: 'napredak', puniNaziv: 'Napredak', kratkiNaziv: 'Napredak' },
  ];

  const odabranaTema = $derived(
    teme.some((tema) => tema.id === $page.url.searchParams.get('tema'))
      ? ($page.url.searchParams.get('tema') as Tema)
      : 'pravila',
  );

  function otvoriTemu(tema: Tema): void {
    void goto(`/pomoc?tema=${tema}`, { replaceState: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>Pomoć | Kaladont</title>
  <meta name="description" content="Pravila igre, rangovi, obrubi avatara, XP i dostignuća u Kaladontu." />
</svelte:head>

<main class="pomoc">
  <header class="zaglavlje">
    <p class="nadnaslov">Vodič kroz Kaladont</p>
    <h1>Pomoć</h1>
    <p>Sve što trebaš za igru, napredak i statistiku.</p>
  </header>

  <nav class="teme" aria-label="Teme pomoći">
    {#each teme as tema}
      <button
        type="button"
        class:aktivna={odabranaTema === tema.id}
        aria-current={odabranaTema === tema.id ? 'page' : undefined}
        onclick={() => otvoriTemu(tema.id)}
      >
        <span class="puni-naziv">{tema.puniNaziv}</span>
        <span class="kratki-naziv">{tema.kratkiNaziv}</span>
      </button>
    {/each}
  </nav>

  {#if odabranaTema === 'pravila'}
    <section class="sadrzaj" aria-labelledby="pravila-naslov">
      <h2 id="pravila-naslov">Pravila igre</h2>
      <section>
        <h3>2 zadnja slova</h3>
        <p>Odgovori riječju koja počinje na zadnja 2 slova prethodne riječi. <strong>Nj, lj i dž</strong> jedno su slovo.</p>
        <p>Primjer: nakon <strong>kralj</strong> traži se <strong>alj</strong>; nakon <strong>ulje</strong> traži se <strong>lje</strong>. Kod riječi poput „injekcija” slova se rastavljaju kao <strong>i-n-j</strong>.</p>
      </section>
      <section>
        <h3>Koje su riječi dopuštene?</h3>
        <p>Riječ mora postojati u hrvatskom rječniku i početi na tražena slova. Prihvaćamo imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice i usklice u svim oblicima.</p>
        <ul>
          <li>Dijakritici vrijede: <strong>č nije c</strong>, <strong>š nije s</strong> i tako redom.</li>
          <li>Vlastita imena, kratice, brojke, crtice i razmaci nisu u igri.</li>
        </ul>
      </section>
      <section>
        <h3>Jednom odigrano, potrošeno</h3>
        <p>Riječ troši svoje leksemske grupe. Nakon „dobar” ne prolaze ni „dobra” ni „dobro”, dok su „bolji” i „najbolji” zasebne grupe. „Kaladont” i „kalodont” posebne su riječi i mogu se ponoviti.</p>
      </section>
      <section>
        <h3>Kada ispadaš?</h3>
        <ul>
          <li>klikneš <strong>Ne znam</strong>;</li>
          <li>istekne vrijeme prije valjane riječi;</li>
          <li>prethodni igrač ostavi mrtva slova bez dostupnog nastavka;</li>
          <li>ne vratiš se nakon prekida veze u roku od 10 sekundi.</li>
        </ul>
        <p>Pogrešna riječ te ne ruši odmah, ali pojede dragocjeno vrijeme.</p>
      </section>
      <section>
        <h3>Kaladont efekt</h3>
        <p>Kada odigraš „kaladont” ili „kalodont” na <strong>ka</strong>, ispada igrač koji ti je otvorio „ka”, ne sljedeći igrač. Ti dobivaš bod za eliminaciju, a sustav otvara novu rundu.</p>
      </section>
      <p class="poveznica">Želiš znati kako se računaju rang i obrub avatara? <button type="button" onclick={() => otvoriTemu('rangovi')}>Rangovi i obrubi →</button></p>
    </section>
  {:else if odabranaTema === 'javne'}
    <section class="sadrzaj" aria-labelledby="javne-naslov">
      <h2 id="javne-naslov">Javne igre</h2>
      <p>Javne igre su glavni natjecateljski modovi. Igraš protiv drugih igrača iz reda čekanja, a rezultat se sprema u tvoju javnu statistiku.</p>
      <section><h3>Klasični mod za 4 igrača</h3><p>Igraju točno 4 igrača. Prvi ispali završava na četvrtom mjestu, a zadnji preostali pobjeđuje. Plasman, izazvane eliminacije i pobjeda ulaze u bodovanje.</p></section>
      <section><h3>1v1 dvoboj</h3><p>Igraju 2 igrača. Pravila riječi su ista, ali bodovanje i statistika vode se zasebno od Klasičnog moda.</p></section>
      <section><h3>Što javni modovi dijele?</h3><p>Dijele pravila nastavaka, grafeme, rječnik, leksemske grupe i osnovni sustav igre. Ne dijele statistiku, prosjek bodova, rang ni broj odigranih partija.</p></section>
      <p class="poveznica"><a href="/ljestvica">Otvori ljestvicu igrača →</a></p>
    </section>
  {:else if odabranaTema === 'privatne'}
    <section class="sadrzaj" aria-labelledby="privatne-naslov">
      <h2 id="privatne-naslov">Privatne igre</h2>
      <p>Privatna soba je tvoja igra s ekipom. Može imati od <strong>2 do 8 igrača</strong>, a ulazi se kodom ili pozivnim linkom.</p>
      <section><h3>Vlastita pravila</h3><p>Vlasnik sobe bira trajanje poteza, dopuštene vrste riječi i želi li dodjeljivati bodove za eliminacije. Pravila nastavaka, grafema i ponavljanja ostaju ista.</p></section>
      <section><h3>Što privatne sobe dijele s javnom igrom?</h3><p>Koriste isti rječnik, grafeme, leksemske grupe, prihvaćanje riječi, ispadanje i Kaladont efekt. Zato naučena pravila vrijede svugdje.</p></section>
      <section><h3>Što privatne sobe ne mijenjaju?</h3><p>Privatni rezultat ne ulazi u javni rang, javne bodove, javnu statistiku ni XP. Soba ima vlastitu privremenu ljestvicu koja traje dok je soba aktivna.</p></section>
      <p class="poveznica"><a href="/soba/kreiraj">Stvori privatnu sobu →</a></p>
    </section>
  {:else if odabranaTema === 'rangovi'}
    <section class="sadrzaj" aria-labelledby="rangovi-naslov">
      <h2 id="rangovi-naslov">Rangovi i obrubi</h2>
      <p>Nakon prvih 10 partija u pojedinom modu dobivaš rang prema prosjeku bodova po partiji. Rangovi za 4 igrača i 1v1 računaju se odvojeno.</p>
      <div class="tablica-omotac">
        <table>
          <thead><tr><th>Rang</th><th>Prosjek bodova po partiji</th></tr></thead>
          <tbody>
            {#each RANGOVI as rang, indeks}
              <tr><td>{rang.naziv}</td><td>{indeks === 0 ? 'manje od 1,50' : indeks === RANGOVI.length - 1 ? '5,70 ili više' : `${rang.minimalniProsjek.toFixed(2).replace('.', ',')} – ${((RANGOVI[indeks + 1]?.minimalniProsjek ?? rang.minimalniProsjek) - 0.01).toFixed(2).replace('.', ',')}`}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="napomena">Tvoj rang mijenja boju obruba avatara. Obrub je vizualni status i ne daje prednost u igri.</p>
      <p class="poveznica">Kako skupljaš XP i otključavaš dostignuća? <button type="button" onclick={() => otvoriTemu('napredak')}>Napredak →</button></p>
    </section>
  {:else}
    <section class="sadrzaj" aria-labelledby="napredak-naslov">
      <h2 id="napredak-naslov">Napredak</h2>
      <section>
        <h3>Iskustvo i razine</h3>
        <p>Razina i rang nisu isto. Rang govori o prosjeku bodova i natjecateljskom statusu, a razina govori koliko si ukupno iskustva skupio. XP dobivaš kroz poteze, pobjede, eliminacije, duge i rijetke riječi te streakove. Nakon partije vidiš točan obračun i punjenje XP trake.</p>
      </section>
      <section>
        <h3>Dostignuća</h3>
        <p>Dostignuća imaju više razina, a zvjezdice pokazuju koliko si ih već otključao. Možeš pratiti razine, rijetke riječi, duge riječi, streak, Kaladont trenutke i pobjede.</p>
        <p class="poveznica">Svoja dostignuća pronaći ćeš na <a href="/profil">svom profilu →</a></p>
      </section>
      <section>
        <h3>Duge i rijetke riječi</h3>
        <ul>
          <li>Duga riječ: 10–11 grafema.</li>
          <li>Srednje duga riječ: 12–14 grafema.</li>
          <li>Jako duga riječ: 15+ grafema.</li>
          <li>Rijetkost se određuje prema učestalosti riječi u rječniku.</li>
          <li><strong>Nj, lj i dž</strong> računaju se kao jedan grafem.</li>
        </ul>
      </section>
    </section>
  {/if}

  <section class="faq" aria-labelledby="faq-naslov">
    <h2 id="faq-naslov">Najčešća pitanja</h2>
    <details><summary>Zašto moja riječ nije prihvaćena?</summary><p>Provjeri tražena slova, dijakritike i je li riječ već potrošila svoju leksemsku grupu. Ako je presuda čudna, prijavi je i pusti serveru da bude sudac.</p></details>
    <details><summary>Zašto još nemam rang?</summary><p>Rang se prikazuje nakon prvih 10 partija u pojedinom modu. Do tada si u kalibraciji.</p></details>
    <details><summary>Utječu li privatne sobe na rang i XP?</summary><p>Ne utječu na javni rang, javne bodove ni XP. Privatna soba ima svoju malu ljestvicu, a određena jezična dostignuća i dalje mogu napredovati.</p></details>
    <details><summary>Zašto sam ispao iako nisam kliknuo „Ne znam”?</summary><p>Možda je isteklo vrijeme, ostala su mrtva slova ili se veza nije vratila na vrijeme. Igra ne kažnjava šutnju dvaput, samo je vrlo dosljedna.</p></details>
    <details><summary>Mogu li ponovno odigrati riječ u drugom padežu?</summary><p>Ne ako dijeli istu leksemsku grupu s već odigranom riječi. Drugi oblik nije uvijek novi potez.</p></details>
    <details><summary>Kako prijaviti riječ koja nedostaje?</summary><p>Upotrijebi gumb „Prijavi” u igri ili u povijesti partije. Tako se prijava veže uz točan potez i rječnik se može pošteno provjeriti.</p></details>
  </section>
</main>

<style>
  .pomoc { max-width: 820px; margin: 0 auto; padding: 32px 4px 64px; }
  .zaglavlje { margin-bottom: 24px; }
  .nadnaslov { margin: 0 0 4px; color: var(--boja-mint); font-size: var(--tekst-sitni); font-weight: 700; text-transform: uppercase; }
  h1, h2, h3 { font-family: var(--font-naslov); color: var(--boja-tekst-naslov); }
  h1 { margin: 0; font-size: var(--naslov-1); }
  .zaglavlje > p:last-child { margin: 8px 0 0; color: var(--boja-tekst-sekundarni); }
  .teme { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 24px; padding-bottom: 4px; scrollbar-width: thin; }
  .teme button { flex: 0 0 auto; padding: 10px 14px; border: 1px solid #e5ddc8; border-radius: var(--radijus-pill); background: #faf8f0; color: var(--boja-tekst-osnovni); font: inherit; font-weight: 700; cursor: pointer; }
  .teme button.aktivna { border-color: var(--boja-pozadina-primarna); background: var(--boja-pozadina-primarna); color: white; }
  .kratki-naziv { display: none; }
  .sadrzaj, .faq { padding: 22px 0; }
  .sadrzaj h2, .faq h2 { margin: 0 0 18px; font-size: var(--naslov-2); }
  .sadrzaj section { padding: 18px 0; border-top: 1px solid #e5ddc8; }
  h3 { margin: 0 0 8px; font-size: var(--naslov-3); }
  p, li { line-height: 1.6; }
  p { margin: 0 0 12px; }
  ul { margin: 0 0 12px; padding-left: 22px; }
  li + li { margin-top: 6px; }
  button, a { color: var(--boja-pozadina-primarna); font-weight: 700; }
  .poveznica { margin-top: 24px; }
  .poveznica button { padding: 0; border: 0; background: none; font: inherit; cursor: pointer; }
  .tablica-omotac { overflow-x: auto; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; background: white; }
  th, td { padding: 11px 12px; border-bottom: 1px solid #e5ddc8; text-align: left; }
  th { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-sitni); }
  .napomena { padding: 14px 16px; border-left: 4px solid var(--boja-mint); background: #fffdf5; }
  .faq { border-top: 1px solid #e5ddc8; }
  .faq details { padding: 14px 0; border-bottom: 1px solid #e5ddc8; }
  .faq summary { cursor: pointer; font-weight: 700; }
  .faq details p { margin: 10px 0 0; color: var(--boja-tekst-sekundarni); }
  @media (max-width: 560px) {
    .pomoc { padding-top: 24px; }
    .puni-naziv { display: none; }
    .kratki-naziv { display: inline; }
    .teme { margin-right: -4px; }
  }
</style>
