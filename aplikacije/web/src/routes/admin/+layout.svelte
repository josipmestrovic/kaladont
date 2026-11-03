<script lang="ts">
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    const prethodnaTema = document.documentElement.getAttribute('data-tema');
    document.documentElement.setAttribute('data-tema', 'svijetla');
    return () => {
      if (prethodnaTema) document.documentElement.setAttribute('data-tema', prethodnaTema);
      else document.documentElement.removeAttribute('data-tema');
    };
  });
</script>

<nav class="admin-podnavigacija" aria-label="Admin odjeljci">
  <a href="/admin">Nadzor</a>
  <a href="/admin/prijave">Prijave</a>
  <a href="/admin/rjecnik">Rječnik</a>
</nav>

{@render children()}

<style>
  .admin-podnavigacija {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0 0 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ddd;
  }

  .admin-podnavigacija a {
    color: #333;
    font-weight: 700;
    text-decoration: none;
  }

  .admin-podnavigacija a:hover {
    text-decoration: underline;
  }
</style>
