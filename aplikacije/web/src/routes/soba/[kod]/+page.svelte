<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { dohvatiSocket } from '$lib/socket.js';
  import Avatar from '$lib/komponente/Avatar.svelte';
  import type { StanjePrivatneSobe, VrstaRijeci } from 'zajednicko';

  const kodSobe = $derived($page.params.kod?.toUpperCase() ?? '');

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

  let stanjeSobe = $state<StanjePrivatneSobe | null>(null);
  let greska = $state<string | null>(null);
  let kopirano = $state(false);
  let jeUPartiji = $state(false);

  const jeVlasnik = $derived(
    Boolean(stanjeSobe && stanjeSobe.vlasnikId === stanjeSobe.mojIgracId)
  );

  onMount(() => {
    const socket = dohvatiSocket();

    const naStanjeSobe = (novoStanje: StanjePrivatneSobe) => {
      stanjeSobe = novoStanje;
      greska = null;
    };

    const naGresku = (p: { poruka: string }) => {
      greska = p.poruka;
    };

    const naPocetak = (payload: { partijaId: string }) => {
      jeUPartiji = true;
      void goto(`/partija/${payload.partijaId}`);
    };

    const naVlasnikNapustio = () => {
      greska = 'Vlasnik je napustio sobu. Soba je zatvorena.';
      stanjeSobe = null;
    };

    socket.on('soba:stanje', naStanjeSobe);
    socket.on('greska', naGresku);
    socket.on('partija:pocetak', naPocetak);
    socket.on('soba:vlasnik-napustio', naVlasnikNapustio);

    socket.emit('soba:udji', { kod: kodSobe });

    return () => {
      socket.off('soba:stanje', naStanjeSobe);
      socket.off('greska', naGresku);
      socket.off('partija:pocetak', naPocetak);
      socket.off('soba:vlasnik-napustio', naVlasnikNapustio);
    };
  });

  onDestroy(() => {
    if (!jeUPartiji) {
      const socket = dohvatiSocket();
      socket.emit('soba:izadji');
    }
  });

  async function kopirajLink() {
    try {
      const link = `${window.location.origin}/soba/${kodSobe}`;
      await navigator.clipboard.writeText(link);
      kopirano = true;
      setTimeout(() => (kopirano = false), 2500);
    } catch {
      kopirano = false;
    }
  }

  function pokreniIgru() {
    if (!jeVlasnik) return;
    const socket = dohvatiSocket();
    socket.emit('soba:pokreni');
  }
</script>

<svelte:head>
  <title>Privatna čekaonica | Kaladont</title>
</svelte:head>

