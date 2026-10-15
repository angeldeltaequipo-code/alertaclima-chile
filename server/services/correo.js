// Correos con Resend (https://resend.com). Inactivo hasta que existan RESEND_API_KEY y CORREO_DESDE
// (una dirección de un dominio verificado en Resend, p. ej. "AlertaClima <hola@alertaclima.cl>").
//
// Privacidad: el correo de la persona NO se guarda. Solo se usa una vez, en el momento en que crea
// su cuenta, para enviarle la bienvenida.

const APP = 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'

export const correosActivos = () => Boolean(process.env.RESEND_API_KEY && process.env.CORREO_DESDE)

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function correoBienvenida(nombre) {
  const n = escapar(nombre.split(' ')[0])
  return {
    asunto: `¡Bienvenido a AlertaClima, ${nombre.split(' ')[0]}!`,
    texto: `Hola ${nombre.split(' ')[0]}, soy ZUMI.\n\nYa tienes tu cuenta en AlertaClima. Ahora puedes conversar con tus vecinos, reportar lo que pasa en tu calle y recibir avisos de alertas.\n\nTres cosas para empezar:\n1. Activa las notificaciones para enterarte de las alertas de tu comuna.\n2. Agrega tus contactos de emergencia en el botón SOS.\n3. Toca el botón de ZUMI para que te cuente el clima en voz alta.\n\nAbrir AlertaClima: ${APP}\n\nEn una emergencia llama al 133 (Carabineros), 132 (Bomberos) o 131 (SAMU).\nNo guardamos tu correo: este es el único mensaje que te enviaremos.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111c2e;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 28px 8px;text-align:center"><img src="${APP}zumi/zumi-cara.png" width="96" height="96" alt="ZUMI" style="border-radius:48px;display:inline-block"></td></tr>
<tr><td style="padding:8px 28px 0;text-align:center"><h1 style="margin:0;font-size:26px;color:#fff">¡Hola, ${n}!</h1>
<p style="margin:10px 0 0;font-size:17px;line-height:1.5;color:#cbd5e1">Soy ZUMI. Ya tienes tu cuenta en AlertaClima: ahora puedes conversar con tus vecinos, reportar lo que pasa en tu calle y recibir avisos de alertas.</p></td></tr>
<tr><td style="padding:22px 28px 0"><p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#fff">Tres cosas para empezar</p>
<p style="margin:0;font-size:16px;line-height:1.7;color:#cbd5e1">1. Activa las notificaciones de tu comuna.<br>2. Agrega tus contactos de emergencia en el botón <b style="color:#f87171">SOS</b>.<br>3. Toca a ZUMI para escuchar el clima en voz alta.</p></td></tr>
<tr><td style="padding:24px 28px;text-align:center"><a href="${APP}" style="display:inline-block;background:#fbbf24;color:#111827;font-weight:bold;font-size:17px;text-decoration:none;padding:14px 28px;border-radius:999px">Abrir AlertaClima</a></td></tr>
<tr><td style="padding:0 28px 26px;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center">Emergencias: 133 Carabineros · 132 Bomberos · 131 SAMU.<br>No guardamos tu correo: este es el único mensaje que te enviaremos.</td></tr>
</table></td></tr></table></body></html>`,
  }
}

/** Envía un correo. Nunca lanza: un correo que falla no debe impedir que la persona entre. */
export async function enviarCorreo({ para, asunto, html, texto }, { fetchFn = fetch } = {}) {
  if (!correosActivos() || !para) return { enviado: false }
  try {
    const r = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.CORREO_DESDE, to: [para], subject: asunto, html, text: texto }),
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) console.error('Resend respondió', r.status)
    return { enviado: r.ok }
  } catch (e) {
    console.error('Correo falló:', e.message)
    return { enviado: false }
  }
}
