<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import {
    obrisiSavSanducic,
    oznaciSavSanducicProcitanim,
    osvjeziSazetakSanducica,
  } from '$lib/stanje-sanducica.svelte.js';
  import type { SanducicPorukaDetalj } from 'zajednicko';

  let poruke = $state<SanducicPorukaDetalj[]>([]);
  let noveIds = $state<Set<string>>(new Set());
  let sljedeciCursor = $state<string | null>(null);
  let ucitavanje = $state(true);
  let greska = $state<string | null>(null);
  let brisanje = $state(false);
  let istaknutiId = $state<string | null>(null);

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
      if (!reset && sljedeciCursor) params.set('cursor', sljedeciCursor);
      const odgovor = await api<{ ok: true; poruke: SanducicPorukaDetalj[]; sljedeciCursor: string | null }>(
        `/sanducic?${params.toString()}`,
      );
      if (reset) {
        const granica = new Date();
        noveIds = new Set(odgovor.poruke.filter((p) => !p.procitano).map((p) => p.id));
        poruke = odgovor.poruke.map((p) => ({ ...p, procitano: true }));
        sljedeciCursor = odgovor.sljedeciCursor;
        // Feed = obavijesti: ulazak označava sve dosad stvorene pročitanima.
        await oznaciSavSanducicProcitanim(granica);
      } else {
        poruke = [...poruke, ...odgovor.poruke];
        sljedeciCursor = odgovor.sljedeciCursor;
      }
    } catch {
      greska = 'Ne mogu učitati obavijesti.';
      if (reset) {
        poruke = [];
        noveIds = new Set();
      }
    } finally {
      ucitavanje = false;
    }
  }

  async function obrisiSve(): Promise<void> {
    if (poruke.length === 0 || brisanje) return;
    if (!confirm('Želiš li obrisati sve obavijesti?')) return;
    brisanje = true;
    try {
      await obrisiSavSanducic();
      poruke = [];
      noveIds = new Set();
      sljedeciCursor = null;
      istaknutiId = null;
      await osvjeziSazetakSanducica();
    } catch {
      greska = 'Ne mogu obrisati obavijesti.';
    } finally {
      brisanje = false;
    }
  }

  onMount(() => {
    void (async () => {
      await ucitaj(true);
      const id = $page.url.searchParams.get('id');
      if (id && poruke.some((p) => p.id === id)) {
        istaknutiId = id;
        queueMicrotask(() => {
          document.getElementById(`obavijest-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
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
      <button
        type="button"
        class="obrisi-sve"
        disabled={brisanje || poruke.length === 0}
        onclick={() => void obrisiSve()}
      >
        Obriši sve obavijesti
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
        <li id="obavijest-{poruka.id}">
          <article class="stavka" class:novo={noveIds.has(poruka.id)} class:istaknuto={istaknutiId === poruka.id}>
            <img class="ikona" src="/ikone/81-mailbox.webp" alt="" aria-hidden="true" width="36" height="36" />
            <div class="tekst">
              <div class="naslovni-red">
                <strong>{poruka.naslov}</strong>
                {#if noveIds.has(poruka.id)}
                  <span class="oznaka-novo">Novo</span>
                {/if}
              </div>
              <p class="tijelo">{poruka.tekst}</p>
              <time datetime={poruka.stvorenaAt}>{formatirajVrijeme(poruka.stvorenaAt)}</time>
              {#if poruka.poveznica}
                <a class="poveznica" href={poruka.poveznica}>Otvori</a>
              {/if}
            </div>
          </article>
        </li>
      {/each}
    </ul>

    {#if sljedeciCursor}
      <button type="button" class="ucitaj-jos" disabled={ucitavanje} onclick={() => void ucitaj(false)}>
        Učitaj starije
      </button>
    {/if}
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
    justify-content: flex-end;
  }

  .obrisi-sve,
  .ucitaj-jos,
  .greska button {
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 20%, transparent);
    border-radius: 8px;
    background: var(--boja-povrsina, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
    font-weight: 600;
  }

  .obrisi-sve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--boja-tekst-osnovni) 12%, transparent);
    border-radius: 10px;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .stavka.novo {
    border-color: color-mix(in srgb, var(--boja-akcent) 45%, transparent);
    background: color-mix(in srgb, var(--boja-akcent) 8%, transparent);
  }

  .stavka.istaknuto {
    outline: 2px solid var(--boja-akcent);
  }

  .tekst {
    display: grid;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .naslovni-red {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .naslovni-red strong {
    font-size: 1.05rem;
  }

  .oznaka-novo {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--boja-akcent);
  }

  .tijelo {
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .tekst time {
    font-size: 0.85rem;
    opacity: 0.75;
  }

  .poveznica {
    font-weight: 600;
    color: var(--boja-akcent);
    width: fit-content;
  }

  .ikona {
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
