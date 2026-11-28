<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CircleHelp, Clock, X } from 'lucide-svelte';
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
  import {
    dostupniXp,
    dnevniBrojac,
    formatirajXp,
    relativnoDo,
    tekstSlobodnihMjesta,
    tekstZamjenaPreostalo,
    tjedniBrojac,
  } from '$lib/misije-prikaz.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  let stanje = $state<StanjeMisijaDto | null>(null);
  let ucitava = $state(true);
  let greska = $state<string | null>(null);
  let statusPoruka = $state<string | null>(null);
  let zamjenaUTijeku = $state<VrstaMisije | null>(null);
  let potvrdaZamjene = $state<MisijaDto | null>(null);
  let registriran = $state(false);
  let infoOtvoreno = $state(false);
  let generacija = 0;
  let zadnjaVerzija = 0;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  let minuteTimer: ReturnType<typeof setInterval> | null = null;
  let pendingIdempotency: { dodjelaId: string; key: string } | null = null;
  let sadaZaPrikaz = $state(Date.now());
  let infoGumb = $state<HTMLButtonElement | undefined>(undefined);
  let infoDijalog = $state<HTMLDivElement | undefined>(undefined);

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
      let novo = await dohvatiStanjeMisija();
      // Posjet /misije gasi „nove” zastavice (toast više nije potreban).
      if (novo.novosti.dnevne) {
        try { novo = await oznaciPregledMisija('dnevna'); } catch { /* best-effort */ }
      }
      if (novo.novosti.tjedne) {
        try { novo = await oznaciPregledMisija('tjedna'); } catch { /* best-effort */ }
      }
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

  async function otvoriInfo() {
    infoOtvoreno = true;
    await tick();
    infoDijalog?.focus();
  }

  function zatvoriInfo() {
    infoOtvoreno = false;
    infoGumb?.focus();
  }

  onMount(() => {
    registriran = jeRegistriranKorisnik();
    if (registriran) void ucitaj();
    else ucitava = false;

    minuteTimer = setInterval(() => {
      sadaZaPrikaz = Date.now();
    }, 60_000);

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
      if (document.visibilityState === 'visible' && jeRegistriranKorisnik()) {
        sadaZaPrikaz = Date.now();
        zatraziOsvjezenje();
      }
    };
    const naFokus = () => {
      if (jeRegistriranKorisnik()) {
        sadaZaPrikaz = Date.now();
        zatraziOsvjezenje();
      }
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
      if (minuteTimer) clearInterval(minuteTimer);
    };
  });

  const dnevneMjesta = $derived.by(() => {
    if (!stanje) return [] as Array<MisijaDto | null>;
    const poSlotu = new Map(stanje.dnevne.aktivne.map((m) => [m.slot, m]));
    return [1, 2, 3].map((slot) => poSlotu.get(slot as 1 | 2 | 3) ?? null);
  });
  const prviPrazniDnevni = $derived(dnevneMjesta.findIndex((m) => m === null));
  const brojPraznihDnevnih = $derived(dnevneMjesta.filter((m) => m === null).length);
  const svaDnevnaMjestaPopunjena = $derived(!!stanje && stanje.dnevne.aktivne.length >= 3);

  const tjedneKartice = $derived(
    stanje ? [...stanje.tjedne.misije].sort((a, b) => a.slot - b.slot) : [],
  );

  const dnevni = $derived(stanje ? dnevniBrojac(stanje) : null);
  const tjedni = $derived(stanje ? tjedniBrojac(stanje) : null);
  const xpDostupno = $derived(stanje ? dostupniXp(stanje) : null);
  const sada = $derived(new Date(sadaZaPrikaz));
</script>

<svelte:head>
  <title>Misije | Kaladont</title>
</svelte:head>

