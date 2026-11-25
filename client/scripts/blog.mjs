// Blog de ZUMI: convierte client/blog/*.md en páginas del sitio y publica solo las que ya llegaron a
// su fecha (las demás esperan: el sitio se vuelve a publicar solo cada semana). También arma
// /blog/, sitemap.xml, robots.txt y feed.xml para Google.
//   node client/scripts/blog.mjs client/blog _sitio [AAAA-MM-DD]
import fs from 'fs'
import path from 'path'

const [origen = 'client/blog', destino = '_sitio', hoyArg] = process.argv.slice(2)
const HOY = hoyArg ?? new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) // hora de Chile
const SITIO = 'https://zumichile.com'
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaLarga = (f) => `${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`

function leer(archivo) {
  const t = fs.readFileSync(archivo, 'utf8')
  const m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error(`Falta el encabezado en ${archivo}`)
  const meta = Object.fromEntries(m[1].split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]))
  return { ...meta, slug: path.basename(archivo, '.md'), cuerpo: m[2] }
}

// Markdown mínimo: ## títulos, párrafos, listas (- y 1.), **negrita** y [enlaces](url)
function html(md) {
  const enLinea = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${u.startsWith('http') ? ' rel="noopener"' : ''}>${t}</a>`)
  const out = []
  let lista = null
  const cerrar = () => {
    if (lista) out.push(`</${lista}>`)
    lista = null
  }
  for (const bloque of md.trim().split(/\n\s*\n/)) {
    const lineas = bloque.split('\n')
    if (/^#{2,3} /.test(lineas[0])) {
      cerrar()
      const n = lineas[0].startsWith('### ') ? 3 : 2
      out.push(`<h${n}>${enLinea(lineas[0].replace(/^#+ /, ''))}</h${n}>`)
      continue
    }
    if (lineas.every((l) => /^(- |\d+\. )/.test(l))) {
      const tipo = /^\d+\. /.test(lineas[0]) ? 'ol' : 'ul'
      if (lista !== tipo) {
        cerrar()
        out.push(`<${tipo}>`)
        lista = tipo
      }
      for (const l of lineas) out.push(`<li>${enLinea(l.replace(/^(- |\d+\. )/, ''))}</li>`)
      cerrar()
      continue
    }
    cerrar()
    out.push(`<p>${enLinea(lineas.join(' '))}</p>`)
  }
  cerrar()
  return out.join('\n')
}

const CSS = `@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/fuentes/archivo.woff2) format('woff2')}
:root{--noche:#0f1d2e;--glaciar:#eef3f6;--tinta:#14202c;--pizarra:#536577;--linea:#d5dfe6;--panda:#c8501f}
*{box-sizing:border-box}body{margin:0;font-family:'Archivo',system-ui,sans-serif;background:#fff;color:var(--tinta);font-size:18px;line-height:1.6}
a{color:var(--panda)}
.cab{background:var(--noche);color:#fff}.cab div{max-width:760px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;gap:10px}
.cab a.marca{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:900;font-size:22px}.cab img{width:34px;height:34px;border-radius:10px}
.cab a.btn{margin-left:auto}
.btn{display:inline-block;background:var(--panda);color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;font-size:16px;line-height:1.2}
main{max-width:760px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:clamp(30px,6vw,44px);line-height:1.08;margin:6px 0 12px;font-variation-settings:'wdth' 80;letter-spacing:-.01em}
h2{font-size:24px;line-height:1.2;margin:34px 0 8px}h3{font-size:20px;margin:24px 0 6px}
.meta{color:var(--pizarra);font-size:15px}
.zumi-dice{display:flex;gap:14px;align-items:flex-end;background:var(--glaciar);border-radius:22px;padding:16px;margin:28px 0}
.zumi-dice img{width:92px;height:auto;flex:none}.zumi-dice p{margin:0}
.cta{background:var(--noche);color:#fff;border-radius:24px;padding:24px;margin-top:40px;display:flex;gap:18px;align-items:center}
.cta img{width:110px;flex:none}.cta h2{margin:0 0 6px;color:#fff}.cta p{margin:0 0 14px;color:#c3d2e1}
.lista{list-style:none;padding:0}.lista li{border-bottom:1px solid var(--linea);padding:18px 0}.lista a{text-decoration:none;color:var(--tinta)}
.lista h2{margin:0 0 4px;font-size:22px}.lista p{margin:0;color:var(--pizarra)}
footer{max-width:760px;margin:0 auto;padding:20px 16px 40px;color:var(--pizarra);font-size:14px}
@media(max-width:560px){.cta{flex-direction:column;text-align:center}}`

const cabecera = `<header class="cab"><div><a class="marca" href="/"><img src="/img/zumi-icono-64.png" alt="" width="34" height="34">ZUMI</a><a class="btn" href="/app/">Abrir ZUMI gratis</a></div></header>`
const pie = `<footer>ZUMI no es una app del Gobierno. Las alertas vienen de fuentes oficiales (SENAPRED, SHOA, CSN, SERNAGEOMIN). Ante una emergencia, sigue siempre las instrucciones de la autoridad. · <a href="/blog/">Blog</a> · <a href="/privacidad.html">Privacidad</a></footer>`
const pagina = ({ titulo, descripcion, url, cuerpo, extraHead = '' }) => `<!doctype html>
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${url}"><link rel="icon" href="/img/zumi-icono.png" type="image/png">
<link rel="alternate" type="application/rss+xml" title="Blog de ZUMI" href="${SITIO}/blog/feed.xml">
<meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descripcion)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITIO}/img/zumi-icono.png"><meta property="og:locale" content="es_CL">
${extraHead}<style>${CSS}</style></head><body>${cabecera}${cuerpo}${pie}</body></html>`

const posts = fs
  .readdirSync(origen)
  .filter((f) => f.endsWith('.md'))
  .map((f) => leer(path.join(origen, f)))
  .sort((a, b) => b.fecha.localeCompare(a.fecha))
const publicados = posts.filter((p) => p.fecha <= HOY)

const cta = `<aside class="cta"><img src="/img/poses/saludo.webp" alt="" width="110"><div><h2>ZUMI te avisa antes.</h2><p>Alertas oficiales de SENAPRED, sismos y tsunamis en tu comuna, explicadas en simple por un panda rojo que te cuida. Gratis.</p><a class="btn" href="/app/">Abrir ZUMI gratis</a></div></aside>`

for (const p of publicados) {
  const url = `${SITIO}/blog/${p.slug}/`
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: p.titulo, description: p.descripcion, datePublished: p.fecha, inLanguage: 'es-CL', author: { '@type': 'Organization', name: 'ZUMI' }, publisher: { '@type': 'Organization', name: 'ZUMI', logo: { '@type': 'ImageObject', url: `${SITIO}/img/zumi-icono.png` } }, mainEntityOfPage: url }
  const zumi = p.zumi ? `<div class="zumi-dice"><img src="/img/poses/${p.pose || 'explicando'}.webp" alt="ZUMI" width="92"><p><strong>ZUMI dice:</strong> ${esc(p.zumi)}</p></div>` : ''
  const cuerpo = `<main><p class="meta"><a href="/blog/">Blog de ZUMI</a> · ${fechaLarga(p.fecha)}</p><article><h1>${esc(p.titulo)}</h1>${zumi}${html(p.cuerpo)}</article>${cta}</main>`
  const dir = path.join(destino, 'blog', p.slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), pagina({ titulo: `${p.titulo} | ZUMI`, descripcion: p.descripcion, url, cuerpo, extraHead: `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n` }))
}

