<script lang="ts">
  import PravilaSadrzaj from '$lib/komponente/PravilaSadrzaj.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PravilaSadrzaj tema={data.tema} />
