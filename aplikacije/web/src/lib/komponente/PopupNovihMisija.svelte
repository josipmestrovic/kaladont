<script lang="ts">
  import { onMount } from 'svelte';
  import type { MisijaDto, StanjeMisijaDto } from 'zajednicko';
  import { X } from 'lucide-svelte';
  import {
    ApiGreska,
    dohvatiStanjeMisija,
    oznaciPregledMisija,
  } from '$lib/misije-klijent.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';

  type Skupina = 'dnevna' | 'tjedna';

  let aktivnaSkupina = $state<Skupina | null>(null);
  let kartice = $state<MisijaDto[]>([]);
  let zatvaranje = $state(false);
  /** Podloga ostaje montirana kroz daily→weekly da ekran ne bljesne. */
  let podlogaVidljiva = $state(false);

  async function pokreniRedoslijed() {
    if (!jeRegistriranKorisnik()) return;
    let stanje: StanjeMisijaDto;
    try {
      stanje = await dohvatiStanjeMisija();
    } catch (e) {
      if (e instanceof ApiGreska && (e.status === 401 || e.status === 403)) return;
      return;
    }
    if (stanje.novosti.dnevne) {
      podlogaVidljiva = true;
      aktivnaSkupina = 'dnevna';
      kartice = [...stanje.dnevne.aktivne].sort((a, b) => a.slot - b.slot);
      return;
    }
    if (stanje.novosti.tjedne) {
      podlogaVidljiva = true;
      aktivnaSkupina = 'tjedna';
      kartice = [...stanje.tjedne.misije].filter((m) => m.status === 'aktivna').sort((a, b) => a.slot - b.slot);
    }
  }

  async function zatvori() {
    if (!aktivnaSkupina || zatvaranje) return;
    zatvaranje = true;
    const skupina = aktivnaSkupina;
    try {
      const stanje = await oznaciPregledMisija(skupina);
      if (skupina === 'dnevna' && stanje.novosti.tjedne) {
        aktivnaSkupina = 'tjedna';
        kartice = [...stanje.tjedne.misije].filter((m) => m.status === 'aktivna').sort((a, b) => a.slot - b.slot);
      } else {
        aktivnaSkupina = null;
        kartice = [];
        podlogaVidljiva = false;
      }
    } catch {
      aktivnaSkupina = null;
      kartice = [];
      podlogaVidljiva = false;
    } finally {
      zatvaranje = false;
    }
  }

  onMount(() => {
    void pokreniRedoslijed();
    const naIdentitet = () => {
      aktivnaSkupina = null;
      kartice = [];
      podlogaVidljiva = false;
      void pokreniRedoslijed();
    };
    const naEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && aktivnaSkupina) void zatvori();
    };
    window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);
    window.addEventListener('keydown', naEscape);
    return () => {
      window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
      window.removeEventListener('keydown', naEscape);
    };
  });

  const naslov = $derived(aktivnaSkupina === 'dnevna' ? 'Nove dnevne misije' : 'Nove tjedne misije');
</script>

{#if podlogaVidljiva}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="popup-podloga" role="presentation" onclick={() => void zatvori()}>
    {#if aktivnaSkupina}
      {#key aktivnaSkupina}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="popup-sadrzaj"
          role="dialog"
          aria-modal="true"
          aria-labelledby="popup-misija-naslov"
          tabindex="-1"
          onclick={() => void zatvori()}
          onkeydown={(e) => e.key === 'Escape' && zatvori()}
        >
          <button type="button" class="zatvori" aria-label="Zatvori" onclick={() => void zatvori()} disabled={zatvaranje}>
            <X size={22} aria-hidden="true" />
          </button>
          <h2 id="popup-misija-naslov">{naslov}</h2>
          <p class="opis">Pogledaj nove izazove. Detalje i zamjenu pronađi na stranici Misije.</p>
          <ul class="kartice">
            {#each kartice as misija (misija.dodjelaId)}
              <li>
                <strong>{misija.naziv}</strong>
                <span>{misija.opis}</span>
                {#if misija.cilj > 1}
                  <span class="napredak">{misija.napredak} / {misija.cilj}</span>
                {/if}
                <em>{misija.xpNagrada.toLocaleString('hr-HR')} XP</em>
              </li>
            {/each}
          </ul>
          <a href="/misije" class="link-sve" onclick={() => void zatvori()}>Sve misije</a>
        </div>
      {/key}
    {/if}
  </div>
{/if}

<style>
  .popup-podloga {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgb(0 0 0 / 0);
    display: grid;
    place-items: center;
    padding: 16px;
    animation: popup-podloga-ulaz 1s ease forwards;
  }
  .popup-sadrzaj {
    position: relative;
    width: min(720px, 100%);
    max-height: min(80vh, 720px);
    overflow: auto;
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
    border-radius: 14px;
    padding: 24px 20px 20px;
    display: grid;
    gap: 14px;
    box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
    cursor: pointer;
    transform: scale(0.86);
    opacity: 0;
    animation: popup-sadrzaj-ulaz 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }
  .zatvori {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    color: var(--boja-tekst);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  h2 {
    margin: 0 36px 0 0;
    color: var(--boja-isticanje-tekst);
  }
  .opis {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .kartice {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  .kartice li {
    display: grid;
    gap: 4px;
    padding: 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
  }
  .kartice strong {
    color: var(--boja-tekst);
  }
  .kartice span,
  .kartice em {
    color: var(--boja-tekst-sekundarni);
    font-style: normal;
  }
  .kartice .napredak {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--boja-tekst);
  }
  .kartice em {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .link-sve {
    justify-self: start;
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  @keyframes popup-podloga-ulaz {
    from { background: rgb(0 0 0 / 0); }
    to { background: rgb(0 0 0 / 0.55); }
  }
  @keyframes popup-sadrzaj-ulaz {
    from { opacity: 0; transform: scale(0.86); }
    to { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .popup-podloga,
    .popup-sadrzaj {
      animation: none;
    }
    .popup-podloga {
      background: rgb(0 0 0 / 0.55);
    }
    .popup-sadrzaj {
      opacity: 1;
      transform: none;
    }
  }
  @media (min-width: 800px) {
    .kartice {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
