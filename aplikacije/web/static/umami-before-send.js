/**
 * Sinkroni Umami before-send handler — mora se učitati PRIJE defer trackera.
 * Logika usklađena s aplikacije/web/src/lib/umami-sanitizacija.ts (testovi pokrivaju TS).
 */
(function () {
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var UUID =
    '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  var ID = '[A-Za-z0-9_-]{8,}';
  var KOD = '[A-Za-z0-9]{4,12}';
  var PUTANJE = [
    { u: new RegExp('^/partija/arhiva/' + UUID + '$', 'i'), z: '/partija/arhiva/:id' },
    { u: new RegExp('^/partija/' + UUID + '$', 'i'), z: '/partija/:id' },
    { u: new RegExp('^/partija/' + ID + '$', 'i'), z: '/partija/:id' },
    { u: new RegExp('^/soba/' + KOD + '$', 'i'), z: '/soba/:kod' },
    { u: new RegExp('^/profil/javni/' + UUID + '$', 'i'), z: '/profil/javni/:id' },
    { u: new RegExp('^/profil/javni/' + ID + '$', 'i'), z: '/profil/javni/:id' },
    { u: new RegExp('^/pravila-kaladonta/' + ID + '$', 'i'), z: '/pravila-kaladonta/:tema' },
  ];
  var NASLOV_UUID = new RegExp(UUID, 'ig');

  function putanja(p) {
    var cista = String(p || '/').split('?')[0].split('#')[0] || '/';
    for (var i = 0; i < PUTANJE.length; i++) {
      if (PUTANJE[i].u.test(cista)) return PUTANJE[i].z;
    }
    return cista;
  }

  function query(params) {
    var out = new URLSearchParams();
    for (var i = 0; i < UTM.length; i++) {
      var v = params.get(UTM[i]);
      if (v) out.set(UTM[i], v);
    }
    var t = out.toString();
    return t ? '?' + t : '';
  }

  function sanitizirajUrl(sirovi, baza) {
    var url = new URL(sirovi, baza);
    return putanja(url.pathname) + query(url.searchParams);
  }

  function sanitizirajReferrer(sirovi, baza) {
    if (!sirovi) return '';
    try {
      var url = new URL(sirovi, baza);
      var p = putanja(url.pathname) + query(url.searchParams);
      var lokalni = typeof location !== 'undefined' ? location.origin : 'https://kaladont.hr';
      if (url.origin === lokalni || url.origin === 'https://kaladont.hr') return p;
      return url.origin + p;
    } catch (e) {
      return '';
    }
  }

  function sanitizirajNaslov(naslov) {
    if (typeof naslov !== 'string') return '';
    return naslov.replace(NASLOV_UUID, ':id');
  }

  window.kaladontUmamiBeforeSend = function (_type, payload) {
    try {
      if (!payload || typeof payload !== 'object') return false;
      var baza =
        typeof location !== 'undefined' && location.origin
          ? location.origin
          : 'https://kaladont.hr';
      var rezultat = {};
      for (var k in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) rezultat[k] = payload[k];
      }
      if (typeof rezultat.url === 'string') {
        rezultat.url = sanitizirajUrl(rezultat.url, baza);
      }
      if (typeof rezultat.referrer === 'string') {
        rezultat.referrer = sanitizirajReferrer(rezultat.referrer, baza);
      }
      if ('title' in rezultat) {
        rezultat.title = sanitizirajNaslov(rezultat.title);
      }
      return rezultat;
    } catch (e) {
      return false;
    }
  };
})();
