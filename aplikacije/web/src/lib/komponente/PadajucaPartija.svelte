<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    generirajPocetnePoteze,
    odigrajSljedeciPotez,
    stvoriStanjePartije,
    type PotezPozadine,
    type StanjePozadinskePartije,
  } from '$lib/pozadinski-kaladont/simulator.js';

  type VarijantaBoje = 'mint' | 'suptilna' | 'zlatna' | 'kaladont';

  interface PadajucaRijec {
    id: number;
    idPartije: number;
    rijec: string;
    velicinaFonta: number;
    debljinaFonta: number;
    rotacija: number;
    pomak: number;
    varijantaBoje: VarijantaBoje;
    posebnaRijec: boolean;
    odgodaSekundi: number;
    trajanjeSekundi: number;
  }

  let {
    strana,
    brzinaPxPoSekundi,
    intervalMs,
    pauzirano = false,
    uskaZona = false,
  }: {
    strana: 'lijevo' | 'desno';
    brzinaPxPoSekundi: number;
    intervalMs: number;
    pauzirano?: boolean;
    uskaZona?: boolean;
  } = $props();

  const MAKS_VIDLJIVIH = 14;
  const POCETNIH_POTEZA = 7;

  const pocetniIdPartije = strana === 'lijevo' ? 1 : 2;
  const pocetniIntervalMs = intervalMs;

  let rijeci = $state<PadajucaRijec[]>([]);
  let zonaEl: HTMLDivElement | null = null;
  let stanje: StanjePozadinskePartije = stvoriStanjePartije(pocetniIdPartije);
  let idPartije = pocetniIdPartije;
  let idElementa = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let preostaloDoPotezaMs = pocetniIntervalMs;
  let zadnjiTick = 0;
  let aktivan = false;
  let putanjaPx = $state(1100);

  function slucajni(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function odaberiBoju(posebna: boolean): VarijantaBoje {
    if (posebna) return 'kaladont';
    const r = Math.random();
    if (r < 0.05) return 'zlatna';
    if (r < 0.2) return 'suptilna';
    return 'mint';
  }

  function izracunajPutanju(): number {
    if (!zonaEl) return Math.max(window.innerHeight, 800) + 120;
    return zonaEl.clientHeight + 120;
  }

  function vizualIzPoteza(potez: PotezPozadine, odgodaSekundi: number): PadajucaRijec {
    const baza = uskaZona ? slucajni(14, 22) : slucajni(16, 32);
    const velicina = potez.posebnaRijec ? Math.min(baza * 1.15, uskaZona ? 24 : 36) : baza;
    return {
      id: ++idElementa,
      idPartije: potez.idPartije,
      rijec: potez.rijec,
      velicinaFonta: velicina,
      debljinaFonta: Math.round(slucajni(400, 700) / 100) * 100,
      rotacija: slucajni(-8, 8),
      pomak: slucajni(uskaZona ? -6 : -12, uskaZona ? 6 : 12),
      varijantaBoje: odaberiBoju(potez.posebnaRijec),
      posebnaRijec: potez.posebnaRijec,
      odgodaSekundi,
      trajanjeSekundi: putanjaPx / brzinaPxPoSekundi,
    };
  }

  function ukloniRijec(id: number) {
    rijeci = rijeci.filter((r) => r.id !== id);
  }

  function zakaziSljedeci(odgodaMs: number) {
    if (!aktivan) return;
    if (timer) clearTimeout(timer);
    preostaloDoPotezaMs = odgodaMs;
    zadnjiTick = performance.now();
    timer = setTimeout(() => {
      timer = null;
      if (!aktivan || pauzirano) return;
      dodajPotez();
    }, odgodaMs);
  }

  function zapocniNovuPartiju(sPauzom: boolean) {
    idPartije += 2;
    stanje = stvoriStanjePartije(idPartije);
    zakaziSljedeci(sPauzom ? intervalMs * (1.5 + Math.random() * 0.5) : intervalMs);
  }

  function dodajPotez() {
    if (!aktivan) return;

    if (stanje.zavrsena) {
      // Pauza samo nakon kaladonta; inače odmah nova partija.
      zapocniNovuPartiju(true);
      return;
    }

    const potez = odigrajSljedeciPotez(stanje);
    if (!potez) {
      // Nema poteza bez kaladonta — odmah nastavi novom partijom, bez pauze.
      zapocniNovuPartiju(false);
      return;
    }

    putanjaPx = izracunajPutanju();
    const vizual = vizualIzPoteza(potez, 0);
    rijeci = [...rijeci, vizual].slice(-MAKS_VIDLJIVIH);

    if (potez.posebnaRijec && potez.zavrsavaPartiju) {
      zapocniNovuPartiju(true);
      return;
    }

    if (stanje.zavrsena) {
      zapocniNovuPartiju(false);
      return;
    }

    zakaziSljedeci(intervalMs);
  }

  function inicijaliziraj() {
    putanjaPx = izracunajPutanju();
    idPartije = pocetniIdPartije;
    const { stanje: novoStanje, potezi } = generirajPocetnePoteze(POCETNIH_POTEZA, {}, idPartije);
    stanje = novoStanje;
    idPartije = novoStanje.idPartije;

    // Riječi idu odozdo prema gore: najnovija najniže, najstarija najviše.
    // Odozgo prema dolje čita se redoslijed partije (kao u igri).
    const trajanje = putanjaPx / brzinaPxPoSekundi;
    const razmakSekundi = intervalMs / 1000;
    const vizuali: PadajucaRijec[] = [];
    for (let i = 0; i < potezi.length; i += 1) {
      const starost = potezi.length - 1 - i;
      const odgoda = -starost * razmakSekundi;
      // Ograniči da animacija još traje (riječ još nije „izašla” na vrh).
      if (Math.abs(odgoda) >= trajanje) continue;
      vizuali.push(vizualIzPoteza(potezi[i]!, odgoda));
    }
    rijeci = vizuali;

    if (stanje.zavrsena) {
      // Ako je inicijalni lanac već završio kaladontom, kratka pauza pa nova partija.
      zapocniNovuPartiju(true);
    } else {
      zakaziSljedeci(intervalMs);
    }
  }

  function pauzirajTimere() {
    if (timer) {
      const proteklo = performance.now() - zadnjiTick;
      preostaloDoPotezaMs = Math.max(0, preostaloDoPotezaMs - proteklo);
      clearTimeout(timer);
      timer = null;
    }
  }

  function nastaviTimere() {
    if (!aktivan || pauzirano) return;
    zakaziSljedeci(preostaloDoPotezaMs > 0 ? preostaloDoPotezaMs : intervalMs);
  }

  let prethodnoPauzirano = false;
  $effect(() => {
    const p = pauzirano;
    if (!aktivan) {
      prethodnoPauzirano = p;
      return;
    }
    if (p && !prethodnoPauzirano) pauzirajTimere();
    else if (!p && prethodnoPauzirano) nastaviTimere();
    prethodnoPauzirano = p;
  });

  onMount(() => {
    aktivan = true;
    inicijaliziraj();
    return () => {
      aktivan = false;
      if (timer) clearTimeout(timer);
      timer = null;
    };
  });

  onDestroy(() => {
    aktivan = false;
    if (timer) clearTimeout(timer);
  });
</script>

<div
  class="zona"
  class:zona--lijevo={strana === 'lijevo'}
  class:zona--desno={strana === 'desno'}
  class:zona--pauza={pauzirano}
  bind:this={zonaEl}
  data-testid={`padajuca-partija-${strana}`}
>
  {#each rijeci as rijec (rijec.id)}
    <span
      class="rijec"
      class:rijec--kaladont={rijec.posebnaRijec}
      class:rijec--mint={rijec.varijantaBoje === 'mint'}
      class:rijec--suptilna={rijec.varijantaBoje === 'suptilna'}
      class:rijec--zlatna={rijec.varijantaBoje === 'zlatna'}
      class:rijec--posebna={rijec.varijantaBoje === 'kaladont'}
      style={`--velicina:${rijec.velicinaFonta}px;--debljina:${rijec.debljinaFonta};--rotacija:${rijec.rotacija}deg;--pomak:${rijec.pomak}px;--odgoda:${rijec.odgodaSekundi}s;--trajanje:${rijec.trajanjeSekundi}s;--putanja:${putanjaPx}px;--njihanje:${2.8 + (rijec.id % 5) * 0.35}s;`}
      onanimationend={(e) => {
        if (e.animationName.includes('dizanje-partije')) ukloniRijec(rijec.id);
      }}
    >
      <span class="rijec-njihanje">{rijec.rijec}</span>
    </span>
  {/each}
</div>

<style>
  .zona {
    position: absolute;
    top: 0;
    bottom: 0;
    width: max(0px, calc((100% - var(--sirina-grida, 980px)) / 2));
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
    mask-image: linear-gradient(to bottom, transparent 0%, #000 6%, #000 94%, transparent 100%);
  }

  .zona--lijevo {
    left: 0;
  }

  .zona--desno {
    right: 0;
  }

  .zona--pauza .rijec,
  .zona--pauza .rijec-njihanje {
    animation-play-state: paused;
  }

  .rijec {
    position: absolute;
    top: 0;
    left: 50%;
    font-family: var(--font-naslov);
    font-size: var(--velicina);
    font-weight: var(--debljina);
    white-space: nowrap;
    will-change: transform;
    /* Ulaz odozdo, izlaz na vrh — lanac se čita odozgo prema dolje kao u partiji. */
    animation: dizanje-partije var(--trajanje) linear var(--odgoda) forwards;
    transform: translate3d(calc(-50% + var(--pomak)), var(--putanja), 0) rotate(var(--rotacija));
  }

  .rijec-njihanje {
    display: inline-block;
    transform-origin: center center;
    animation: njihanje-rijeci var(--njihanje) ease-in-out infinite alternate;
  }

  /* Tamna tema: bijela slova na mint pozadini. */
  .rijec--mint {
    color: #ffffff;
  }
  .rijec--suptilna {
    color: rgb(255 255 255 / 78%);
  }
  .rijec--zlatna {
    color: #fff3d0;
  }
  .rijec--posebna,
  .rijec--kaladont {
    color: #ffe0d2;
  }

  /* Svijetla tema: prigušeni mint (kao dosad). */
  :global(html[data-tema='svijetla']) .rijec--mint {
    color: #b9cdbf;
  }
  :global(html[data-tema='svijetla']) .rijec--suptilna {
    color: #c9d8cc;
  }
  :global(html[data-tema='svijetla']) .rijec--zlatna {
    color: #cdbe8d;
  }
  :global(html[data-tema='svijetla']) .rijec--posebna,
  :global(html[data-tema='svijetla']) .rijec--kaladont {
    color: #d5a189;
  }

  @keyframes dizanje-partije {
    0% {
      transform: translate3d(calc(-50% + var(--pomak)), var(--putanja), 0) rotate(var(--rotacija));
    }
    100% {
      transform: translate3d(calc(-50% + var(--pomak)), -40px, 0)
        rotate(calc(var(--rotacija) * -1));
    }
  }

  @keyframes njihanje-rijeci {
    0% {
      transform: translateX(-5px) rotate(-3deg);
    }
    100% {
      transform: translateX(5px) rotate(3deg);
    }
  }
</style>
