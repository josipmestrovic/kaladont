<script lang="ts">
  import { Home } from 'lucide-svelte';
  import SeoGlava from '$lib/komponente/SeoGlava.svelte';
  import { breadcrumbPravila, metaPravilaTeme, putanjaPravilaTeme } from '$lib/seo.js';

  const meta = metaPravilaTeme('pristupacnost');
  const putanja = putanjaPravilaTeme('pristupacnost');
  const jsonLd = breadcrumbPravila('pristupacnost');
</script>

<SeoGlava title={meta.title} description={meta.description} putanja={putanja} jsonLd={jsonLd} />

<main class="pomoc">
  <header class="zaglavlje">
    <p class="nadnaslov">Pravila Kaladonta</p>
    <h1>{meta.naziv}</h1>
  </header>

  <section id="sadrzaj-pomoci" class="sadrzaj pristupacnost" aria-label="Pristupačnost">
    <p class="uvod">Postavke su samo tvoje. Drugi igrači ih ne vide i igra im se ne mijenja.</p>

    <section id="disleksija" aria-labelledby="disleksija-naslov">
      <h3 id="disleksija-naslov">Disleksija i lakše čitanje</h3>
      <p>
        Disleksija utječe na čitanje, pisanje i prepoznavanje slova. Ne govori ništa o inteligenciji, a
        potrebe se razlikuju od osobe do osobe.
        <a href="https://www.nhs.uk/conditions/dyslexia-in-children/" target="_blank" rel="noreferrer"
          >NHS-ov pregled disleksije</a
        >.
      </p>
      <p>
        Kaladont spaja tri oslonca: riječ na ekranu, obojena zadnja slova i izgovor naglas. To olakšava
        igru. Nije dokaz da igra liječi teškoće čitanja, niti zamjena za logopeda ili učitelja.
      </p>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead
            ><tr
              ><th scope="col">Pomoć</th><th scope="col">Što radi u igri</th></tr
            ></thead
          >
          <tbody>
            <tr>
              <th scope="row">Font za disleksiju</th>
              <td data-label="Što radi u igri"
                >OpenDyslexic ima teže dno slova, pa se b/d, p/q i u/n teže zamijene. Uključuje se na
                naslovnici ili u <a href="/postavke">Postavkama</a>.</td
              >
            </tr>
            <tr>
              <th scope="row">Obojena zadnja slova</th>
              <td data-label="Što radi u igri"
                >Na stolu su zadnja 2 slova u drugoj boji. Kod „kralj” to je <strong>alj</strong>, jer
                je lj jedno slovo. Ne moraš sam tražiti kraj riječi.</td
              >
            </tr>
            <tr>
              <th scope="row">Već upisana prva slova</th>
              <td data-label="Što radi u igri"
                >Polje već ima tražena 2 slova. Tipkaš samo nastavak, pa je manje tipfelera na
                početku.</td
              >
            </tr>
            <tr>
              <th scope="row">Čitanje naglas</th>
              <td data-label="Što radi u igri"
                >Svaka nova riječ na stolu izgovara se naglas, sporije (0,9×). Vidiš slova i čuješ
                riječ. Gumbi i izbornici se ne čitaju.</td
              >
            </tr>
            <tr>
              <th scope="row">Kriva riječ</th>
              <td data-label="Što radi u igri"
                >Zamjena slova ne izbacuje te. Možeš odmah pokušati drugu riječ dok vrijeme traje.</td
              >
            </tr>
            <tr>
              <th scope="row">Bez tajmera</th>
              <td data-label="Što radi u igri"
                ><a href="/zagrijavanje">Zagrijavanje</a> nema odbrojavanje. U
                <a href="/soba/kreiraj">privatnoj sobi</a> domaćin može ugasiti tajmer. Dobro za djecu
                i vježbu bez žurbe.</td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="upute-opcenito" aria-labelledby="citanje-naslov">
      <h3 id="citanje-naslov">Čitanje naglas</h3>
      <ul>
        <li>
          <strong>Što čita.</strong> Samo novu riječ na stolu, na hrvatskom (hr-HR). Nije čitač zaslona
          poput VoiceOvera, TalkBacka, Pripovjedača ili Orce.
        </li>
        <li>
          <strong>Zašto zvuči engleski ili šuti.</strong> Preglednik koristi glasove s tvog uređaja. Bez
          hrvatskog glasa čita engleskim ili uopće ne čita.
        </li>
        <li>
          <strong>Što napraviti.</strong> Preuzmi hrvatski glas prema retku svog uređaja, pa osvježi
          Kaladont. Obavijest u igri pokazuje glasove koje preglednik vidi.
        </li>
        <li>
          <strong>Digrafi.</strong> Izgovor lj, nj i dž ovisi o glasu. Igra ih i dalje broji kao jedno
          slovo, iako glas ponekad rastavi krivo.
        </li>
      </ul>
    </section>

    <section aria-labelledby="glasovi-naslov">
      <h3 id="glasovi-naslov">Hrvatski glas na uređaju</h3>
      <div class="tablica-omotac">
        <table class="tablica-mobilni-retci">
          <thead
            ><tr
              ><th scope="col">Uređaj</th><th scope="col">Gdje uključiti hrvatski glas</th></tr
            ></thead
          >
          <tbody>
            <tr id="upute-android">
              <th scope="row">Android</th>
              <td data-label="Gdje uključiti hrvatski glas"
                >Postavke → Pristupačnost → Izlaz pretvaranja teksta u govor. Odaberi hrvatski i
                preuzmi glas.
                <a
                  href="https://support.google.com/accessibility/android/answer/6006983?hl=hr"
                  target="_blank"
                  rel="noreferrer">Googleove upute</a
                >.</td
              >
            </tr>
            <tr id="upute-ios">
              <th scope="row">iPhone i iPad</th>
              <td data-label="Gdje uključiti hrvatski glas"
                >Postavke → Pristupačnost → Pročitani sadržaj ili Read &amp; Speak → Glasovi. Preuzmi
                hrvatski. Glas u Safariju može se razlikovati od glasa čitača zaslona.
                <a
                  href="https://support.apple.com/guide/iphone/hear-whats-on-screen-or-typed-iph96b214f0/ios"
                  target="_blank"
                  rel="noreferrer">Appleove upute</a
                >.</td
              >
            </tr>
            <tr id="upute-windows">
              <th scope="row">Windows</th>
              <td data-label="Gdje uključiti hrvatski glas"
                ><kbd>Windows + Ctrl + N</kbd> → Dodaj naslijeđene glasove → Upravljanje glasovima →
                Dodaj glasove → Hrvatski. Preglednik ne mora vidjeti glas Pripovjedača.
                <a
                  href="https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices"
                  target="_blank"
                  rel="noreferrer">Microsoftove upute</a
                >.</td
              >
            </tr>
            <tr id="upute-macos">
              <th scope="row">Mac</th>
              <td data-label="Gdje uključiti hrvatski glas"
                >System Settings → Accessibility → Read &amp; Speak → System voice. Preuzmi hrvatski
                i provjeri jezik govora.
                <a
                  href="https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac"
                  target="_blank"
                  rel="noreferrer">Appleove upute</a
                >.</td
              >
            </tr>
            <tr id="upute-linux">
              <th scope="row">Linux</th>
              <td data-label="Gdje uključiti hrvatski glas"
                >Nema jednog mjesta. Ako obavijest već vidi hrvatski glas, gotovo je. Inače instaliraj
                govorni paket (često eSpeak NG ili Speech Dispatcher) i ponovno otvori preglednik. Orca
                nije isti glas.
                <a
                  href="https://help.gnome.org/gnome-help/a11y-screen-reader.html"
                  target="_blank"
                  rel="noreferrer">GNOMEove upute</a
                >.</td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>

  <nav class="povezano" aria-label="Navigacija">
    <a href="/pravila-kaladonta" class="povratak-pravila">Pravila igre</a>
    <a href="/" class="povratak-pocetna">
      <Home class="povratak-ikona" size={28} strokeWidth={2.2} aria-hidden="true" />
      <span>Povratak na početnu stranicu</span>
    </a>
  </nav>
