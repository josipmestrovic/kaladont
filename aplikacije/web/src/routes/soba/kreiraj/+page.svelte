<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SVE_VRSTE_RIJECI, type PostavkePrivatneSobe, type VrstaRijeci } from 'zajednicko';
  import { dohvatiSocket } from '$lib/socket.js';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';

  const OZNACI_VRSTA: Record<VrstaRijeci, string> = {
    imenica: 'Imenice',
    glagol: 'Glagoli',
    pridjev: 'Pridjevi',
    prilog: 'Prilozi',
    zamjenica: 'Zamjenice',
    broj: 'Brojevi',
    prijedlog: 'Prijedlozi',
    veznik: 'Veznici',
    cestica: 'Čestice',
    uzvik: 'Usklici',
  };

  let trajanjePotezaSek = $state(30);
  let eliminacijskiBodovi = $state(true);
  let odabraneVrste = $state<Set<VrstaRijeci>>(new Set(SVE_VRSTE_RIJECI));
  let poruka = $state<string | null>(null);
  let slanjeUTijeku = $state(false);

  function ukljuciSve() {
    odabraneVrste = new Set(SVE_VRSTE_RIJECI);
  }

  function iskljuciSve() {
    odabraneVrste = new Set(['imenica']);
  }

  function preklopiVrstu(v: VrstaRijeci) {
    if (v === 'imenica') return;
    const novi = new Set(odabraneVrste);
    if (novi.has(v)) {
      if (novi.size > 1) novi.delete(v);
    } else {
      novi.add(v);
    }
    odabraneVrste = novi;
  }

  onMount(() => {
    const socket = dohvatiSocket();

    const naStvorenu = (payload: { kod: string }) => {
      slanjeUTijeku = false;
      void goto(`/soba/${payload.kod}`);
    };

    const naGresku = (greska: { kod?: string; poruka: string }) => {
      slanjeUTijeku = false;
      if (greska.kod === 'EMAIL_NIJE_POTVRDEN') {
        void goto('/potvrdi-email');
        return;
      }
      poruka = greska.poruka;
    };

    socket.on('soba:stvorena', naStvorenu);
    socket.on('greska', naGresku);

    return () => {
      socket.off('soba:stvorena', naStvorenu);
      socket.off('greska', naGresku);
    };
  });

  function stvoriSobu(e: SubmitEvent) {
    e.preventDefault();
    if (slanjeUTijeku) return;
    slanjeUTijeku = true;
    poruka = null;

    const postavke: PostavkePrivatneSobe = {
      trajanjePotezaSek,
      eliminacijskiBodovi,
      dopusteneVrste: [...odabraneVrste],
    };

    const socket = dohvatiSocket();
    socket.emit('soba:stvori', { postavke });
  }
</script>

<svelte:head>
  <title>Nova privatna soba | Kaladont</title>
</svelte:head>

