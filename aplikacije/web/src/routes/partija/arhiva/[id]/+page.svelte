<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import Header from '$lib/komponente/Header.svelte';

  interface Plasman {
    igracId: string;
    nadimak: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
    nacinIspadanja: string | null;
    javniProfil: boolean;
  }

  interface Arhiva {
    partijaId: string;
    mod: 'cetiri_igraca' | 'dva_igraca';
    pocetak: string;
    kraj: string;
    plasmani: Plasman[];
  }

  let arhiva = $state<Arhiva | null>(null);
  let greska = $state<string | null>(null);
  let prijavljeniIgrac = $state<Plasman | null>(null);
  let razlog = $state<'pogrdan_nadimak' | 'neprimjereno_ponasanje' | 'drugo'>('pogrdan_nadimak');
  let poruka = $state('');
  let porukaPrijave = $state<string | null>(null);
  let slanje = $state(false);

  function formatirajDatum(datum: string): string {
    return new Date(datum).toLocaleString('hr-HR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function posaljiPrijavu() {
    if (!arhiva || !prijavljeniIgrac || slanje) return;
    slanje = true;
    porukaPrijave = null;
    try {
      const odgovor = await api<{ poruka: string }>('/prijave-igraca', {
        method: 'POST',
        body: JSON.stringify({
          partijaId: arhiva.partijaId,
          prijavljeniIgracId: prijavljeniIgrac.igracId,
          razlog,
          poruka,
        }),
      });
      porukaPrijave = odgovor.poruka;
      prijavljeniIgrac = null;
      poruka = '';
    } catch (e) {
      porukaPrijave = e instanceof Error ? e.message : 'Prijava nije uspjela.';
    } finally {
      slanje = false;
    }
  }

  $effect(() => {
    void (async () => {
      try {
        arhiva = (await api<{ partija: Arhiva }>(`/partije/${$page.params.id}/plasmani`)).partija;
      } catch (e) {
        greska = e instanceof Error ? e.message : 'Arhiva partije nije dostupna.';
      }
    })();
  });
</script>

<svelte:head><title>Odigrana stara igra | Kaladont</title></svelte:head>

<Header />

<main class="arhiva-stranica">
  {#if greska}
    <p class="greska" role="alert">{greska}</p>
  {:else if arhiva}
    <header>
      <p class="oznaka-stanja">Odigrana stara igra</p>
      <h1>Završni poredak</h1>
      <p>{arhiva.mod === 'dva_igraca' ? '2 igrača' : '4 igrača'} · {formatirajDatum(arhiva.kraj)}</p>
    </header>

    <section class="plasmani" aria-label="Završni poredak">
      {#each arhiva.plasmani as igrac (igrac.igracId)}
        <article class="plasman-red">
          <strong class="plasman-broj">{igrac.plasman}.</strong>
          <div class="igrac-podaci">
            {#if igrac.javniProfil}
              <a href={`/profil/javni/${igrac.igracId}`}>{igrac.nadimak}</a>
            {:else}
              <span>{igrac.nadimak}</span>
            {/if}
            <small>{igrac.bodovi} bodova · {igrac.eliminacije} eliminacija</small>
          </div>
          <button type="button" class="prijavi-gumb" title="Prijavi igrača" aria-label={`Prijavi igrača ${igrac.nadimak}`} onclick={() => { prijavljeniIgrac = igrac; porukaPrijave = null; }}>
            ⚑
          </button>
        </article>
      {/each}
    </section>

    {#if porukaPrijave}<p class="poruka" role="status">{porukaPrijave}</p>{/if}
  {:else}
    <p>Učitavanje arhive...</p>
  {/if}
</main>

{#if prijavljeniIgrac}
  <div class="modal-pozadina" role="presentation" onclick={() => (prijavljeniIgrac = null)}>
    <dialog open class="modal" aria-labelledby="prijava-naslov" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.key === 'Escape' && (prijavljeniIgrac = null)}>
      <h2 id="prijava-naslov">Prijavi igrača</h2>
      <p>Prijavljuješ: <strong>{prijavljeniIgrac.nadimak}</strong></p>
      <label>Razlog
        <select bind:value={razlog}>
          <option value="pogrdan_nadimak">Pogrdan ili neprimjeren nadimak</option>
          <option value="neprimjereno_ponasanje">Neprimjereno ponašanje</option>
          <option value="drugo">Drugo</option>
        </select>
      </label>
      <label>Poruka (opcionalno)
        <textarea bind:value={poruka} maxlength="1000" rows="4"></textarea>
      </label>
      <div class="modal-akcije">
        <button type="button" onclick={() => (prijavljeniIgrac = null)}>Odustani</button>
        <button type="button" onclick={() => void posaljiPrijavu()} disabled={slanje}>{slanje ? 'Šaljem...' : 'Pošalji prijavu'}</button>
      </div>
    </dialog>
  </div>
{/if}

<style>
  .arhiva-stranica { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }
  .oznaka-stanja { color: #6b716d; font-size: .9rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .arhiva-stranica h1 { margin: 8px 0; }
  .plasmani { display: grid; gap: 8px; margin-top: 28px; }
  .plasman-red { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid #deded6; border-radius: 8px; background: #fff; }
  .plasman-broj { font-size: 1.25rem; color: #1c5c4a; }
  .igrac-podaci { display: grid; gap: 3px; }
  .igrac-podaci a { color: #1c5c4a; font-weight: 700; }
  .igrac-podaci small { color: #6b716d; }
  .prijavi-gumb { border: 0; background: transparent; color: #7b5145; font-size: 1.2rem; cursor: pointer; }
  .greska { color: #a33d32; }
  .poruka { margin-top: 16px; padding: 12px; border-radius: 6px; background: #eef6ef; }
  .modal-pozadina { position: fixed; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 35%); }
  .modal { width: min(100%, 480px); display: grid; gap: 14px; padding: 24px; border-radius: 8px; background: #fff; }
  .modal label { display: grid; gap: 6px; font-weight: 700; }
  .modal select, .modal textarea { width: 100%; box-sizing: border-box; padding: 9px; border: 1px solid #cfcfc6; border-radius: 6px; font: inherit; }
  .modal-akcije { display: flex; justify-content: end; gap: 8px; }
  .modal-akcije button { padding: 9px 13px; border: 1px solid #cfcfc6; border-radius: 6px; background: #fff; cursor: pointer; }
  .modal-akcije button:last-child { border-color: #1c5c4a; background: #1c5c4a; color: #fff; }
</style>
