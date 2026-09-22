<script lang="ts">
</script>

<div class="scena-2d5d" aria-hidden="true">
  <div class="tijelo-slojevi">
    <img class="tijelo" src="/slike/2-5-d-components/Tube-body.png" alt="" />
    <img class="kapa" src="/slike/2-5-d-components/Cap.png" alt="" />
    <img class="ruka" src="/slike/2-5-d-components/Pointing-hand.png" alt="" />
    <img class="oblak" src="/slike/2-5-d-components/Speech-Bubble-kaladont.png" alt="" />
  </div>
</div>

<style>
  .scena-2d5d {
    position: relative;
    width: 390px;
    height: 470px;
    flex: 0 0 390px;
    overflow: hidden;
    perspective: 900px;
  }

  .tijelo-slojevi {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    animation: lagano-preturanje 6s ease-in-out infinite;
  }

  .tijelo-slojevi img {
    position: absolute;
    display: block;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
  }

  .tijelo {
    right: 93px;
    bottom: 0;
    width: 350px;
  }

  .kapa {
    top: -1px;
    right: 177px;
    z-index: 0;
    width: 303px;
    rotate: -21deg;
    animation: lebdenje-kape 3.8s ease-in-out infinite;
  }

  .ruka {
    top: 192px;
    right: 122px;
    z-index: 3;
    width: 182px;
    transform-origin: 20% 80%;
    animation: dizanje-palca 2.8s ease-in-out infinite;
  }

  .oblak {
    top: -28px;
    right: -7px;
    z-index: 4;
    width: 330px;
    transform-origin: 35% 80%;
    animation: lebdenje-oblaka 4s ease-in-out infinite;
    filter: drop-shadow(7px 10px 4px rgb(38 34 27 / 16%));
  }

  @keyframes lagano-preturanje {
    0%, 100% { transform: rotateY(-2deg) rotateX(1deg) translateY(0); }
    50% { transform: rotateY(3deg) rotateX(-1deg) translateY(-5px); }
  }

  @keyframes lebdenje-kape {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50% { transform: translateY(-5px) rotate(1deg); }
  }

  @keyframes dizanje-palca {
    0%, 100% { transform: translateY(4px) rotate(-6deg); }
    50% { transform: translateY(-7px) rotate(3deg); }
  }

  @keyframes lebdenje-oblaka {
    0%, 100% { transform: translate3d(0, 0, 0) rotateY(-3deg) rotateZ(-1deg); }
    50% { transform: translate3d(8px, -10px, 26px) rotateY(5deg) rotateZ(1deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .tijelo-slojevi,
    .oblak,
    .kapa,
    .ruka { animation: none; }
  }

  @media (max-width: 767px) {
    .scena-2d5d { display: none; }
  }
</style>
