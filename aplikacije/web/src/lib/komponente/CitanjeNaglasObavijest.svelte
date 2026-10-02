<script lang="ts">
  import { onMount } from 'svelte';
  import { glasUkljucen, govornoOkruzenje as govornoOkruzenjeStore, type GovornoOkruzenje } from '$lib/glasovni-manager.js';

  const KLJUC_POTVRDE = 'kaladont_glas_obavijest_potvrdjena_v1';
  let ukljuceno = $state(false);
  let potvrdeno = $state(false);
  let prethodnoUkljuceno = false;
  let govornoOkruzenje = $state<GovornoOkruzenje>({
    provjereno: false,
    podrzavaSintezu: false,
    platforma: 'nepoznat sustav',
    jeziciPreglednika: [],
    jeziciGlasova: [],
    hrvatskiGlas: false,
  });

  const prikaziObavijest = $derived(ukljuceno && govornoOkruzenje.provjereno && !potvrdeno);
  const jeziciPreglednika = $derived(govornoOkruzenje.jeziciPreglednika.length
    ? govornoOkruzenje.jeziciPreglednika.join(', ')
    : 'nije prijavljen');
  const jeziciGlasova = $derived(govornoOkruzenje.jeziciGlasova.length
    ? govornoOkruzenje.jeziciGlasova.join(', ')
    : 'preglednik ne izlaže popis glasova');

  function procitajPotvrdu(): boolean {
    try {
      return window.localStorage.getItem(KLJUC_POTVRDE) === 'true';
    } catch {
      return false;
    }
  }

  function potvrdiRazumijevanje(): void {
    potvrdeno = true;
    try {
      window.localStorage.setItem(KLJUC_POTVRDE, 'true');
    } catch {
      // Potvrda vrijedi do promjene stranice ako lokalna pohrana nije dostupna.
    }
  }

  function poveznicaPomoci(): string {
    const odjeljci: Record<string, string> = {
      Android: 'upute-android',
      'iOS/iPadOS': 'upute-ios',
      Windows: 'upute-windows',
      macOS: 'upute-macos',
      Linux: 'upute-linux',
    };
    const sidro = odjeljci[govornoOkruzenje.platforma] ?? 'upute-opcenito';
    return `/pomoc?tema=pristupacnost#${sidro}`;
  }

  onMount(() => {
    const odjavaGovora = glasUkljucen.subscribe((vrijednost) => {
      ukljuceno = vrijednost;
      if (!vrijednost) {
        if (prethodnoUkljuceno) {
          potvrdeno = false;
          try {
            window.localStorage.removeItem(KLJUC_POTVRDE);
          } catch {
            // Upozorenje se ponovno prikazuje i bez dostupne lokalne pohrane.
          }
        }
      } else {
        potvrdeno = procitajPotvrdu();
      }
      prethodnoUkljuceno = vrijednost;
    });
    const odjavaOkruzenja = govornoOkruzenjeStore.subscribe((vrijednost) => {
      govornoOkruzenje = vrijednost;
    });

    return () => {
      odjavaGovora();
      odjavaOkruzenja();
    };
  });
</script>

{#if prikaziObavijest}
  <aside class="obavijest-citanja-naglas" role="status" aria-live="polite" aria-atomic="true">
    <div class="sadrzaj-obavijesti">
      <strong>O čitanju naglas</strong>
      <p>
        Kaladont koristi govorne glasove koje preglednik izlaže, najčešće s uređaja. Izgovara se samo nova riječ u partiji, a traženi jezik glasa hrvatski (hr-HR). Ako preglednik ili odabrani glas koristi engleski, hrvatska riječ može zvučati pogrešno ili se uopće ne izgovoriti.
      </p>
      <p>
        Prepoznata platforma: <strong>{govornoOkruzenje.platforma}</strong>. Jezik preglednika: <strong>{jeziciPreglednika}</strong>. To nije pouzdano očitanje jezika operacijskog sustava. Te podatke koristimo samo u ovoj obavijesti; ne šalju se na poslužitelj.
      </p>
      {#if !govornoOkruzenje.podrzavaSintezu}
        <p>Nije pronađena podrška za čitanje naglas u ovom pregledniku.</p>
      {:else if !govornoOkruzenje.hrvatskiGlas}
        <p>Preglednik trenutačno ne izlaže hrvatski glas. Prijavljeni jezici glasova: {jeziciGlasova}.</p>
      {:else}
        <p>Preglednik izlaže hrvatski glas ({jeziciGlasova}).</p>
      {/if}
      <a href={poveznicaPomoci()}>Upute za postavljanje glasa</a>
    </div>
    <button type="button" onclick={potvrdiRazumijevanje}>Razumijem</button>
  </aside>
{/if}

<style>
  .obavijest-citanja-naglas {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border: 1px solid var(--boja-zlato-obrub);
    border-radius: 8px;
    background: var(--boja-zlato-pozadina);
    color: var(--boja-zlato-tekst);
    box-shadow: var(--sjena-modal);
  }

  .sadrzaj-obavijesti {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .sadrzaj-obavijesti p { margin: 0; font-size: 0.9rem; line-height: 1.4; }
  .sadrzaj-obavijesti a { width: fit-content; color: inherit; font-weight: 700; }

  .obavijest-citanja-naglas button {
    flex: 0 0 auto;
    padding: 7px 12px;
    border: 1px solid var(--boja-cta-pozadina);
    border-radius: 6px;
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font: inherit;
    cursor: pointer;
  }

  @media (max-width: 999px) {
    .obavijest-citanja-naglas { align-items: flex-start; flex-direction: column; }
    .obavijest-citanja-naglas button { align-self: flex-start; }
  }
</style>