<main class="kreiraj-sobu">
  <h1>Nova privatna soba</h1>
  <p class="podnaslov">
    Kreiraj sobu po svojim pravilima i pozovi prijatelje izravnim linkom. Dodaj do 8 igrača tako da im pošalješ link od sobe kada ju kreiraš!
  </p>

  <form onsubmit={stvoriSobu}>

    <section class="grupa">
      <h2>Pravila igranja i tajmer</h2>

      <label class="preklopnik-redak">
        <span>Dodjeljuj bodove za eliminaciju (+1 bod za eliminaciju — kada protivnik ispadne zbog riječi koju si ti rekao)</span>
        <input type="checkbox" bind:checked={eliminacijskiBodovi} />
      </label>

      <div class="tajmer-sekcija">
        <span class="sub-naslov">Ograničenje za potez (tajmer):</span>
        <div class="opcije-gumbi">
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={trajanjePotezaSek === 15}
            onclick={() => (trajanjePotezaSek = 15)}
          >
            15 s
          </button>
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={trajanjePotezaSek === 30}
            onclick={() => (trajanjePotezaSek = 30)}
          >
            30 s (standardno)
          </button>
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={trajanjePotezaSek === 60}
            onclick={() => (trajanjePotezaSek = 60)}
          >
            60 s
          </button>
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={trajanjePotezaSek === 0}
            onclick={() => (trajanjePotezaSek = 0)}
          >
            Bez tajmera
          </button>
        </div>
      </div>
    </section>

    <section class="grupa">
      <div class="vrste-sekcija">
        <div class="naslov-redak">
          <h2>Dopuštene vrste riječi</h2>
          <div class="brze-akcije">
            <button type="button" class="link-gumb" onclick={ukljuciSve}>Sve</button> ·
            <button type="button" class="link-gumb" onclick={iskljuciSve}>Samo imenice</button>
          </div>
        </div>

        <p class="objasnjenje-imenica">Imenice su obavezne kako bi svaka runda imala dovoljno nastavaka.</p>
        <p class="objasnjenje-skupa">
          Sustav rundu otvara iz
          <PojamPomoc
            tekst="skupa sigurnih riječi"
            opis="Zbirka riječi koja uvijek ima nastavak te njihov nastavak isto ima nastavak."
            id="pojasnjenje-skupa-sigurnih-rijeci"
          />.
        </p>

        <div class="vrste-mrezica">
          {#each SVE_VRSTE_RIJECI as vrsta (vrsta)}
            <label
              class="vrsta-labela"
              class:aktivno={odabraneVrste.has(vrsta)}
              class:zakljucano={vrsta === 'imenica'}
              title={vrsta === 'imenica' ? 'Imenice su uvijek uključene.' : undefined}
            >
              <input
                type="checkbox"
                checked={odabraneVrste.has(vrsta)}
                disabled={vrsta === 'imenica'}
                onchange={() => preklopiVrstu(vrsta)}
              />
              <span>{OZNACI_VRSTA[vrsta]}</span>
            </label>
          {/each}
        </div>
      </div>
    </section>

    {#if poruka}
      <p role="alert" class="greska">{poruka}</p>
    {/if}

    <button type="submit" class="glavni-gumb" disabled={slanjeUTijeku}>
      {slanjeUTijeku ? 'Stvaranje sobe...' : 'Stvori privatnu sobu'}
    </button>
  </form>
</main>

<style>
  .kreiraj-sobu {
    max-width: 540px;
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  h1 {
    font-family: var(--font-naslov);
    line-height: 1.1;
    margin: 0;
  }

  .podnaslov {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .grupa {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 20px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grupa h2 {
    font-size: var(--naslov-3);
    margin: 0;
  }

  .sub-naslov {
    font-weight: 700;
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-naslov);
  }

  .objasnjenje-imenica,
  .objasnjenje-skupa {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .naslov-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .brze-akcije {
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
  }

  .link-gumb {
    background: none;
    border: none;
    color: var(--boja-tekst-naslov);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }

  .opcije-gumbi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .odabir-gumb {
    background: #faf8f0;
    border: 2px solid #e5ddc8;
    color: var(--boja-tekst-osnovni);
    padding: 8px 16px;
    border-radius: var(--radijus-pill);
    font-weight: 600;
    cursor: pointer;
    font-size: var(--tekst-sitni);
  }

  .odabir-gumb.odabran {
    background: var(--boja-pozadina-primarna);
    border-color: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 700;
  }

  .preklopnik-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-weight: 600;
    font-size: var(--tekst-sitni);
    cursor: pointer;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    accent-color: var(--boja-pozadina-primarna);
    cursor: pointer;
  }

  .tajmer-sekcija, .vrste-sekcija {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vrste-mrezica {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }

  .vrsta-labela {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #faf8f0;
    border: 1px solid #e5ddc8;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: var(--tekst-sitni);
    font-weight: 600;
    user-select: none;
  }

  .vrsta-labela.aktivno {
    background: white;
    border-color: var(--boja-pozadina-primarna);
    color: var(--boja-tekst-naslov);
    font-weight: 700;
  }

  .vrsta-labela.zakljucano {
    opacity: 0.58;
    cursor: not-allowed;
  }

  .vrsta-labela.zakljucano input {
    cursor: not-allowed;
  }

  .glavni-gumb {
    font-family: var(--font-naslov);
    font-size: 22px;
    letter-spacing: 1.5px;
    font-weight: 700;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 14px 32px;
    background: var(--boja-pozadina-primarna);
    color: white;
    cursor: pointer;
    align-self: flex-start;
  }

  .glavni-gumb:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .greska {
    color: #c0392b;
    margin: 0;
    font-weight: 600;
  }

  .grupa {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 20px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .grupa h2 {
    font-size: var(--naslov-3);
    margin: 0;
  }

  .naslov-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .brze-akcije {
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
  }

  .link-gumb {
    background: none;
    border: none;
    color: var(--boja-tekst-naslov);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }

  .opcije-gumbi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .odabir-gumb {
    background: #faf8f0;
    border: 2px solid #e5ddc8;
    color: var(--boja-tekst-osnovni);
    padding: 8px 16px;
    border-radius: var(--radijus-pill);
    font-weight: 600;
    cursor: pointer;
    font-size: var(--tekst-sitni);
  }

  .odabir-gumb.odabran {
    background: var(--boja-pozadina-primarna);
    border-color: var(--boja-pozadina-primarna);
    color: white;
    font-weight: 700;
  }

  .vrste-mrezica {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }

  .vrsta-labela {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #faf8f0;
    border: 1px solid #e5ddc8;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: var(--tekst-sitni);
    font-weight: 600;
    user-select: none;
  }

  .vrsta-labela.aktivno {
    background: white;
    border-color: var(--boja-pozadina-primarna);
    color: var(--boja-tekst-naslov);
    font-weight: 700;
  }

  .glavni-gumb {
    font-family: var(--font-naslov);
    font-size: 22px;
    letter-spacing: 1.5px;
    font-weight: 700;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 14px 32px;
    background: var(--boja-pozadina-primarna);
    color: white;
    cursor: pointer;
    align-self: flex-start;
  }

  .glavni-gumb:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .greska {
    color: #c0392b;
    margin: 0;
    font-weight: 600;
  }
</style>