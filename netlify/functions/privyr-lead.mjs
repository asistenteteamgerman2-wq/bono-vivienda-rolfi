// Envía cada caso completado en el verificador a Privyr como un nuevo cliente.
// La URL del webhook de Privyr se guarda en Netlify como variable de entorno
// PRIVYR_WEBHOOK_URL, para que no quede visible en la página ni en GitHub.

const MAX_FIELDS = 20;

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Método no permitido' }, { status: 405 });
  }

  const webhook = (process.env.PRIVYR_WEBHOOK_URL || '').split('#')[0].trim();
  if (!webhook.startsWith('https://www.privyr.com/')) {
    return Response.json({ ok: false, error: 'Falta configurar PRIVYR_WEBHOOK_URL' }, { status: 500 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Datos no válidos' }, { status: 400 });
  }

  // Campo trampa: las personas no lo ven; los robots suelen llenarlo.
  if (clean(data.empresa, 100)) {
    return Response.json({ ok: true });
  }

  const name = clean(data.name, 120);
  const phone = clean(data.phone, 25).replace(/[^\d+]/g, '');
  if (!name || phone.replace(/\D/g, '').length < 10) {
    return Response.json({ ok: false, error: 'Faltan nombre o teléfono' }, { status: 400 });
  }

  const other = {};
  if (data.other_fields && typeof data.other_fields === 'object') {
    for (const [k, v] of Object.entries(data.other_fields).slice(0, MAX_FIELDS)) {
      const key = clean(k, 60);
      if (key) other[key] = clean(v, 400);
    }
  }

  const payload = {
    name,
    phone,
    display_name: clean(data.display_name, 60) || name.split(' ')[0],
    other_fields: other,
  };

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.text();
    return Response.json({ ok: r.ok, status: r.status, privyr: body.slice(0, 300) }, { status: r.ok ? 200 : 502 });
  } catch (err) {
    return Response.json({ ok: false, error: 'No se pudo contactar a Privyr' }, { status: 502 });
  }
};

export const config = { path: '/api/privyr-lead' };
