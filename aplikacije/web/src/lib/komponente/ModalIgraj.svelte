<script lang="ts">
  /**
   * Igraj: način dolazi s naslovnice → pravilnik → format (Ranked) ili broj Računala (Zagrijavanje).
   * HINT: Troboj bez ikone (tekst „Troboj · 3 igrača”) dok vlasnik ne dostavi asset.
   */
  import { onMount } from 'svelte';
  import type { ModPartije, PravilnikPartije } from 'zajednicko';
  import { X } from 'lucide-svelte';
  import {
    REDOSLIJED_PRAVILNIKA,
    TEKSTOVI_PRAVILNIKA,
    nazivFormata,
    opisFormata,
    putanjaJavnogReda,
    putanjaZagrijavanjaBotova,
  } from '$lib/igraj-rute.js';

  let {
    otvoren = false,
    nacin = 'natjecateljski',
    onZatvori,
  }: {
    otvoren?: boolean;
    nacin?: 'natjecateljski' | 'laganini';
    onZatvori: () => void;
  } = $props();

  let korak = $state<'pravilnik' | 'format' | 'botovi'>('pravilnik');
  let odabranaPravila = $state<PravilnikPartije | null>(null);
  let podlogaEl = $state<HTMLDivElement | null>(null);
  let dijalogEl = $state<HTMLDivElement | null>(null);
  let prethodniFokus: HTMLElement | null = null;

  const FORMATI: readonly ModPartije[] = ['dva_igraca', 'tri_igraca', 'cetiri_igraca'];
  const OPCIJE_BOTOVA = [
    { broj: 1 as const, naziv: 'Igraj 1 računalom' },
    { broj: 2 as const, naziv: 'Igraj 2 računala' },
    { broj: 3 as const, naziv: 'Igraj 3 računala' },
  ];

  const nazivNacina = $derived(nacin === 'laganini' ? 'Zagrijavanje' : 'Ranked');

  $effect(() => {
    if (otvoren) {
      korak = 'pravilnik';
      odabranaPravila = null;
      prethodniFokus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => dijalogEl?.focus());
    }
  });

  /** Overlay mora biti na document.body — inače overflow/flex roditelja na naslovnici lome fixed + zastor. */
  $effect(() => {
    const el = podlogaEl;
    if (!el || typeof document === 'undefined') return;
    document.body.appendChild(el);
    return () => {
      el.remove();
    };
  });

  function zatvori() {
    onZatvori();
    queueMicrotask(() => prethodniFokus?.focus());
  }

  function odaberiPravilnik(pravila: PravilnikPartije) {
    odabranaPravila = pravila;
    korak = nacin === 'laganini' ? 'botovi' : 'format';
    queueMicrotask(() => dijalogEl?.focus());
  }

  function natrag() {
    if (korak === 'format' || korak === 'botovi') {
      korak = 'pravilnik';
      odabranaPravila = null;
    }
    queueMicrotask(() => dijalogEl?.focus());
  }

  function naTipku(dogadaj: KeyboardEvent) {
    if (dogadaj.key === 'Escape') {
      dogadaj.stopPropagation();
      zatvori();
    }
  }

  onMount(() => {
    return () => {
      /* fokus vraća zatvori() */
    };
  });
</script>

