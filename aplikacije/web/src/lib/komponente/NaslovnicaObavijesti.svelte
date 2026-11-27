<script lang="ts">
  import { onMount } from 'svelte';
  import type { SanducicPorukaDetalj } from 'zajednicko';
  import { api } from '$lib/api.js';
  import {
    indeksNakonUklanjanja,
    relativnoVrijemeObavijesti,
    tekstPozicijePagera,
  } from '$lib/naslovnica-obavijesti.js';
  import { povuciListanjeOkomito } from '$lib/povuci-klizac.js';
  import {
    dohvatiStanjeSanducica,
    oznaciSanducicProcitane,
  } from '$lib/stanje-sanducica.svelte.js';
  import {
    osigurajNaslovnicaSazetak,
    potrosiPocetnuListuObavijesti,
  } from '$lib/stanje-naslovnica.svelte.js';

  const DESKTOP_MQ = '(min-width: 1000px)';
  const LIMIT = 20;

  const stanje = dohvatiStanjeSanducica();

  let poruke = $state<SanducicPorukaDetalj[]>([]);
  let indeks = $state(0);
  let sljedeciCursor = $state<string | null>(null);
  let ucitavanje = $state(true);
  let ucitavanjeStranice = $state(false);
  let greska = $state<string | null>(null);
  let oznacavanjeId = $state<string | null>(null);
  let aktivan = $state(false);
  let zahtjevGen = 0;
  let zadnjaRevizija = -1;
  let povrsina: HTMLDivElement | undefined = $state();

  const aktivna = $derived(poruke[indeks] ?? null);
  const imaNavigaciju = $derived(poruke.length > 1 || sljedeciCursor != null);
  const mozeGore = $derived(indeks > 0);
  const mozeDolje = $derived(indeks < poruke.length - 1 || sljedeciCursor != null);
  const pozicija = $derived(
    imaNavigaciju ? tekstPozicijePagera(indeks, poruke.length, sljedeciCursor != null) : '',
  );
  const ariaStatus = $derived(
    aktivna
      ? `${aktivna.naslov}. ${aktivna.tekst}. ${relativnoVrijemeObavijesti(aktivna.stvorenaAt)}.`
      : greska ?? (ucitavanje ? 'Učitavanje obavijesti.' : 'Nema novih obavijesti.'),
  );

  function ocistiLokalno(): void {
    poruke = [];
    indeks = 0;
    sljedeciCursor = null;
    greska = null;
    ucitavanje = false;
    ucitavanjeStranice = false;
    oznacavanjeId = null;
  }

  async function dohvatiListu(reset: boolean): Promise<void> {
    // Generaciju povećaj tek kad stvarno kreće zahtjev — inače early return
    // invalidira in-flight page fetch i zaključa strelice.
    if (!reset) {
      if (!sljedeciCursor || ucitavanjeStranice) return;
    }
    const gen = ++zahtjevGen;
    if (reset) {
      ucitavanje = true;
      greska = null;

      // Prvi reset: iskoristi listu iz /naslovnica/sazetak ako je dostupna.
      await osigurajNaslovnicaSazetak();
      if (gen !== zahtjevGen || !aktivan) return;
      const pocetna = potrosiPocetnuListuObavijesti();
      if (pocetna) {
        const stariId = poruke[indeks]?.id ?? null;
        poruke = pocetna.poruke.filter((p) => !p.procitano);
        sljedeciCursor = pocetna.sljedeciCursor;
        if (stariId) {
          const idx = poruke.findIndex((p) => p.id === stariId);
          indeks = idx >= 0 ? idx : 0;
        } else {
          indeks = 0;
        }
        zadnjaRevizija = stanje.revizija;
        ucitavanje = false;
        return;
      }
    } else {
      ucitavanjeStranice = true;
    }

    try {
      const params = new URLSearchParams();
      params.set('filter', 'neprocitane');
      params.set('limit', String(LIMIT));
      if (!reset && sljedeciCursor) params.set('cursor', sljedeciCursor);

      const odgovor = await api<{
        ok: true;
        poruke: SanducicPorukaDetalj[];
        sljedeciCursor: string | null;
      }>(`/sanducic?${params.toString()}`);

      if (gen !== zahtjevGen || !aktivan) return;

      const nove = odgovor.poruke.filter((p) => !p.procitano);
      if (reset) {
        const stariId = poruke[indeks]?.id ?? null;
        poruke = nove;
        sljedeciCursor = odgovor.sljedeciCursor;
        if (stariId) {
          const idx = poruke.findIndex((p) => p.id === stariId);
          indeks = idx >= 0 ? idx : 0;
        } else {
          indeks = 0;
        }
      } else {
        const poznati = new Set(poruke.map((p) => p.id));
        const dodaci = nove.filter((p) => !poznati.has(p.id));
        poruke = [...poruke, ...dodaci];
        sljedeciCursor = odgovor.sljedeciCursor;
        if (dodaci.length > 0) {
          indeks = Math.min(poruke.length - 1, poruke.findIndex((p) => p.id === dodaci[0]!.id));
        }
      }
      zadnjaRevizija = stanje.revizija;
    } catch {
      if (gen !== zahtjevGen || !aktivan) return;
      if (reset) {
        greska = 'Obavijesti trenutačno nisu dostupne.';
        poruke = [];
        sljedeciCursor = null;
      }
    } finally {
      if (gen === zahtjevGen) {
        ucitavanje = false;
        ucitavanjeStranice = false;
      }
    }
  }

  function idiNovija(): void {
    if (indeks > 0) indeks -= 1;
  }

  async function idiStarija(): Promise<void> {
    if (indeks < poruke.length - 1) {
      indeks += 1;
      return;
    }
    if (sljedeciCursor) await dohvatiListu(false);
  }

  async function oznaciProcitano(): Promise<void> {
    const poruka = aktivna;
    if (!poruka || oznacavanjeId) return;
    oznacavanjeId = poruka.id;
    try {
      await oznaciSanducicProcitane([poruka.id]);
      if (!aktivan) return;
      const stari = indeks;
      const ukupno = poruke.length;
      poruke = poruke.filter((p) => p.id !== poruka.id);
      indeks = indeksNakonUklanjanja(stari, ukupno);
      if (poruke.length === 0) sljedeciCursor = null;
    } catch {
      // Ostaje nepročitana; korisnik može ponoviti.
    } finally {
      if (oznacavanjeId === poruka.id) oznacavanjeId = null;
    }
  }

  function naTipku(dogadaj: KeyboardEvent): void {
    if (dogadaj.key === 'ArrowUp') {
      dogadaj.preventDefault();
      idiNovija();
    } else if (dogadaj.key === 'ArrowDown') {
      dogadaj.preventDefault();
      void idiStarija();
    }
  }

  onMount(() => {
    const mq = window.matchMedia(DESKTOP_MQ);

    const postaviAktivnost = () => {
      const treba = mq.matches;
      if (treba === aktivan) return;
      aktivan = treba;
      if (!treba) {
        zahtjevGen += 1;
        ocistiLokalno();
        return;
      }
      void dohvatiListu(true);
    };

    postaviAktivnost();
    mq.addEventListener('change', postaviAktivnost);

    return () => {
      aktivan = false;
      zahtjevGen += 1;
      mq.removeEventListener('change', postaviAktivnost);
      ocistiLokalno();
    };
  });

  $effect(() => {
    if (!aktivan) return;
    const rev = stanje.revizija;
    if (rev === zadnjaRevizija) return;
    // Prvo učitavanje ide iz onMount; kasnije revizije osvježavaju listu.
    if (zadnjaRevizija < 0) {
      zadnjaRevizija = rev;
      return;
    }
    void dohvatiListu(true);
  });

  $effect(() => {
    const el = povrsina;
    if (!el || !aktivna) return;
    return povuciListanjeOkomito(el, {
      prethodni: idiNovija,
      sljedeci: () => {
        void idiStarija();
      },
      prag: 40,
    }).destroy;
  });