const indice = `<main><h1>Prepárate con ZUMI</h1><p class="meta">Guías simples para enfrentar sismos, tsunamis, lluvias, volcanes e incendios en Chile, con lo que dicen las fuentes oficiales.</p><ul class="lista">${publicados
  .map((p) => `<li><a href="/blog/${p.slug}/"><h2>${esc(p.titulo)}</h2><p>${esc(p.descripcion)}</p><p class="meta">${fechaLarga(p.fecha)}</p></a></li>`)
  .join('')}</ul>${cta}</main>`
fs.mkdirSync(path.join(destino, 'blog'), { recursive: true })
fs.writeFileSync(path.join(destino, 'blog', 'index.html'), pagina({ titulo: 'Blog de ZUMI: prepárate para emergencias en Chile', descripcion: 'Guías simples sobre sismos, tsunamis, lluvias, volcanes e incendios en Chile, con información de fuentes oficiales.', url: `${SITIO}/blog/`, cuerpo: indice }))

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog de ZUMI</title><link>${SITIO}/blog/</link><description>Prepárate para emergencias en Chile con ZUMI</description><language>es-cl</language>${publicados
  .map((p) => `<item><title>${esc(p.titulo)}</title><link>${SITIO}/blog/${p.slug}/</link><guid>${SITIO}/blog/${p.slug}/</guid><pubDate>${new Date(`${p.fecha}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(p.descripcion)}</description></item>`)
  .join('')}</channel></rss>`
fs.writeFileSync(path.join(destino, 'blog', 'feed.xml'), rss)

const urls = [`${SITIO}/`, `${SITIO}/app/`, `${SITIO}/blog/`, ...publicados.map((p) => `${SITIO}/blog/${p.slug}/`), `${SITIO}/privacidad.html`, `${SITIO}/terminos.html`]
fs.writeFileSync(path.join(destino, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`)
fs.writeFileSync(path.join(destino, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /panel/\nDisallow: /soporte/\nSitemap: ${SITIO}/sitemap.xml\n`)
console.log(`Blog: ${publicados.length} publicados, ${posts.length - publicados.length} esperando su fecha (hoy ${HOY}).`)
