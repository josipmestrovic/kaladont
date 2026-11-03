<script lang="ts">
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

  interface IgracZaPrijavu {
    igracId: string;
    nadimak: string;
  }

  let {
    partijaId,
    igraci,
    otvorenoPocetno = false,
  }: {
    partijaId: string;
    igraci: IgracZaPrijavu[];
    otvorenoPocetno?: boolean;
  } = $props();

  let otvoreno = $state(otvorenoPocetno);
  let prijavljeni = $state<Set<string>>(new Set());
  let uTijeku = $state<Set<string>>(new Set());
  let greska = $state<string | null>(null);

  async function prijavi(igracId: string) {
    if (prijavljeni.has(igracId) || uTijeku.has(igracId)) return;
    uTijeku = new Set(uTijeku).add(igracId);
    greska = null;
    try {
      await api<{ ok: boolean }>('/prijave-igraca', {
        method: 'POST',
        body: JSON.stringify({
          partijaId,
          prijavljeniIgracId: igracId,
          razlog: 'pogrdan_nadimak',
        }),
      });
      prijavljeni = new Set(prijavljeni).add(igracId);
      pokaziUspjeh('Igrač je prijavljen.');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Prijava nije uspjela.';
    } finally {
      const novi = new Set(uTijeku);
      novi.delete(igracId);
      uTijeku = novi;
    }
  }
</script>

<section class="panel-prijava-igraca">
  <button type="button" class="naslov" aria-expanded={otvoreno} onclick={() => (otvoreno = !otvoreno)}>
    <span>Prijavi igrača radi pogrdnog nadimka</span>
    <span aria-hidden="true">{otvoreno ? '−' : '+'}</span>
  </button>
  {#if otvoreno}
    {#if greska}<p class="greska" role="alert">{greska}</p>{/if}
    {#if igraci.length === 0}
      <p class="prazno">Nema drugih igrača za prijavu.</p>
    {:else}
      <ul>
        {#each igraci as igrac (igrac.igracId)}
          <li>
            <span class="nadimak">{igrac.nadimak}</span>
            <button
              type="button"
              class="prijavi"
              disabled={prijavljeni.has(igrac.igracId) || uTijeku.has(igrac.igracId)}
              onclick={() => void prijavi(igrac.igracId)}
            >
              {#if prijavljeni.has(igrac.igracId)}Prijavljeno{:else if uTijeku.has(igrac.igracId)}Šaljem...{:else}Prijavi{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .panel-prijava-igraca {
    width: 100%;
    margin-top: 8px;
    border-top: 1px solid var(--boja-obrub);
  }

  .naslov {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border: 0;
    background: transparent;
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--boja-obrub);
  }

  .nadimak {
    font-weight: 700;
    word-break: break-word;
  }

  .prijavi {
    flex: 0 0 auto;
    padding: 6px 10px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 6px;
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .prijavi:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .greska {
    color: var(--boja-poraz-tekst);
  }

  .prazno {
    color: var(--boja-tekst-sekundarni);
  }
</style>
