<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    ApiGreska,
    dohvatiStanjeMisija,
    oznaciPregledMisija,
  } from '$lib/misije-klijent.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';

  type Skupina = 'dnevna' | 'tjedna';

  let poruka = $state<string | null>(null);
  let skupineNaCekanju = $state<Skupina[]>([]);
  let zatvaranje = $state(false);

  function tekstZa(skupine: Skupina[]): string {
    const dnevne = skupine.includes('dnevna');
    const tjedne = skupine.includes('tjedna');
    if (dnevne && tjedne) return 'Imaš nove dnevne i tjedne misije';
    if (dnevne) return 'Imaš nove dnevne misije';
    return 'Imaš nove tjedne misije';
  }

  async function pokreni() {
    if ($page.url.pathname !== '/') return;
    if (!jeRegistriranKorisnik()) return;
    let stanje;
    try {
      stanje = await dohvatiStanjeMisija();
    } catch (e) {
      if (e instanceof ApiGreska && (e.status === 401 || e.status === 403)) return;
      return;
    }
    const skupine: Skupina[] = [];
    if (stanje.novosti.dnevne) skupine.push('dnevna');
    if (stanje.novosti.tjedne) skupine.push('tjedna');
    if (skupine.length === 0) {
      poruka = null;
      skupineNaCekanju = [];
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
      poruka = null;
      skupineNaCekanju = [];
      zatvaranje = false;
    }
  }

  async function idiNaMisije() {
    if (!poruka || zatvaranje) return;
    zatvaranje = true;
    try {
      await oznaciSveNaCekanju();
    } finally {
      poruka = null;
      skupineNaCekanju = [];
      zatvaranje = false;
    }
  }

  onMount(() => {
    const naIdentitet = () => {
      poruka = null;
      skupineNaCekanju = [];
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
      poruka = null;
      skupineNaCekanju = [];
    }
  });
</script>

{#if poruka}
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
