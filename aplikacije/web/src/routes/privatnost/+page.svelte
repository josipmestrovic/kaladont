<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Privatnost | Kaladont</title>
</svelte:head>

<main class="stranica-obavijesti">
  <h1>Pravila privatnosti</h1>
  <p class="datum">Zadnje ažuriranje: 11. studenoga 2026.</p>

  <section>
    <h2>Koje podatke koristimo?</h2>
    <ul>
      <li>email adresu i hash lozinke registriranog računa za prijavu i oporavak računa;</li>
      <li>nadimak, avatar, statistiku i povijest partija za rad igre;</li>
      <li>sesijski token u nužnom kolačiću i lokalni UUID gosta za prepoznavanje igrača;</li>
      <li>
        za registrirani račun: izjavu o dobi (najmanje 16 godina), verziju prihvaćenih Uvjeta korištenja
        i vrijeme prihvata — samo kao korisnikova izjava pri otvaranju računa, ne kao neovisna
        provjera dobi;
      </li>
      <li>IP adresu u sigurnosnim i rate-limit logovima.</li>
    </ul>
    <p>Ne koristimo kolačiće za praćenje, oglašavanje ni profiliranje.</p>
  </section>

  <section>
    <h2>Dobno ograničenje</h2>
    <p>
      Kaladont je namijenjen osobama od 16 godina nadalje. Pri otvaranju računa tražimo potvrdu da imaš
      najmanje 16 godina i da prihvaćaš <a href="/uvjeti">Uvjete korištenja</a>. Ta potvrda nije
      verifikacija stvarne dobi; bilježimo samo tvoju izjavu, verziju Uvjeta i trenutak prihvata.
      Gost može igrati bez te potvrde u aplikaciji; za gosta ne čuvamo evidenciju prihvata.
    </p>
  </section>

  {#if data.umami}
  <section>
    <h2>Web analitika</h2>
    <p>
      Kad je analitika uključena, koristimo self-hosted Umami na <code>analitika.kaladont.hr</code>
      (isti hosting kao igra, EU). Mjeri anonimne posjete, izvore prometa i odabrane događaje
      (npr. klik na „Igraj” ili forum). Ne koristi kolačiće za praćenje, ne profilira korisnike i ne
      šalje podatke trećim stranama za oglašavanje. Ne bilježimo email, UUID gosta ni sadržaj foruma.
    </p>
  </section>
  {/if}

  <section>
    <h2>Zašto ih koristimo?</h2>
    <p>
      Podatke obrađujemo kako bismo omogućili račun, prijavu, oporavak lozinke, multiplayer igru,
      povijest partija, provedbu dobne politike i Uvjeta korištenja, zaštitu od zlouporabe i
      rješavanje prijava grešaka. Email potvrde i upute za reset šalju se preko Resenda.
      {#if data.umami}
        Anonimnu web analitiku koristimo da vidimo odakle dolaze posjetitelji i koje pozive na akciju koriste.
      {/if}
    </p>
  </section>

  <section>
    <h2>Koliko dugo ih čuvamo?</h2>
    <ul>
      <li>sesija vrijedi najviše 30 dana;</li>
      <li>IP i sigurnosni logovi čuvaju se 30 dana;</li>
      <li>email komunikacija o zahtjevu čuva se 12 mjeseci;</li>
      <li>
        evidencija prihvata Uvjeta i izjave o dobi čuva se uz registrirani račun dok je račun aktivan;
      </li>
      <li>anonimizirana povijest partija čuva se dok je potrebna za integritet igre;</li>
      <li>backup kopije rotiraju se prema operativnom postupku i ne uklanjaju se pojedinačno na zahtjev.</li>
    </ul>
  </section>

  <section>
    <h2>Brisanje, pristup i ispravak</h2>
    <p>
      Zahtjev pošaljite s email adrese registrirane na računu na
      <a href="mailto:info@kaladont.hr">info@kaladont.hr</a>. Zahtjeve obrađujemo ručno u roku do 7 dana.
    </p>
    <p>
      Kod brisanja uklanjamo email, lozinku, potvrdu emaila, evidenciju prihvata Uvjeta i izjave o dobi,
      aktivne sesije i privatni napredak. Zajedničke partije, potezi, plasmani i prijave ostaju, ali se
      račun prikazuje kao „Obrisani igrač", kako se ne bi promijenila povijest drugih igrača.
    </p>
    <p>
      Isti kontakt možete koristiti za zahtjev za pristup vlastitim podacima ili ispravak netočnih podataka.
      Ne šaljite lozinku ni sesijske tokene u emailu.
    </p>
  </section>

  <section>
    <h2>Izvršitelji obrade</h2>
    <p>
      Kaladont se za hosting i bazu oslanja na Hetzner u Njemačkoj, a za transakcijske emailove na Resend.
      {#if data.umami}
        Web analitiku vodi vlastiti Umami na istom VPS-u; podaci se ne koriste za oglašavanje.
      {/if}
    </p>
  </section>

  <section>
    <h2>Prigovor</h2>
    <p>
      Prije prigovora možete nam se javiti na <a href="mailto:info@kaladont.hr">info@kaladont.hr</a>.
      Imate i pravo podnijeti prigovor nadležnom tijelu za zaštitu osobnih podataka.
    </p>
  </section>

  <section>
    <h2>Tko obrađuje podatke?</h2>
    <p>
      Voditelj obrade je <strong>STACK, obrt za računalno programiranje, vl. Josip Meštrović</strong>,
      Braće Radić 25, 31550 Bizovac, Hrvatska. OIB: 21287408231. MBS: 99294702.
    </p>
    <p>
      Za pitanja i zahtjeve vezane uz osobne podatke javite se na
      <a href="mailto:info@kaladont.hr">info@kaladont.hr</a>.
    </p>
  </section>
</main>

<style>
  .stranica-obavijesti {
    max-width: 680px;
    padding: 32px 0;
  }

  h1 {
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    margin: 0 0 8px;
  }

  .datum {
    margin: 0 0 28px;
    color: var(--boja-tekst-sekundarni);
    font-size: 14px;
  }

  section {
    margin: 0 0 28px;
  }

  h2 {
    font-family: var(--font-naslov);
    color: var(--boja-tekst-naslov);
    font-size: 22px;
    margin: 0 0 8px;
  }

  p,
  li {
    margin: 0 0 10px;
    color: var(--boja-tekst-sekundarni);
    line-height: 1.6;
  }

  ul {
    margin: 0 0 10px;
    padding-left: 22px;
  }

  a {
    color: var(--boja-tekst-naslov);
    font-weight: 700;
  }
</style>
