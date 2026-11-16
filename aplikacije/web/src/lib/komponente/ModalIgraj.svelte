<script lang="ts">
  /**
   * PR14 — dvokoračni Igraj: pravilnik → format/trening/privatna.
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
    opisZagrijavanja,
    putanjaJavnogReda,
    putanjaPrivatneKreacije,
    putanjaZagrijavanja,
  } from '$lib/igraj-rute.js';

  let {
    otvoren = false,
    onZatvori,
  }: {
    otvoren?: boolean;
    onZatvori: () => void;
  } = $props();

  let korak = $state<'pravilnik' | 'format'>('pravilnik');
  let odabranaPravila = $state<PravilnikPartije | null>(null);
  let dijalogEl = $state<HTMLDivElement | null>(null);
  let prethodniFokus: HTMLElement | null = null;

  const FORMATI: readonly ModPartije[] = ['dva_igraca', 'tri_igraca', 'cetiri_igraca'];

  $effect(() => {
    if (otvoren) {
      korak = 'pravilnik';
      odabranaPravila = null;
      prethodniFokus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => dijalogEl?.focus());
    }
  });

  function zatvori() {
    onZatvori();
    queueMicrotask(() => prethodniFokus?.focus());
  }

  function odaberiPravilnik(pravila: PravilnikPartije) {
    odabranaPravila = pravila;
    korak = 'format';
    queueMicrotask(() => dijalogEl?.focus());
  }

  function natrag() {
    korak = 'pravilnik';
    odabranaPravila = null;
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
  <div class="modal-podloga" role="presentation" onclick={zatvori}>
    <div
      bind:this={dijalogEl}
      class="modal-sadrzaj"
      role="dialog"
      aria-modal="true"
      aria-label="Igraj"
      aria-labelledby="modal-naslov"
      tabindex="-1"
      onclick={(dogadaj) => dogadaj.stopPropagation()}
      onkeydown={naTipku}
    >
      <button type="button" class="zatvori-modal" aria-label="Zatvori" onclick={zatvori}>
        <X size={22} aria-hidden="true" />
      </button>

      {#if korak === 'pravilnik'}
        <p class="modal-nadnaslov">Odaberi pravilnik</p>
        <h2 id="modal-naslov">Kako želiš igrati?</h2>
        <div class="modal-opcije">
          {#each REDOSLIJED_PRAVILNIKA as pravila (pravila)}
            <button
              type="button"
              class="modal-opcija"
              onclick={() => odaberiPravilnik(pravila)}
            >
              <span class="modal-opcija-ikona" aria-hidden="true" data-pravila={pravila}></span>
              <span>
                <strong>{TEKSTOVI_PRAVILNIKA[pravila].naziv}</strong>
                <small>{TEKSTOVI_PRAVILNIKA[pravila].opis}</small>
              </span>
            </button>
          {/each}
        </div>
      {:else if odabranaPravila}
        <p class="modal-nadnaslov">{TEKSTOVI_PRAVILNIKA[odabranaPravila].naziv}</p>
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
          <a
            href={putanjaZagrijavanja(odabranaPravila)}
            class="modal-opcija"
            data-izbor="zagrijavanje"
          >
            <img src="/ikone/67-zagrijavanje-bot.webp" alt="" aria-hidden="true" />
            <span>
              <strong>Zagrijavanje</strong>
              <small>{opisZagrijavanja(odabranaPravila)}</small>
            </span>
          </a>
          <a
            href={putanjaPrivatneKreacije(odabranaPravila)}
            class="modal-opcija"
            data-izbor="privatna"
          >
            <img src="/ikone/18-privatna-soba.png" alt="" aria-hidden="true" />
            <span>
              <strong>Privatna soba</strong>
              <small>Prilagodi pravila i pozovi svoju ekipu.</small>
            </span>
          </a>
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

  .modal-opcija-ikona[data-pravila='klasicni']::before {
    content: 'K';
  }
  .modal-opcija-ikona[data-pravila='ka_zna']::before {
    content: 'KA';
    font-size: 16px;
  }
  .modal-opcija-ikona[data-pravila='dokazi_nastavak']::before {
    content: 'DN';
    font-size: 16px;
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
