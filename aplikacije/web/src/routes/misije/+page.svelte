<script lang="ts">
  import { onMount } from 'svelte';
  import type { MisijaDto, StanjeMisijaDto, VrstaMisije } from 'zajednicko';
  import {
    ApiGreska,
    dohvatiStanjeMisija,
    noviIdempotencyKey,
    oznaciPregledMisija,
    porukaZaKodMisije,
    zamijeniMisiju,
  } from '$lib/misije-klijent.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import KarticaMisije from '$lib/komponente/KarticaMisije.svelte';

  let stanje = $state<StanjeMisijaDto | null>(null);
  let ucitava = $state(true);
  let greska = $state<string | null>(null);
  let statusPoruka = $state<string | null>(null);
  let zamjenaUTijeku = $state<VrstaMisije | null>(null);
  let potvrdaZamjene = $state<MisijaDto | null>(null);
  let registriran = $state(false);
  let generacija = 0;
  let zadnjaVerzija = 0;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingIdempotency: { dodjelaId: string; key: string } | null = null;

  function primijeniStanje(novo: StanjeMisijaDto, ocekivanaGeneracija: number) {
    if (ocekivanaGeneracija !== generacija) return;
    if (novo.stanjeVerzija < zadnjaVerzija) return;
    zadnjaVerzija = novo.stanjeVerzija;
    stanje = novo;
    rasporediRefresh(novo);
  }

  function rasporediRefresh(s: StanjeMisijaDto) {
    if (refreshTimer) clearTimeout(refreshTimer);
    const kandidati = [
      Date.parse(s.dnevne.sljedeciDotokU),
      Date.parse(s.zamjene.dnevna.obnovaU),
      Date.parse(s.zamjene.tjedna.obnovaU),
      Date.parse(s.tjedne.krajIso),
    ].filter((t) => Number.isFinite(t) && t > Date.now());
    const najblizi = kandidati.length ? Math.min(...kandidati) : null;
    if (najblizi === null) return;
    const delay = Math.min(Math.max(najblizi - Date.now() + 250, 1_000), 6 * 60 * 60 * 1000);
    refreshTimer = setTimeout(() => {
      void ucitaj();
    }, delay);
  }

  async function ucitaj(opts: { tiho?: boolean } = {}) {
    const ova = generacija;
    if (!opts.tiho) {
      ucitava = true;
      greska = null;
    }
    try {
      const novo = await dohvatiStanjeMisija();
      primijeniStanje(novo, ova);
      if (ova === generacija) greska = null;
    } catch (e) {
      if (ova !== generacija) return;
      if (e instanceof ApiGreska && e.status === 403) {
        registriran = false;
        stanje = null;
        greska = null;
      } else if (e instanceof ApiGreska && e.status === 401) {
        registriran = false;
        stanje = null;
        greska = porukaZaKodMisije(e.kod, e.message);
      } else {
        greska = e instanceof ApiGreska
          ? porukaZaKodMisije(e.kod, e.message)
          : 'Misije trenutačno nisu dostupne.';
      }
    } finally {
      if (ova === generacija) ucitava = false;
    }
  }

  function zatraziOsvjezenje() {
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => {
      void ucitaj({ tiho: true });
    }, 300);
  }

  function formatirajVrijeme(iso: string): string {
    try {
      return new Intl.DateTimeFormat('hr-HR', {
        timeZone: 'Europe/Zagreb',
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function tekstDotoka(s: StanjeMisijaDto): string {
    const n = s.dnevne.aktivne.length;
    if (n === 0) return 'Sve spremljene dnevne misije su završene. Nova stiže u ponoć.';
    if (n >= 3) return 'Sačuvane su tri misije. Dovrši jednu kako bi u idućoj ponoći bilo mjesta za novu.';
    return `Svake ponoći dobivaš jednu novu misiju dok ima mjesta. Sljedeća: ${formatirajVrijeme(s.dnevne.sljedeciDotokU)}.`;
  }

  function tekstZamjene(vrsta: VrstaMisije, s: StanjeMisijaDto): string {
    const kvota = s.zamjene[vrsta];
    if (kvota.preostalo === 0) {
      return `Današnja zamjena je iskorištena. Nova je dostupna u ponoć (${formatirajVrijeme(kvota.obnovaU)}).`;
    }
    return 'Zamjene danas: 1';
  }

  function otvoriPotvrdu(misija: MisijaDto) {
    if (zamjenaUTijeku) return;
    potvrdaZamjene = misija;
  }

  async function potvrdiZamjenu() {
    const misija = potvrdaZamjene;
    if (!misija || zamjenaUTijeku) return;
    potvrdaZamjene = null;
    zamjenaUTijeku = misija.vrsta;
    statusPoruka = null;
    const key = pendingIdempotency?.dodjelaId === misija.dodjelaId
      ? pendingIdempotency.key
      : noviIdempotencyKey();
    pendingIdempotency = { dodjelaId: misija.dodjelaId, key };
    const ova = generacija;
    try {
      let novo = await zamijeniMisiju(misija.dodjelaId, key);
      try {
        novo = await oznaciPregledMisija(misija.vrsta);
      } catch {
        // Zamjena je uspjela; pregled je best-effort da home popup ne bljesne.
      }
      if (ova === generacija) {
        primijeniStanje(novo, ova);
        statusPoruka = 'Misija zamijenjena.';
        pendingIdempotency = null;
      }
    } catch (e) {
      if (ova !== generacija) return;
      if (e instanceof ApiGreska && (e.kod === 'MREZA' || e.status === 0 || e.status >= 500)) {
        statusPoruka = porukaZaKodMisije(e.kod, e.message);
        await ucitaj({ tiho: true });
      } else {
        pendingIdempotency = null;
        statusPoruka = e instanceof ApiGreska
          ? porukaZaKodMisije(e.kod, e.message)
          : 'Zamjena nije uspjela.';
        await ucitaj({ tiho: true });
      }
    } finally {
      if (ova === generacija) zamjenaUTijeku = null;
    }
  }

  onMount(() => {
    registriran = jeRegistriranKorisnik();
    if (registriran) void ucitaj();
    else ucitava = false;

    const naIdentitet = () => {
      generacija += 1;
      zadnjaVerzija = 0;
      stanje = null;
      statusPoruka = null;
      potvrdaZamjene = null;
      zamjenaUTijeku = null;
      pendingIdempotency = null;
      registriran = jeRegistriranKorisnik();
      if (registriran) void ucitaj();
      else {
        ucitava = false;
        greska = null;
      }
    };
    const naVidljivost = () => {
      if (document.visibilityState === 'visible' && jeRegistriranKorisnik()) zatraziOsvjezenje();
    };
    const naFokus = () => {
      if (jeRegistriranKorisnik()) zatraziOsvjezenje();
    };

    window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);
    document.addEventListener('visibilitychange', naVidljivost);
    window.addEventListener('focus', naFokus);
    return () => {
      window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
      document.removeEventListener('visibilitychange', naVidljivost);
      window.removeEventListener('focus', naFokus);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (coalesceTimer) clearTimeout(coalesceTimer);
    };
  });

  const dnevneMjesta = $derived.by(() => {
    if (!stanje) return [] as Array<MisijaDto | null>;
    const poSlotu = new Map(stanje.dnevne.aktivne.map((m) => [m.slot, m]));
    return [1, 2, 3].map((slot) => poSlotu.get(slot as 1 | 2 | 3) ?? null);
  });
  const prviPrazniDnevni = $derived(dnevneMjesta.findIndex((m) => m === null));

  const tjedneKartice = $derived(
    stanje ? [...stanje.tjedne.misije].sort((a, b) => a.slot - b.slot) : [],
  );
  const tjedneDovrsene = $derived(tjedneKartice.filter((m) => m.status === 'dovrsena').length);
</script>

<svelte:head>
  <title>Misije | Kaladont</title>
</svelte:head>

<main class="misije-stranica">
  <header class="naslov">
    <h1>Misije</h1>
    <p>Igraj, isprobaj različite izazove i skupljaj iskustvo.</p>
  </header>

  {#if !registriran}
    <section class="gost" aria-labelledby="gost-naslov">
      <h2 id="gost-naslov">Misije za registrirane igrače</h2>
      <p>Dnevne i tjedne misije prate tvoj napredak i dodjeljuju XP. Prijavi se ili otvori račun.</p>
      <div class="gost-akcije">
        <a href="/prijava" class="gumb">Prijavi se</a>
        <a href="/registracija" class="gumb sekundarni">Registriraj se</a>
      </div>
    </section>
  {:else if ucitava && !stanje}
    <p class="ucitavanje" role="status">Učitavanje misija…</p>
  {:else if greska && !stanje}
    <p class="greska" role="alert">{greska}</p>
    <button type="button" class="gumb" onclick={() => ucitaj()}>Pokušaj ponovno</button>
  {:else if stanje}
    {#if stanje.obracunUTijeku}
      <p class="upozorenje" role="status">Napredak se još sprema.</p>
    {/if}
    {#if statusPoruka}
      <p class="status" role="status">{statusPoruka}</p>
    {/if}
    {#if greska}
      <p class="greska" role="alert">{greska}</p>
    {/if}

    <section class="sekcija" aria-labelledby="dnevne-naslov">
      <div class="sekcija-zaglavlje">
        <h2 id="dnevne-naslov">Dnevne misije</h2>
        <p class="meta">{stanje.dnevne.aktivne.length} / 3 sačuvane</p>
      </div>
      <p class="meta">{tekstDotoka(stanje)}</p>
      <p class="meta">{tekstZamjene('dnevna', stanje)}</p>
      <div class="mreza">
        {#each dnevneMjesta as misija, i (misija?.dodjelaId ?? `prazno-${i}`)}
          {#if misija}
            <KarticaMisije
              {misija}
              zamjenaBlokirana={zamjenaUTijeku === 'dnevna' || stanje.zamjene.dnevna.preostalo === 0}
              onZamijeni={otvoriPotvrdu}
            />
          {:else}
            <div class="prazno-mjesto" aria-label={`Prazno dnevno mjesto ${i + 1}`}>
              {#if stanje.dnevne.aktivne.length < 3 && i === prviPrazniDnevni}
                <p>Nova misija u ponoć</p>
                <small>{formatirajVrijeme(stanje.dnevne.sljedeciDotokU)}</small>
              {:else}
                <p>Slobodno mjesto</p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
      {#if stanje.dnevne.danasDovrsene.length > 0}
        <div class="danas-dovrseno">
          <h3>Danas dovršeno</h3>
          <ul>
            {#each stanje.dnevne.danasDovrsene as misija (misija.dodjelaId)}
              <li>
                <strong>{misija.naziv}</strong>
                {#if misija.nagrada}
                  <span>+{misija.nagrada.xpStvarnoDodijeljeno.toLocaleString('hr-HR')} XP</span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <section class="sekcija" aria-labelledby="tjedne-naslov">
      <div class="sekcija-zaglavlje">
        <h2 id="tjedne-naslov">Tjedne misije</h2>
        <p class="meta">{tjedneDovrsene} / 3 završene</p>
      </div>
      <p class="meta">
        Nove tjedne: ponedjeljak, 00:00 ({formatirajVrijeme(stanje.tjedne.krajIso)}).
      </p>
      <p class="meta">{tekstZamjene('tjedna', stanje)}</p>
      {#if tjedneDovrsene === 3}
        <p class="meta">Tjedne misije su završene. Nove stižu u ponedjeljak u 00:00.</p>
      {/if}
      <div class="mreza">
        {#each tjedneKartice as misija (misija.dodjelaId)}
          <KarticaMisije
            {misija}
            zamjenaBlokirana={zamjenaUTijeku === 'tjedna' || stanje.zamjene.tjedna.preostalo === 0}
            onZamijeni={otvoriPotvrdu}
          />
        {/each}
      </div>
    </section>

    <p class="napomena">
      Napredak se potvrđuje nakon spremanja igre. Trening vrijedi samo na misijama označenim „Zagrijavanje”.
      <a href="/pravila-kaladonta">Pravila</a>
    </p>
  {/if}
</main>

{#if potvrdaZamjene}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-podloga" role="presentation" onclick={() => (potvrdaZamjene = null)}>
    <div
      class="modal-sadrzaj"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zamjena-naslov"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (potvrdaZamjene = null)}
    >
      <h2 id="zamjena-naslov">Zamijeniti ovu misiju?</h2>
      <p>
        Napredak će biti izgubljen. Današnja zamjena za ovu skupinu bit će iskorištena.
      </p>
      <div class="modal-akcije">
        <button type="button" class="gumb" onclick={potvrdiZamjenu}>Zamijeni</button>
        <button type="button" class="gumb sekundarni" onclick={() => (potvrdaZamjene = null)}>Odustani</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .misije-stranica {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 16px 48px;
    display: grid;
    gap: 28px;
  }
  .naslov h1 {
    margin: 0 0 8px;
    color: var(--boja-isticanje-tekst);
  }
  .naslov p,
  .meta,
  .napomena,
  .ucitavanje {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .sekcija {
    display: grid;
    gap: 12px;
  }
  .sekcija-zaglavlje {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .sekcija-zaglavlje h2 {
    margin: 0;
  }
  .mreza {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr;
  }
  @media (min-width: 700px) {
    .mreza {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1000px) {
    .mreza {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .prazno-mjesto {
    min-height: 160px;
    border: 1px dashed var(--boja-obrub);
    border-radius: 10px;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 4px;
    color: var(--boja-tekst-sekundarni);
    padding: 16px;
  }
  .prazno-mjesto p {
    margin: 0;
    font-weight: 600;
  }
  .danas-dovrseno h3 {
    margin: 0 0 8px;
  }
  .danas-dovrseno ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }
  .danas-dovrseno li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--boja-tekst-sekundarni);
  }
  .gost {
    display: grid;
    gap: 12px;
    padding: 20px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
  }
  .gost h2 {
    margin: 0;
  }
  .gost-akcije,
  .modal-akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid var(--boja-cta-pozadina);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    text-decoration: none;
    font-weight: 700;
    cursor: pointer;
  }
  .gumb.sekundarni {
    background: transparent;
    color: var(--boja-tekst-osnovni);
    border-color: var(--boja-obrub-jaci);
  }
  .greska {
    color: var(--boja-crvena);
  }
  .status,
  .upozorenje {
    color: var(--boja-isticanje-tekst);
    font-weight: 600;
  }
  .modal-podloga {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 80;
  }
  .modal-sadrzaj {
    width: min(420px, 100%);
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    padding: 20px;
    display: grid;
    gap: 12px;
  }
  .modal-sadrzaj h2,
  .modal-sadrzaj p {
    margin: 0;
  }
</style>
