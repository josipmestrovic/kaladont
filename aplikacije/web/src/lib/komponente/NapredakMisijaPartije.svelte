<script lang="ts">
  import type { PromjenaMisije } from 'zajednicko';

  let { promjene }: { promjene: PromjenaMisije[] } = $props();

  const sortirane = $derived([...promjene].sort((a, b) => {
    if (a.upravoDovrsena !== b.upravoDovrsena) return a.upravoDovrsena ? -1 : 1;
    return a.naziv.localeCompare(b.naziv, 'hr');
  }));
</script>

{#if sortirane.length > 0}
  <section class="napredak-misija" aria-labelledby="napredak-misija-naslov">
    <header class="zaglavlje">
      <h3 id="napredak-misija-naslov">Misije</h3>
      <a href="/misije" class="sve-misije">Sve misije</a>
    </header>
    <ul>
      {#each sortirane as promjena (promjena.dodjelaId)}
        <li>
          {#if promjena.upravoDovrsena}
            <p class="zavrsena">
              <strong>Misija završena!</strong>
              <span>{promjena.naziv}</span>
            </p>
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
      {/each}
    </ul>
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
