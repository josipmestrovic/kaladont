<script lang="ts">
  import { Eye, EyeOff } from 'lucide-svelte';

  let {
    vrijednost = $bindable(''),
    oznaka = 'Lozinka',
    najmanjaDuljina,
    required = true,
  }: {
    vrijednost?: string;
    oznaka?: string;
    najmanjaDuljina?: number;
    required?: boolean;
  } = $props();

  let vidljiva = $state(false);
</script>

<div class="labela">
  {oznaka}
  <span class="unos-omot">
    <input
      type={vidljiva ? 'text' : 'password'}
      aria-label={oznaka}
      bind:value={vrijednost}
      minlength={najmanjaDuljina}
      {required}
    />
    <label class="vidljivost" aria-label={vidljiva ? 'Sakrij lozinku' : 'Prikaži lozinku'}>
      <input class="skrivena-kontrola" type="checkbox" bind:checked={vidljiva} />
      {#if vidljiva}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
    </label>
  </span>
</div>

<style>
  .labela { display: flex; flex-direction: column; gap: 6px; font-weight: 600; font-size: var(--tekst-sitni); }
  .unos-omot { position: relative; display: block; }
  input { box-sizing: border-box; width: 100%; padding: 12px 48px 12px 16px; font-size: 18px; border: 2px solid #e5ddc8; border-radius: var(--radijus-kartica); }
  .vidljivost { position: absolute; top: 50%; right: 8px; display: grid; width: 36px; height: 36px; border-radius: 50%; place-items: center; color: var(--boja-tekst-sekundarni); cursor: pointer; transform: translateY(-50%); }
  .skrivena-kontrola { position: absolute; width: 1px; height: 1px; opacity: 0; }
</style>