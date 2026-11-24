<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';
  import { oznaciPregledMisija } from '$lib/misije-klijent.js';
  import {
    dohvatiStanjeMisijaStore,
    invalidirajStanjeMisija,
    osigurajStanjeMisija,
  } from '$lib/stanje-misija.svelte.js';

  type Skupina = 'dnevna' | 'tjedna';

  const misijeStore = dohvatiStanjeMisijaStore();
  let poruka = $state<string | null>(null);
  let skupineNaCekanju = $state<Skupina[]>([]);
  let zatvaranje = $state(false);
  let generacija = 0;

  function tekstZa(skupine: Skupina[]): string {
    const dnevne = skupine.includes('dnevna');
    const tjedne = skupine.includes('tjedna');
    if (dnevne && tjedne) return 'Imaš nove dnevne i tjedne misije';
    if (dnevne) return 'Imaš nove dnevne misije';
    return 'Imaš nove tjedne misije';
  }

  function smijePrikazati(): boolean {
    return $page.url.pathname === '/' && jeRegistriranKorisnik();
  }

  function ocisti() {
    poruka = null;
    skupineNaCekanju = [];
  }

  async function pokreni() {
    const ova = ++generacija;
    if (!smijePrikazati()) {
      ocisti();
      return;
    }
    const stanje = await osigurajStanjeMisija({ forsaj: true });
    if (ova !== generacija || !smijePrikazati()) return;
    if (!stanje) {
      ocisti();
      return;
    }
    const skupine: Skupina[] = [];
    if (stanje.novosti.dnevne) skupine.push('dnevna');
    if (stanje.novosti.tjedne) skupine.push('tjedna');
    if (skupine.length === 0) {
      ocisti();
      return;
    }
    skupineNaCekanju = skupine;
    poruka = tekstZa(skupine);
  }

  async function oznaciSveNaCekanju() {
    const skupine = [...skupineNaCekanju];
    for (const skupina of skupine) {
      try {
        await oznaciPregledMisija(skupina);
      } catch {
        // Best-effort: toast se svejedno sklanja.
      }
    }
  }

  async function zatvori() {
    if (!poruka || zatvaranje) return;
    zatvaranje = true;
    try {
      await oznaciSveNaCekanju();
    } finally {
      ocisti();
      zatvaranje = false;
    }
  }

  async function idiNaMisije() {
    if (!poruka || zatvaranje) return;
    zatvaranje = true;
    try {
      await oznaciSveNaCekanju();
    } finally {
      ocisti();
      zatvaranje = false;
    }
  }

  onMount(() => {
    const naIdentitet = () => {
      generacija += 1;
      ocisti();
      invalidirajStanjeMisija();
      void pokreni();
    };
    window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);
    return () => {
      window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
    };
  });

  $effect(() => {
    if ($page.url.pathname === '/') void pokreni();
    else {
      generacija += 1;
      ocisti();
    }
  });

  // Referenca da store ostane živ za badge na naslovnici dok je toast mountan.
  $effect(() => {
    void misijeStore.status;
  });
</script>

{#if poruka && $page.url.pathname === '/'}
  <aside class="misije-toast" role="status" aria-live="polite">
    <div class="sadrzaj">
      <strong>{poruka}</strong>
      <a class="akcija" href="/misije" onclick={() => void idiNaMisije()}>Pogledaj</a>
    </div>
    <button type="button" class="zatvori" aria-label="Zatvori obavijest" onclick={() => void zatvori()} disabled={zatvaranje}>×</button>
  </aside>
{/if}

<style>
  .misije-toast {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 44px 14px 16px;
    position: relative;
    border: 2px solid var(--boja-akcent, #2a8f86);
    border-radius: 10px;
    background: var(--boja-povrsina, #fff);
    color: var(--boja-tekst-osnovni);
    box-shadow: var(--sjena-modal);
    animation: misije-ulaz 0.4s ease-out;
  }

  .sadrzaj {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .sadrzaj strong {
    font-weight: 700;
    font-size: 1.02rem;
    line-height: 1.35;
    min-width: 0;
  }

  .akcija {
    flex-shrink: 0;
    font-weight: 700;
    color: var(--boja-akcent, #2a8f86);
    text-decoration: underline;
  }

  .zatvori {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  .zatvori:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  @keyframes misije-ulaz {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
