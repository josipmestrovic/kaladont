<script lang="ts">
  import { bojaBordera, debljinaBorderaRanga } from '$lib/avatari.js';

  interface Props {
    rang?: string | null;
    velicina?: number;
  }

  let { rang = null, velicina = 380 }: Props = $props();
  const border = $derived(bojaBordera(rang));
  const debljina = $derived(border ? debljinaBorderaRanga(velicina) : 0);
</script>

<div
  class="avatar-referenca"
  class:ima-rang-border={border !== null}
  style:width={`${velicina}px`}
  style:height={`${velicina}px`}
  style:--boja-rang={border ?? 'transparent'}
  style:--debljina-rang="{debljina}px"
>
  <img src="/avatari/dokaz/avatar-referenca.svg" alt="Referentni Kaladont avatar" />
</div>

<style>
  .avatar-referenca {
    display: inline-flex;
    overflow: hidden;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    box-sizing: border-box;
  }

  .avatar-referenca.ima-rang-border {
    box-shadow: 0 0 0 var(--debljina-rang, 3px) var(--boja-rang, transparent);
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