</script>

{#if aktivan}
  <section
    class="naslovnica-obavijesti"
    data-testid="naslovnica-obavijesti"
    aria-label="Pregled obavijesti"
  >
    {#if ucitavanje && poruke.length === 0}
      <p class="stanje">Učitavanje…</p>
    {:else if greska && poruke.length === 0}
      <div class="prazno">
        <p class="prazno-naslov">{greska}</p>
        <a class="vidi-sve" href="/obavijesti">Vidi starije obavijesti ›</a>
      </div>
    {:else if !aktivna}
      <div class="prazno" data-testid="naslovnica-obavijesti-prazno">
        <div class="prazno-tekst">
          <p class="prazno-naslov">Nema novih obavijesti</p>
          <a class="vidi-sve" href="/obavijesti">Vidi starije obavijesti ›</a>
        </div>
      </div>
    {:else}
      <div
        class="pager"
        bind:this={povrsina}
        tabindex="0"
        role="group"
        aria-label="Nepročitane obavijesti"
        onkeydown={naTipku}
      >
        <div class="sadrzaj">
          <div class="tekst">
            <div class="naslovni-red">
              <span class="tockica" aria-hidden="true"></span>
              <a class="naslov-poruke" href={`/obavijesti?id=${aktivna.id}`}>{aktivna.naslov}</a>
            </div>
            <p class="opis">{aktivna.tekst}</p>
            <div class="meta">
              <time datetime={aktivna.stvorenaAt}>{relativnoVrijemeObavijesti(aktivna.stvorenaAt)}</time>
            </div>
            <button
              type="button"
              class="oznaci"
              disabled={oznacavanjeId === aktivna.id}
              onclick={() => void oznaciProcitano()}
            >
              Označi pročitanim
            </button>
          </div>
        </div>

        {#if imaNavigaciju}
          <div class="strelice" aria-hidden={false}>
            <button
              type="button"
              class="strelica"
              aria-label="Novija obavijest"
              title="Novija obavijest"
              disabled={!mozeGore}
              onclick={idiNovija}
            >
              <span aria-hidden="true">▲</span>
            </button>
            {#if pozicija}
              <span class="pozicija" aria-hidden="true">{pozicija}</span>
            {/if}
            <button
              type="button"
              class="strelica"
              aria-label="Starija obavijest"
              title="Starija obavijest"
              disabled={!mozeDolje || ucitavanjeStranice}
              onclick={() => void idiStarija()}
            >
              <span aria-hidden="true">▼</span>
            </button>
          </div>
        {:else}
          <div class="strelice strelice--rezerva" aria-hidden="true"></div>
        {/if}
      </div>
      <span class="sr-only" aria-live="polite">{ariaStatus}</span>
    {/if}
  </section>
{/if}

<style>
  .naslovnica-obavijesti {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 88px;
    box-sizing: border-box;
    padding-left: 20px;
    border-left: 1px solid color-mix(in srgb, #fff 16%, transparent);
    text-align: left;
    touch-action: pan-y;
  }

  :global(html[data-tema='svijetla']) .naslovnica-obavijesti {
    border-left-color: color-mix(in srgb, var(--boja-mint) 28%, transparent);
  }

  .pager {
    display: flex;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    min-width: 0;
    outline: none;
  }

  .pager:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 8px;
  }

  .sadrzaj {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .tekst {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-align: left;
  }

  .naslovni-red {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .tockica {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--boja-zuta-krema, #f0d878);
  }

  .naslov-poruke {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-tijelo);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .naslov-poruke:hover {
    text-decoration: underline;
  }

  .naslov-poruke:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .opis {
    margin: 0;
    width: 100%;
    overflow: hidden;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    gap: 4px 6px;
    margin-top: 2px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    color: color-mix(in srgb, var(--boja-tekst-sekundarni) 88%, transparent);
    font-family: var(--font-tijelo);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.2;
    text-align: left;
  }

  .meta time {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .oznaci {
    flex: 0 0 auto;
    align-self: flex-start;
    margin: 2px 0 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--boja-akcent-tekst, var(--boja-zuta-krema));
    cursor: pointer;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
  }

  .oznaci:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .oznaci:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .strelice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .strelice--rezerva {
    width: 36px;
  }

  .pozicija {
    flex: 0 0 auto;
    min-width: 2.5em;
    color: color-mix(in srgb, var(--boja-tekst-sekundarni) 80%, transparent);
    font-family: var(--font-tijelo);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
  }

  .strelica {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
  }

  .strelica:hover:not(:disabled) {
    color: var(--boja-tekst-osnovni);
    background: color-mix(in srgb, #fff 8%, transparent);
  }

  .strelica:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .strelica:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 1px;
  }

  .stanje,
  .prazno-naslov {
    margin: 0;
    overflow: hidden;
    color: var(--boja-tekst-sekundarni);
    font-family: var(--font-tijelo);
    font-size: 18px;
    font-weight: 500;
    line-height: 1.3;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prazno {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    text-align: center;
  }

  .prazno-tekst {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
    text-align: center;
  }

  .vidi-sve {
    width: fit-content;
    max-width: 100%;
    overflow: hidden;
    color: var(--boja-akcent-tekst, var(--boja-zuta-krema));
    font-family: var(--font-tijelo);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vidi-sve:hover {
    text-decoration: underline;
  }

  .vidi-sve:focus-visible {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 999px) {
    .naslovnica-obavijesti {
      display: none !important;
    }
  }
</style>