</main>

<style>
  .pomoc { width: min(780px, 100%); margin: 0 auto; padding: 0 4px 64px; }
  .zaglavlje { margin-bottom: 8px; }
  .nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-mint);
    font-size: var(--tekst-sitni);
    font-weight: 700;
    text-transform: uppercase;
  }
  h1, h3 { font-family: var(--font-naslov); color: var(--boja-tekst-naslov); }
  h1 { margin: 0; font-size: var(--naslov-1); }
  .uvod { margin: 12px 0 0; color: var(--boja-tekst-sekundarni); line-height: 1.6; }
  #sadrzaj-pomoci { scroll-margin-top: 16px; outline: none; }
  .sadrzaj { padding: 8px 0 22px; }
  .sadrzaj > section { padding: 18px 0; border-top: 1px solid var(--boja-obrub); }
  h3 { margin: 0 0 16px; font-size: var(--naslov-3); }
  p, li, td, th { line-height: 1.6; }
  p { margin: 0 0 12px; }
  ul { margin: 0 0 12px; padding-left: 1.25rem; }
  a { color: var(--boja-pozadina-primarna); font-weight: 700; }
  kbd {
    padding: 0.1em 0.35em;
    border: 1px solid var(--boja-obrub);
    border-radius: 4px;
    background: var(--boja-povrsina-2);
    font: inherit;
    font-size: 0.9em;
  }
  #disleksija,
  #upute-opcenito,
  #upute-android,
  #upute-ios,
  #upute-windows,
  #upute-macos,
  #upute-linux {
    scroll-margin-top: 72px;
  }

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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 24px;
    margin-top: 8px;
    padding-top: 24px;
    border-top: 1px solid var(--boja-obrub);
  }
  .povratak-pravila {
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
  }
  .povratak-pravila:hover,
  .povratak-pravila:focus-visible {
    color: var(--boja-akcent-tekst);
  }
  .povratak-pocetna {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
  }
  .povratak-pocetna:hover,
  .povratak-pocetna:focus-visible {
    color: var(--boja-akcent-tekst);
  }
  .povratak-ikona {
    display: block;
    flex-shrink: 0;
  }
  @media (max-width: 999px) {
    .pomoc { padding-top: 0; }
    h1 { font-size: 28px; }
    h3 { font-size: 22px; }
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
  }
</style>
