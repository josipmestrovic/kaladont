<script lang="ts">
  import { dijeloviNadimkaBota, formatirajNadimakBota } from 'zajednicko';

  let {
    nadimak,
    class: className = '',
  }: {
    nadimak: string;
    class?: string;
  } = $props();

  const dijelovi = $derived(dijeloviNadimkaBota(nadimak));
  const prikaz = $derived(formatirajNadimakBota(nadimak));
</script>

{#if dijelovi}
  <span class="nadimak-bota {className}" title={prikaz}>
    {#if dijelovi.prije}<span class="bot-ostatak">{dijelovi.prije}</span>{/if}<span class="bot-oznaka">BOT</span>{#if dijelovi.poslije}<span class="bot-ostatak">{dijelovi.poslije}</span>{/if}
  </span>
{:else}
  <span class={className} title={nadimak}>{nadimak}</span>
{/if}

<style>
  .nadimak-bota {
    white-space: nowrap;
  }

  .bot-oznaka {
    color: var(--boja-bot-oznaka);
    font-weight: 700;
  }
</style>
