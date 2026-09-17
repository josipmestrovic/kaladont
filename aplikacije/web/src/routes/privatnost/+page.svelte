<svelte:head>
  <title>Privatnost | Kaladont</title>
</svelte:head>

<main class="stranica-obavijesti">
  <h1>Pravila privatnosti</h1>
  <p class="datum">Zadnje ažuriranje: 17. rujna 2026.</p>

  <section>
    <h2>Tko obrađuje podatke?</h2>
    <p>
      Voditelj obrade je <strong>piši farmaceut, obrt za računalno programiranje, vl. Josip Meštrović</strong>,
      Braće Radić 25, 31550 Bizovac, Hrvatska. OIB: 21287408231. MBS: 99294702.
    </p>
    <p>
      Za pitanja i zahtjeve vezane uz osobne podatke javite se na
      <a href="mailto:info@kaladont.hr">info@kaladont.hr</a>.
    </p>
  </section>

  <section>
    <h2>Koje podatke koristimo?</h2>
    <ul>
      <li>email adresu i hash lozinke registriranog računa za prijavu i oporavak računa;</li>
      <li>nadimak, avatar, statistiku i povijest partija za rad igre;</li>
      <li>sesijski token u nužnom kolačiću i lokalni UUID gosta za prepoznavanje igrača;</li>
      <li>IP adresu u sigurnosnim i rate-limit logovima.</li>
    </ul>
    <p>Ne koristimo kolačiće za praćenje, oglašavanje ni profiliranje.</p>
  </section>

  <section>
    <h2>Zašto ih koristimo?</h2>
    <p>
      Podatke obrađujemo kako bismo omogućili račun, prijavu, oporavak lozinke, multiplayer igru,
      povijest partija, zaštitu od zlouporabe i rješavanje prijava grešaka. Email potvrde i upute za
      reset šalju se preko Resenda.
    </p>
  </section>

  <section>
    <h2>Koliko dugo ih čuvamo?</h2>
    <ul>
      <li>sesija vrijedi najviše 30 dana;</li>
      <li>IP i sigurnosni logovi čuvaju se 30 dana;</li>
      <li>email komunikacija o zahtjevu čuva se 12 mjeseci;</li>
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
      Kod brisanja uklanjamo email, lozinku, potvrdu emaila, aktivne sesije i privatni napredak.
      Zajedničke partije, potezi, plasmani i prijave ostaju, ali se račun prikazuje kao „Obrisani igrač",
      kako se ne bi promijenila povijest drugih igrača.
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
      Podaci se ne koriste za oglašavanje i ne uvodimo analitiku trećih strana bez zasebne izmjene ove obavijesti.
    </p>
  </section>

  <section>
    <h2>Prigovor</h2>
    <p>
      Prije prigovora možete nam se javiti na <a href="mailto:info@kaladont.hr">info@kaladont.hr</a>.
      Imate i pravo podnijeti prigovor nadležnom tijelu za zaštitu osobnih podataka.
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
