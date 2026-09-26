<script lang="ts">
  interface Stavka {
    kljuc: string;
    naziv: string;
  }

  interface Props {
    stavke: readonly Stavka[];
    aktivna: string;
    ariaLabel: string;
    promijeni: (kljuc: string) => void;
  }

  let { stavke, aktivna, ariaLabel, promijeni }: Props = $props();
</script>

<nav class="podizbornik" aria-label={ariaLabel}>
  {#each stavke as stavka (stavka.kljuc)}
    <button type="button" class:aktivno={aktivna === stavka.kljuc} aria-pressed={aktivna === stavka.kljuc} onclick={() => promijeni(stavka.kljuc)}>
      {stavka.naziv}
    </button>
  {/each}
</nav>

<style>
  .podizbornik {
    display: inline-flex;
    align-self: flex-start;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px;
    border: 1px solid #d8d8d2;
    border-radius: 8px;
    background: #f6f6f1;
  }

  .podizbornik button {
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    padding: 9px 12px;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: var(--tekst-mikro);
  }

  .podizbornik button.aktivno {
    border-color: #1c5c4a;
    background: #fff;
    color: #1c5c4a;
    font-weight: 700;
  }
</style>
