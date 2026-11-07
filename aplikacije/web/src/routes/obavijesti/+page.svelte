<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import {
    oznaciSanducicProcitane,
    oznaciSavSanducicProcitanim,
    osvjeziSazetakSanducica,
  } from '$lib/stanje-sanducica.svelte.js';
  import type { SanducicPorukaDetalj } from 'zajednicko';

  let poruke = $state<SanducicPorukaDetalj[]>([]);
  let sljedeciCursor = $state<string | null>(null);
  let ucitavanje = $state(true);
  let greska = $state<string | null>(null);
  let filter = $state<'sve' | 'neprocitane'>('sve');
  let odabrana = $state<SanducicPorukaDetalj | null>(null);
  let oznacavanje = $state(false);

  function formatirajVrijeme(iso: string): string {
    try {
      return new Date(iso).toLocaleString('hr-HR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  async function ucitaj(reset = true): Promise<void> {
    ucitavanje = true;
    greska = null;
    try {
      const params = new URLSearchParams();
      if (filter === 'neprocitane') params.set('filter', 'neprocitane');
      if (!reset && sljedeciCursor) params.set('cursor', sljedeciCursor);
      const odgovor = await api<{ ok: true; poruke: SanducicPorukaDetalj[]; sljedeciCursor: string | null }>(
        `/sanducic?${params.toString()}`,
      );
      poruke = reset ? odgovor.poruke : [...poruke, ...odgovor.poruke];
      sljedeciCursor = odgovor.sljedeciCursor;
    } catch {
      greska = 'Ne mogu učitati obavijesti.';
      if (reset) poruke = [];
    } finally {
      ucitavanje = false;
    }
  }

  async function otvori(poruka: SanducicPorukaDetalj): Promise<void> {
    odabrana = poruka;
    if (!poruka.procitano) {
      try {
        await oznaciSanducicProcitane([poruka.id]);
        poruke = poruke.map((p) => (p.id === poruka.id ? { ...p, procitano: true } : p));
        odabrana = { ...poruka, procitano: true };
      } catch {
        // Detalj i dalje ostaje otvoren.
      }
    }
  }

  async function oznaciSve(): Promise<void> {
    oznacavanje = true;
    try {
      await oznaciSavSanducicProcitanim();
      await ucitaj(true);
      await osvjeziSazetakSanducica();
    } finally {
      oznacavanje = false;
    }
  }

  onMount(() => {
    void (async () => {
      await ucitaj(true);
      const id = $page.url.searchParams.get('id');
      if (id) {
        const lokalna = poruke.find((p) => p.id === id);
        if (lokalna) {
          await otvori(lokalna);
        } else {
          try {
            const odgovor = await api<{ ok: true; poruka: SanducicPorukaDetalj }>(`/sanducic/${id}`);
            await otvori(odgovor.poruka);
          } catch {
            // Ignoriraj nepostojeći deep-link.
          }
        }
      }
    })();
  });
</script>

<svelte:head>
  <title>Obavijesti — Kaladont</title>
</svelte:head>

<main class="obavijesti">
  <header class="zaglavlje">
    <h1>Obavijesti</h1>
    <div class="akcije">
      <div class="filteri" role="group" aria-label="Filter obavijesti">
        <button type="button" class:aktivan={filter === 'sve'} onclick={() => { filter = 'sve'; void ucitaj(true); }}>Sve</button>
        <button type="button" class:aktivan={filter === 'neprocitane'} onclick={() => { filter = 'neprocitane'; void ucitaj(true); }}>Nepročitane</button>
      </div>
      <button type="button" class="oznaci-sve" disabled={oznacavanje || poruke.every((p) => p.procitano)} onclick={() => void oznaciSve()}>
        Označi sve pročitanim
      </button>
    </div>
  </header>

  {#if greska}
    <div class="greska" role="alert">
      <p>{greska}</p>
      <button type="button" onclick={() => void ucitaj(true)}>Pokušaj ponovno</button>
    </div>
  {:else if ucitavanje && poruke.length === 0}
    <p class="stanje">Učitavanje…</p>
  {:else if poruke.length === 0}
    <p class="stanje">Zasad nema obavijesti.</p>
  {:else}
    <ul class="lista">
      {#each poruke as poruka (poruka.id)}
        <li>
          <button
            type="button"
            class="stavka"
            class:neprocitano={!poruka.procitano}
            class:odabrano={odabrana?.id === poruka.id}
            onclick={() => void otvori(poruka)}
          >
            <img class="ikona" src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="36" height="36" />
            <span class="tekst">
              <strong>{poruka.naslov}</strong>
              <time datetime={poruka.stvorenaAt}>{formatirajVrijeme(poruka.stvorenaAt)}</time>
            </span>
            {#if !poruka.procitano}
              <span class="tockica" aria-label="Nepročitano"></span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    {#if sljedeciCursor}
      <button type="button" class="ucitaj-jos" disabled={ucitavanje} onclick={() => void ucitaj(false)}>
        Učitaj starije
      </button>
    {/if}
  {/if}

  {#if odabrana}
    <article class="detalj" aria-live="polite">
      <h2>{odabrana.naslov}</h2>
      <time datetime={odabrana.stvorenaAt}>{formatirajVrijeme(odabrana.stvorenaAt)}</time>
      <p>{odabrana.tekst}</p>
      {#if odabrana.poveznica}
        <a href={odabrana.poveznica}>Otvori</a>
      {/if}
      <button type="button" class="zatvori-detalj" onclick={() => (odabrana = null)}>Zatvori</button>
    </article>
  {/if}
</main>

<style>
  .obavijesti {
    width: min(100% - 32px, 720px);
    margin: 16px auto 48px;
    display: grid;
    gap: 16px;
  }

  .zaglavlje {
    display: grid;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-naslov);
    font-size: 1.8rem;
  }

  .akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .filteri {
    display: inline-flex;
    gap: 6px;
  }

  .filteri button,
  .oznaci-sve,
  .ucitaj-jos,
  .greska button,
  .zatvori-detalj {
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 20%, transparent);
    border-radius: 8px;
    background: var(--boja-povrsina, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
    font-weight: 600;
  }

  .filteri button.aktivan {
    border-color: var(--boja-akcent);
    color: var(--boja-akcent);
  }

  .stanje,
  .greska {
    padding: 24px 8px;
    text-align: center;
  }

  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .stavka {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 12%, transparent);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .stavka.neprocitano {
    border-color: color-mix(in srgb, var(--boja-akcent) 45%, transparent);
    background: color-mix(in srgb, var(--boja-akcent) 8%, transparent);
  }

  .stavka.odabrano {
    outline: 2px solid var(--boja-akcent);
  }

  .tekst {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .tekst strong {
    font-size: 1.05rem;
  }

  .tekst time {
    font-size: 0.85rem;
    opacity: 0.75;
  }

  .tockica {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #e23b3b;
    flex-shrink: 0;
  }

  .detalj {
    display: grid;
    gap: 8px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 15%, transparent);
  }

  .detalj h2 {
    margin: 0;
    font-family: var(--font-naslov);
  }

  .detalj time {
    opacity: 0.75;
    font-size: 0.9rem;
  }

  .detalj p {
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
  }
</style>
