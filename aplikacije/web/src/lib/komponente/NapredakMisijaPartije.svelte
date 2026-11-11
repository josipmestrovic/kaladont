<script lang="ts">
  import type { PromjenaMisije } from 'zajednicko';

  let { promjene }: { promjene: PromjenaMisije[] } = $props();

  function sortiraj(a: PromjenaMisije, b: PromjenaMisije): number {
    if (a.upravoDovrsena !== b.upravoDovrsena) return a.upravoDovrsena ? -1 : 1;
    return a.naziv.localeCompare(b.naziv, 'hr');
  }

  const dnevne = $derived(promjene.filter((p) => p.vrsta === 'dnevna').sort(sortiraj));
  const tjedne = $derived(promjene.filter((p) => p.vrsta === 'tjedna').sort(sortiraj));
</script>

{#snippet stavka(promjena: PromjenaMisije)}
  <li>
    {#if promjena.upravoDovrsena}
      <p class="zavrsena">
        <strong>Misija završena!</strong>
        <span>{promjena.naziv}</span>
      </p>
      {#if promjena.opis}
        <p class="opis">{promjena.opis}</p>
      {/if}
      {#if promjena.xpStvarnoDodijeljeno > 0}
        <p class="xp">Dodijeljeno +{promjena.xpStvarnoDodijeljeno} XP</p>
      {:else if promjena.xpNominalno > 0}
        <p class="xp">Na najvećoj si razini; dodijeljeno 0 XP.</p>
      {/if}
    {:else}
      <p>
        <span class="sr-only">Napredak misije: </span>
        {promjena.opisNapretka}
      </p>
      {#if promjena.opis}
        <p class="opis">{promjena.opis}</p>
      {/if}
      <div
        class="traka"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={promjena.cilj}
        aria-valuenow={promjena.poslije}
        aria-label={`${promjena.naziv}: ${promjena.poslije} od ${promjena.cilj}`}
      >
        <span style={`width: ${promjena.cilj <= 0 ? 100 : Math.min(100, (promjena.poslije / promjena.cilj) * 100)}%`}></span>
      </div>
    {/if}
  </li>
{/snippet}

{#if dnevne.length > 0 || tjedne.length > 0}
  <section class="napredak-misija" aria-labelledby="napredak-misija-naslov">
    <header class="zaglavlje">
      <h3 id="napredak-misija-naslov">Misije</h3>
      <a href="/misije" class="sve-misije">Sve misije</a>
    </header>

    {#if dnevne.length > 0}
      <section class="skupina" aria-labelledby="napredak-dnevne-naslov">
        <h4 id="napredak-dnevne-naslov">Dnevne</h4>
        <ul>
          {#each dnevne as promjena (promjena.dodjelaId)}
            {@render stavka(promjena)}
          {/each}
        </ul>
      </section>
    {/if}

    {#if tjedne.length > 0}
      <section class="skupina" aria-labelledby="napredak-tjedne-naslov">
        <h4 id="napredak-tjedne-naslov">Tjedne</h4>
        <ul>
          {#each tjedne as promjena (promjena.dodjelaId)}
            {@render stavka(promjena)}
          {/each}
        </ul>
      </section>
    {/if}
  </section>
{/if}

<style>
  .napredak-misija {
    margin: 24px 0 0;
    padding: 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .zaglavlje {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  h3 {
    margin: 0;
    color: var(--boja-isticanje-tekst);
  }
  .sve-misije {
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
    text-decoration: underline;
  }
  .skupina {
    display: grid;
    gap: 10px;
  }
  .skupina + .skupina {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--boja-obrub);
  }
  h4 {
    margin: 0;
    color: var(--boja-tekst);
    font-size: 1rem;
  }
  ul {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  p {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
  }
  .zavrsena {
    color: var(--boja-tekst);
    display: grid;
    gap: 2px;
  }
  .opis {
    margin-top: 2px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni, 0.9rem);
  }
  .xp {
    margin-top: 4px;
    color: var(--boja-isticanje-tekst);
    font-weight: 700;
  }
  .traka {
    margin-top: 6px;
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--boja-krem);
  }
  .traka span {
    display: block;
    height: 100%;
    background: var(--boja-isticanje-tekst);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