{#if otvoren}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-podloga" bind:this={podlogaEl} role="presentation" onclick={zatvori}>
    <div
      bind:this={dijalogEl}
      class="modal-sadrzaj"
      role="dialog"
      aria-modal="true"
      aria-label={nazivNacina}
      tabindex="-1"
      onclick={(dogadaj) => dogadaj.stopPropagation()}
      onkeydown={naTipku}
    >
      <button type="button" class="zatvori-modal" aria-label="Zatvori" onclick={zatvori}>
        <X size={22} aria-hidden="true" />
      </button>

      {#if korak === 'pravilnik'}
        <p class="modal-nadnaslov">{nazivNacina}</p>
        <h2 id="modal-naslov">Odaberi pravila po kojima želiš igrati</h2>
        <div class="modal-opcije">
          {#each REDOSLIJED_PRAVILNIKA as pravila (pravila)}
            <button
              type="button"
              class="modal-opcija modal-opcija-tekst"
              onclick={() => odaberiPravilnik(pravila)}
            >
              <span>
                <strong>{TEKSTOVI_PRAVILNIKA[pravila].naziv}</strong>
                <small>{TEKSTOVI_PRAVILNIKA[pravila].opis}</small>
              </span>
            </button>
          {/each}
        </div>
      {:else if korak === 'format' && odabranaPravila}
        <p class="modal-nadnaslov">Ranked · {TEKSTOVI_PRAVILNIKA[odabranaPravila].naziv}</p>
        <h2 id="modal-naslov">Odaberi stol</h2>
        <div class="modal-opcije">
          {#each FORMATI as mod (mod)}
            <a
              href={putanjaJavnogReda(mod, odabranaPravila)}
              class="modal-opcija"
              data-mod={mod}
            >
              {#if mod === 'dva_igraca'}
                <img src="/ikone/17-soba-2-igraca.png" alt="" aria-hidden="true" />
              {:else if mod === 'cetiri_igraca'}
                <img src="/ikone/16-soba-4-igraca.png" alt="" aria-hidden="true" />
              {:else}
                <!-- HINT PR14: Troboj ikona naknadno — samo tekstualni placeholder. -->
                <span class="modal-opcija-ikona troboj-placeholder" aria-hidden="true">3</span>
              {/if}
              <span>
                <strong>{nazivFormata(mod)}</strong>
                <small>{opisFormata(mod)}</small>
              </span>
            </a>
          {/each}
        </div>
        <button type="button" class="natrag-modal" onclick={natrag}>Natrag</button>
      {:else if korak === 'botovi' && odabranaPravila}
        <p class="modal-nadnaslov">Zagrijavanje · {TEKSTOVI_PRAVILNIKA[odabranaPravila].naziv}</p>
        <h2 id="modal-naslov">Koliko Računala želiš?</h2>
        <div class="modal-opcije">
          {#each OPCIJE_BOTOVA as opcija (opcija.broj)}
            <a
              href={putanjaZagrijavanjaBotova(opcija.broj, odabranaPravila)}
              class="modal-opcija modal-opcija-tekst"
            >
              <span>
                <strong>{opcija.naziv}</strong>
              </span>
            </a>
          {/each}
        </div>
        <button type="button" class="natrag-modal" onclick={natrag}>Natrag</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-podloga {
    position: fixed;
    z-index: 160;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--boja-zastor);
    backdrop-filter: blur(8px);
  }

  .modal-sadrzaj {
    position: relative;
    max-width: 520px;
    width: 100%;
    max-height: min(92dvh, 720px);
    overflow: auto;
    padding: 30px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 12px;
    background: var(--boja-povrsina);
    box-shadow: var(--sjena-modal);
    text-align: center;
  }

  .zatvori-modal {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--boja-tekst-sekundarni);
    cursor: pointer;
  }

  .zatvori-modal:hover {
    background: var(--boja-obrub);
    color: var(--boja-tekst-osnovni);
  }

  .modal-nadnaslov {
    margin: 0 0 4px;
    color: var(--boja-akcent-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 800;
    text-transform: uppercase;
  }

  .modal-sadrzaj h2 {
    margin: 0 36px 22px;
    font-size: 31px;
    line-height: 1.1;
  }

  .modal-opcije {
    display: grid;
    gap: 10px;
  }

  .modal-opcija {
    display: grid;
    grid-template-columns: 56px 1fr;
    align-items: center;
    gap: 13px;
    padding: 14px 16px;
    border: 1px solid var(--boja-plocica-obrub);
    border-radius: 8px;
    background: var(--boja-plocica);
    color: var(--boja-plocica-tekst);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    font: inherit;
    width: 100%;
  }

  .modal-opcija-tekst {
    grid-template-columns: 1fr;
  }

  .modal-opcija:hover {
    border-color: var(--boja-mint);
  }

  .modal-opcija > img,
  .modal-opcija-ikona {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }

  .modal-opcija-ikona {
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--boja-mint) 18%, transparent);
    color: var(--boja-mint-tamni);
    font-family: var(--font-naslov);
    font-size: 22px;
    font-weight: 800;
  }

  .modal-opcija span:not(.modal-opcija-ikona) {
    display: grid;
    gap: 2px;
  }

  .modal-opcija strong {
    color: var(--boja-mint-tamni);
    font-family: var(--font-naslov);
    font-size: 19px;
  }

  .modal-opcija small {
    color: #5c554a;
    font-size: var(--tekst-sitni);
    line-height: 1.35;
  }

  .natrag-modal {
    margin-top: 16px;
    padding: 10px 18px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 8px;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .natrag-modal:hover {
    border-color: var(--boja-mint);
  }

  @media (max-width: 999px) {
    .modal-sadrzaj {
      padding: 26px 18px 20px;
    }
    .modal-sadrzaj h2 {
      font-size: 27px;
    }
  }
</style>
