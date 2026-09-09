<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import Avatar from './Avatar.svelte';

  interface Profil {
    nadimak: string;
    avatarId: number;
    rang: string | null;
    email: string | null;
  }

  let profil = $state<Profil | null>(null);
  let jeGost = $state(true);

  onMount(async () => {
    try {
      const odgovor = await api<Profil>('/profil');
      profil = odgovor;
      jeGost = !odgovor.email;
    } catch {
      // Neuspjelo dohvaćanje (npr. istekao token) - prikaži gosta bez rušenja stranice
      jeGost = true;
    }
  });
</script>

<header class="header">
  <div class="pozdrav">
    {#if profil && !jeGost}
      <span>Bok, {profil.nadimak}!</span>
    {:else}
      <span>Igraš kao gost — bodovi i dostignuća se neće trajno sačuvati</span>
    {/if}
  </div>

  <div class="desno">
    <a href="/" class="link">Početna</a>
    <a href="/ljestvica" class="link">Ljestvica</a>
    {#if profil}
      <Avatar avatarId={profil.avatarId} rang={profil.rang} gost={jeGost} velicina={32} />
    {/if}
    <a href="/postavke" class="link postavke" aria-label="Postavke">⚙</a>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: white;
    border-bottom: 1px solid #e5ddc8;
    font-size: var(--tekst-baza);
  }

  .pozdrav {
    color: var(--boja-tekst-osnovni);
  }

  .desno {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .link {
    color: var(--boja-tekst-naslov);
    text-decoration: none;
    font-weight: bold;
  }

  .link:hover {
    text-decoration: underline;
  }

  .postavke {
    font-size: 18px;
  }
</style>
