/**
 * 📥 TRAER IMÁGENES AL SERVIDOR
 * ============================================================
 * Qué hace:
 *   Recorre TODOS los formularios y plantillas, junta las direcciones de
 *   Cloudinary (fotos y firmas) y le pide al servidor que se las baje UNA vez
 *   y las guarde en su disco (carpeta "imagenes-cache").
 *
 * Para qué:
 *   La red de la planta tiene bloqueado res.cloudinary.com. Una vez que el
 *   servidor tiene las copias, las sirve él mismo (misma IP) y la gente de
 *   planta puede ver las fotos y firmas sin depender de internet.
 *
 * Cloudinary sigue siendo el RESPALDO: no se borra nada de la nube.
 *
 * Cómo usarlo (desde la carpeta del proyecto):
 *   node scripts/traer-imagenes.mjs
 *   node scripts/traer-imagenes.mjs http://100.74.186.82:8096/api
 *
 * Es idempotente: si una imagen ya está en el servidor, no la vuelve a bajar.
 */

const BASE = process.argv[2] || process.env.API_BASE || 'http://100.74.186.82:8096/api';
const LOTE = 100; // cuántas direcciones se mandan por vez

const RX = /https:\/\/res\.cloudinary\.com\/[^"'\s)\\]*/g;

async function json(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} en ${url}`);
  return r.json();
}

/** Los "$values" de .NET aparecen cuando hay listas; los aplanamos. */
const lista = (x) => (x && x.$values) ? x.$values : (Array.isArray(x) ? x : []);

/** Saca las URLs de Cloudinary de un texto (JSON guardado como string o valor suelto). */
function urlsDe(valor) {
  if (valor == null) return [];
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  return texto.match(RX) || [];
}

async function juntarUrls() {
  const encontradas = new Set();

  console.log(`🔎 Leyendo formularios desde ${BASE} …`);
  const formularios = lista(await json(`${BASE}/FilledForms?pageSize=100000`));
  for (const f of formularios) {
    for (const u of [
      ...urlsDe(f.bodyData), ...urlsDe(f.headerData), ...urlsDe(f.firmasData),
    ]) encontradas.add(u);
  }
  console.log(`   formularios: ${formularios.length}`);

  try {
    const plantillas = lista(await json(`${BASE}/Templates`));
    for (const t of plantillas) {
      for (const u of urlsDe(t.bodyElements)) encontradas.add(u);
    }
    console.log(`   plantillas: ${plantillas.length}`);
  } catch (e) {
    console.log(`   (no se pudieron leer las plantillas: ${e.message})`);
  }

  return [...encontradas];
}

async function main() {
  const urls = await juntarUrls();
  console.log(`🖼️  Direcciones de Cloudinary encontradas: ${urls.length}`);
  if (urls.length === 0) return console.log('No hay nada para traer.');

  let bajadas = 0, yaEstaban = 0, fallidas = 0;
  const total = Math.ceil(urls.length / LOTE);

  for (let i = 0; i < urls.length; i += LOTE) {
    const lote = urls.slice(i, i + LOTE);
    const n = i / LOTE + 1;
    try {
      const r = await json(`${BASE}/Images/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: lote }),
      });
      bajadas += r.bajadas ?? 0;
      yaEstaban += r.yaEstaban ?? 0;
      fallidas += r.fallidas ?? 0;
      console.log(`   lote ${n}/${total}: +${r.bajadas} nuevas, ${r.yaEstaban} ya estaban, ${r.fallidas} fallidas`);
    } catch (e) {
      fallidas += lote.length;
      console.log(`   lote ${n}/${total}: ERROR ${e.message}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Listo.  Nuevas: ${bajadas} | Ya estaban: ${yaEstaban} | Fallidas: ${fallidas}`);
  console.log('   El servidor ya las puede mostrar sin depender de internet.');
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
