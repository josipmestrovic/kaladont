<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  interface Profil {
    nadimak: string;
    email: string | null;
    emailPotvrdjen: boolean;
    odigrane: number;
    pobjede: number;
    eliminacijeUkupno: number;
    bodoviUkupno: number;
    prosjekBodova: number;
    rang: string;
  }

  let profil = $state<Profil | null>(null);
  let greska = $state<string | null>(null);

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje profila.';
    }
  });
</script>

<h1>Profil</h1>

{#if greska}
  <p role="alert">{greska}</p>
  <p><a href="/prijava">Prijavi se</a></p>
{:else if profil}
  <p>Nadimak: <strong>{profil.nadimak}</strong></p>
  <p>Rang: <strong>{profil.rang}</strong> (prosjek {profil.prosjekBodova.toFixed(2)} bodova)</p>
  <p>Odigrane partije: {profil.odigrane}</p>
  <p>Pobjede: {profil.pobjede}</p>
  <p>Ukupno eliminacija: {profil.eliminacijeUkupno}</p>
  <p>Ukupno bodova: {profil.bodoviUkupno}</p>
  {#if profil.email}
    <p>Email: {profil.email} {profil.emailPotvrdjen ? '(potvrđen)' : '(nije potvrđen)'}</p>
  {/if}
{:else}
  <p>Učitavanje...</p>
{/if}