<main class="misije-stranica">
  <header class="naslov">
    <div class="naslov-red">
      <h1>Misije</h1>
      <button
        type="button"
        class="info-gumb"
        aria-label="Pravila misija"
        aria-expanded={infoOtvoreno}
        aria-controls="misije-info-dijalog"
        bind:this={infoGumb}
        onclick={() => (infoOtvoreno ? zatvoriInfo() : otvoriInfo())}
      >
        <CircleHelp size={20} aria-hidden="true" />
      </button>
    </div>
    <p>Ispuni zadatke, skupljaj XP i napreduj.</p>
  </header>

  {#if !registriran}
    <section class="gost" aria-labelledby="gost-naslov">
      <h2 id="gost-naslov">Misije za registrirane igrače</h2>
      <p>Dnevne i tjedne misije prate tvoj napredak i dodjeljuju XP. Prijavi se ili otvori račun.</p>
      <div class="gost-akcije">
        <a
          href="/prijava"
          class="gumb"
          onclick={() => zabiljeziUmamiDogadjaj('prijava-klik', { izvor: 'misije' })}
        >Prijavi se</a>
        <a
          href="/registracija"
          class="gumb sekundarni"
          onclick={() => zabiljeziUmamiDogadjaj('registracija-klik', { izvor: 'misije' })}
        >Registriraj se</a>
      </div>
    </section>
  {:else if ucitava && !stanje}
    <p class="ucitavanje" role="status">Učitavanje misija…</p>
  {:else if greska && !stanje}
    <p class="greska" role="alert">{greska}</p>
    <button type="button" class="gumb" onclick={() => ucitaj()}>Pokušaj ponovno</button>
  {:else if stanje && dnevni && tjedni && xpDostupno !== null}
    {#if stanje.obracunUTijeku}
      <p class="upozorenje" role="status">Napredak se još sprema.</p>
    {/if}
    {#if statusPoruka}
      <p class="status" role="status">{statusPoruka}</p>
    {/if}
    {#if greska}
      <p class="greska" role="alert">{greska}</p>
    {/if}

    <section class="pregled" aria-label="Pregled napretka misija">
      <div class="pregled-stavka">
        <span class="pregled-oznaka">Danas završeno</span>
        <strong>{dnevni.zavrseno} / {dnevni.ukupno}</strong>
      </div>
      <div class="pregled-stavka">
        <span class="pregled-oznaka">Ovaj tjedan</span>
        <strong>{tjedni.zavrseno} / {tjedni.ukupno}</strong>
      </div>
      <div class="pregled-stavka">
        <span class="pregled-oznaka">Dostupno za osvojiti</span>
        <strong class="xp-vrijednost">{formatirajXp(xpDostupno)} XP</strong>
      </div>
    </section>

    <section class="sekcija" aria-labelledby="dnevne-naslov">
      <div class="sekcija-zaglavlje">
        <h2 id="dnevne-naslov">Dnevne misije</h2>
        <p class="meta">{stanje.dnevne.aktivne.length} / 3 sačuvane</p>
      </div>
      <div class="sekcija-meta">
        {#if svaDnevnaMjestaPopunjena}
          <p class="meta">Sva mjesta su popunjena. Dovrši jednu kako bi u idućoj ponoći bilo mjesta za novu.</p>
        {:else}
          <p class="meta">
            Nova misija {relativnoDo(stanje.dnevne.sljedeciDotokU, sada)}
            <span class="meta-tocno">({formatirajVrijeme(stanje.dnevne.sljedeciDotokU)})</span>
          </p>
        {/if}
        <p class="meta">{tekstZamjenaPreostalo(stanje.zamjene.dnevna.preostalo)}</p>
      </div>

      <div class="mreza mreza-dnevne">
        {#each dnevneMjesta as misija, i (misija?.dodjelaId ?? `prazno-${i}`)}
          {#if misija}
            <KarticaMisije
              {misija}
              zamjenaBlokirana={zamjenaUTijeku === 'dnevna' || stanje.zamjene.dnevna.preostalo === 0}
              onZamijeni={otvoriPotvrdu}
            />
          {:else}
            <div class="prazno-mjesto prazno-desktop" aria-label={`Prazno dnevno mjesto ${i + 1}`}>
              {#if !svaDnevnaMjestaPopunjena && i === prviPrazniDnevni}
                <Clock size={22} aria-hidden="true" />
                <p>Sljedeća misija</p>
                <small>Nova misija u ponoć</small>
                <small>{formatirajVrijeme(stanje.dnevne.sljedeciDotokU)}</small>
              {:else}
                <p>Slobodno mjesto</p>
                <small>Za buduću misiju</small>
              {/if}
            </div>
          {/if}
        {/each}
        {#if brojPraznihDnevnih > 0}
          <div class="prazno-kompaktno" aria-label="Informacije o slobodnim dnevnim mjestima">
            <span>Nova misija {relativnoDo(stanje.dnevne.sljedeciDotokU, sada)}</span>
            <span aria-hidden="true">·</span>
            <span>{tekstSlobodnihMjesta(brojPraznihDnevnih)}</span>
          </div>
        {/if}
      </div>

      {#if stanje.dnevne.danasDovrsene.length > 0}
        <div class="danas-dovrseno">
          <h3>Danas dovršeno</h3>
          <ul>
            {#each stanje.dnevne.danasDovrsene as misija (misija.dodjelaId)}
              <li>
                <strong>{misija.naziv}</strong>
                {#if misija.nagrada}
                  <span>+{formatirajXp(misija.nagrada.xpStvarnoDodijeljeno)} XP</span>
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
        <p class="meta">{tjedni.zavrseno} / 3 završene</p>
      </div>
      <div class="sekcija-meta">
        <p class="meta">
          Nove misije {relativnoDo(stanje.tjedne.krajIso, sada)}
          <span class="meta-tocno">({formatirajVrijeme(stanje.tjedne.krajIso)})</span>
        </p>
        <p class="meta">{tekstZamjenaPreostalo(stanje.zamjene.tjedna.preostalo)}</p>
      </div>
      {#if tjedni.zavrseno === 3}
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
      Napredak se potvrđuje nakon spremanja igre. Trening se računa samo za misije koje ga dopuštaju.
      <a href="/pravila-kaladonta">Pravila</a>
    </p>
  {/if}
</main>

{#if infoOtvoreno}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-podloga" role="presentation" onclick={zatvoriInfo}>
    <div
      id="misije-info-dijalog"
      class="modal-sadrzaj"
      role="dialog"
      aria-modal="true"
      aria-labelledby="misije-info-naslov"
      tabindex="-1"
      bind:this={infoDijalog}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && zatvoriInfo()}
    >
      <div class="modal-zaglavlje">
        <h2 id="misije-info-naslov">Kako rade misije</h2>
        <button type="button" class="info-zatvori" aria-label="Zatvori" onclick={zatvoriInfo}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <ul class="info-lista">
        <li>Svake ponoći dobivaš jednu novu dnevnu misiju dok imaš slobodno mjesto (najviše tri).</li>
        <li>Tjedne misije obnavljaju se ponedjeljkom u 00:00 (Europe/Zagreb).</li>
        <li>Jednom dnevno možeš zamijeniti jednu dnevnu i jednu tjednu misiju; napredak zamijenjene se gubi.</li>
        <li>Napredak i XP potvrđuju se nakon spremanja igre.</li>
        <li>Trening se računa samo za misije koje ga dopuštaju. Privatne sobe ne napreduju misije.</li>
      </ul>
      <p class="info-link">
        <a href="/pravila-kaladonta">Otvori pravila Kaladonta</a>
      </p>
    </div>
  </div>
{/if}

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
        Dosadašnji napredak ove misije bit će izgubljen. Iskoristit ćeš jednu dostupnu zamjenu za ovu skupinu.
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
  .naslov-red {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .naslov h1 {
    margin: 0;
    color: var(--boja-isticanje-tekst);
  }
  .naslov p,
  .meta,
  .napomena,
  .ucitavanje {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .info-gumb,
  .info-zatvori {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--boja-obrub);
    border-radius: 999px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-sekundarni);
    cursor: pointer;
  }
  .info-gumb:hover,
  .info-zatvori:hover {
    color: var(--boja-isticanje-tekst);
    border-color: var(--boja-isticanje-tekst);
  }
  .pregled {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    background: var(--boja-povrsina-2);
  }
  @media (min-width: 700px) {
    .pregled {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
  }
  .pregled-stavka {
    display: grid;
    gap: 4px;
  }
  .pregled-oznaka {
    color: var(--boja-tekst-sekundarni);
    font-size: 0.9rem;
  }
  .pregled-stavka strong {
    font-size: 1.25rem;
    color: var(--boja-tekst);
  }
  .xp-vrijednost {
    color: var(--boja-isticanje-tekst) !important;
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
  .sekcija-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 16px;
  }
  .meta-tocno {
    opacity: 0.85;
  }
  .mreza {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr;
    align-items: stretch;
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
    place-content: center;
    justify-items: center;
    text-align: center;
    gap: 4px;
    color: var(--boja-tekst-sekundarni);
    padding: 16px;
    background: transparent;
  }
  .prazno-mjesto p {
    margin: 0;
    font-weight: 600;
  }
  .prazno-desktop {
    display: none;
  }
  .prazno-kompaktno {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 12px 14px;
    border: 1px dashed var(--boja-obrub);
    border-radius: 10px;
    color: var(--boja-tekst-sekundarni);
    font-size: 0.95rem;
  }
  @media (min-width: 700px) {
    .prazno-desktop {
      display: grid;
    }
    .prazno-kompaktno {
      display: none;
    }
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
    width: min(440px, 100%);
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    padding: 20px;
    display: grid;
    gap: 12px;
  }
  .modal-zaglavlje {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .modal-sadrzaj h2,
  .modal-sadrzaj p {
    margin: 0;
  }
  .info-lista {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 8px;
    color: var(--boja-tekst-sekundarni);
  }
  .info-link {
    margin: 0;
  }
</style>