<main class="cekaonica-sobe">
  {#if greska}
    <div class="okvir-greska">
      <p role="alert" class="greska">{greska}</p>
      <a href="/" class="spremnik-link">Vrati se na početnu</a>
    </div>
  {:else if stanjeSobe}
    <header class="zaglavlje-cekaonice">
      <div>
        <span class="oznaka-koda">Kod sobe: <strong>{kodSobe}</strong></span>
        <h1>Privatna čekaonica</h1>
      </div>

      <button type="button" class="kopiraj-gumb" onclick={kopirajLink}>
        {kopirano ? '✓ Link je kopiran!' : '🔗 Kopiraj link za poziv'}
      </button>
    </header>

    <div class="mrezica-cekaonice">
      <section class="kartica clanovi-sekcija">
        <h2>Prijavljeni igrači ({stanjeSobe.clanovi.length} / 8)</h2>

        <div class="clanovi-lista">
          {#each stanjeSobe.clanovi as clan (clan.igracId)}
            <div class="clan-redak">
              <Avatar avatarId={clan.avatarId} avatarConfig={clan.avatarConfig} rang={clan.rang} gost={!clan.rang} velicina={48} />
              <div class="clan-info">
                <span class="clan-ime">{clan.nadimak}</span>
                <span class="clan-rang">{clan.rang ?? 'Piskaralo'} <span aria-hidden="true">|</span> LVL {clan.razina}</span>
                {#if clan.jeVlasnik}
                  <span class="vlasnik-bedz">Vlasnik sobe</span>
                {/if}
              </div>
              <div class="clan-rezultat">
                 <span class="pobjede-broj">{clan.pobjedeUSobi} pob.</span>
                 <span class="bodovi-broj">({clan.bodoviUSobi} bod.)</span>
              </div>
            </div>
          {/each}
        </div>

        <div class="akcija-sekcija">
          {#if jeVlasnik}
            <button
              type="button"
              class="glavni-gumb"
              disabled={stanjeSobe.clanovi.length < 2}
              onclick={pokreniIgru}
            >
              {stanjeSobe.clanovi.length < 2 ? 'Čekaju se igrači (min. 2)...' : 'Započni igru'}
            </button>
          {:else}
            <p class="cekanje-tekst">Čekanje da vlasnik sobe započne igru...</p>
          {/if}
        </div>
      </section>

      <section class="kartica pravila-sekcija">
          <h2>🏆 Ljestvica sobe</h2>
          <table class="ljestvica-tablica">
            <thead>
              <tr><th>#</th><th>Igrač</th><th>Pob.</th><th>Bod.</th></tr>
            </thead>
            <tbody>
              {#each stanjeSobe.clanovi as clan, i (clan.igracId)}
                <tr class:vodeci={i === 0 && (clan.bodoviUSobi > 0 || clan.pobjedeUSobi > 0)}>
                  <td>{i === 0 && (clan.bodoviUSobi > 0 || clan.pobjedeUSobi > 0) ? '👑 1.' : `${i + 1}.`}</td>
                  <td><strong>{clan.nadimak}</strong></td>
                  <td>{clan.pobjedeUSobi}</td>
                  <td class="istaknuto">{clan.bodoviUSobi}</td>
                </tr>
              {/each}
            </tbody>
          </table>

        <h2>Pravila ove sobe</h2>
        <ul class="lista-pravila">
          <li>
            <strong>Bodovanje eliminacija:</strong>
            {stanjeSobe.postavke.eliminacijskiBodovi ? '+1 bod po eliminaciji' : 'Samo pobjeda (2 boda)'}
          </li>
          <li>
            <strong>Tajmer poteza:</strong>
            {stanjeSobe.postavke.trajanjePotezaSek > 0
              ? `${stanjeSobe.postavke.trajanjePotezaSek} sekundi`
              : 'Bez tajmera (isključeno)'}
          </li>
          <li>
            <strong>Dopuštene vrste riječi:</strong>
            <div class="tagovi-vrsta">
              {#each stanjeSobe.postavke.dopusteneVrste as vrsta (vrsta)}
                <span class="vrsta-tag">{OZNACI_VRSTA[vrsta]}</span>
              {/each}
            </div>
          </li>
          <li class="napomena-bodovi">
            💡 <em>Ova igra je prijateljska i ne utječe na bodove niti ljestvicu.</em>
          </li>
        </ul>
      </section>
    </div>
  {:else}
    <p>Spajanje u sobu...</p>
  {/if}
</main>

<style>
  .cekaonica-sobe {
    max-width: 720px;
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .zaglavlje-cekaonice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 20px;
    box-shadow: var(--sjena-suptilna);
  }

  .oznaka-koda {
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
  }

  h1 {
    font-family: var(--font-naslov);
    margin: 4px 0 0 0;
    line-height: 1.1;
  }

  .kopiraj-gumb {
    background: #faf8f0;
    border: 2px solid var(--boja-pozadina-primarna);
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
    padding: 10px 20px;
    border-radius: var(--radijus-pill);
    cursor: pointer;
    font-size: var(--tekst-sitni);
  }

  .mrezica-cekaonice {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }

  @media (min-width: 640px) {
    .mrezica-cekaonice {
      grid-template-columns: 3fr 2fr;
    }
  }

  .kartica {
    background: white;
    border: 1px solid #e5ddc8;
    border-radius: var(--radijus-kartica);
    padding: 20px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kartica h2 {
    font-size: var(--naslov-3);
    margin: 0;
  }

  .clanovi-lista {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .clan-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 12px;
    background: #faf8f0;
  }

  .clan-rezultat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: var(--tekst-sitni);
  }

  .pobjede-broj {
    font-weight: 700;
    color: var(--boja-tekst-naslov);
  }

  .bodovi-broj {
    color: var(--boja-tekst-sekundarni);
  }

    .ljestvica-tablica {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--tekst-sitni);
    }

    .ljestvica-tablica th,
    .ljestvica-tablica td {
      padding: 8px 4px;
      border-bottom: 1px solid #e5ddc8;
      text-align: right;
    }

    .ljestvica-tablica th:nth-child(2),
    .ljestvica-tablica td:nth-child(2) {
      text-align: left;
    }

    .ljestvica-tablica th {
      color: var(--boja-tekst-sekundarni);
      font-weight: 600;
    }

    .ljestvica-tablica tr.vodeci {
      background: #fdf6e2;
    }

    .ljestvica-tablica .istaknuto {
      color: var(--boja-pozadina-primarna);
      font-weight: 700;
  }

  .clan-info {
    display: flex;
    flex-direction: column;
  }

  .clan-ime {
    font-weight: 700;
  }

  .clan-rang {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .vlasnik-bedz {
    font-size: 11px;
    color: var(--boja-pozadina-primarna);
    font-weight: 700;
  }

  .akcija-sekcija {
    margin-top: 8px;
  }

  .glavni-gumb {
    font-family: var(--font-naslov);
    font-size: 20px;
    letter-spacing: 1px;
    font-weight: 700;
    border: none;
    border-radius: var(--radijus-pill);
    padding: 12px 28px;
    background: var(--boja-pozadina-primarna);
    color: white;
    cursor: pointer;
    width: 100%;
  }

  .glavni-gumb:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .cekanje-tekst {
    margin: 0;
    font-weight: 600;
    color: var(--boja-tekst-sekundarni);
    text-align: center;
  }

  .lista-pravila {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: var(--tekst-sitni);
  }

  .tagovi-vrsta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .vrsta-tag {
    background: #faf8f0;
    border: 1px solid #e5ddc8;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
  }

  .napomena-bodovi {
    color: var(--boja-tekst-sekundarni);
    border-top: 1px solid #e5ddc8;
    padding-top: 10px;
    margin-top: 6px;
  }

  .okvir-greska {
    background: white;
    padding: 24px;
    border-radius: var(--radijus-kartica);
    box-shadow: var(--sjena-suptilna);
  }

  .greska {
    color: #c0392b;
    font-weight: 700;
  }

  .spremnik-link {
    color: var(--boja-tekst-naslov);
    font-weight: 700;
  }
</style>