<script lang="ts">
  import { bojaBordera } from '$lib/avatari.js';

  interface Props {
    rang?: string | null;
    velicina?: number;
  }

  let { rang = null, velicina = 380 }: Props = $props();
  const border = $derived(bojaBordera(rang));
</script>

<div
  class="avatar-referenca"
  style:width={`${velicina}px`}
  style:height={`${velicina}px`}
  style:border={border ? `4px solid ${border}` : '4px solid transparent'}
  style:--boja-rang={border ?? 'transparent'}
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
    box-shadow: 0 0 0 3px var(--boja-rang, transparent);
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
