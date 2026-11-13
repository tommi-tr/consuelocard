// API dei mazzi: GET (leggi), POST (crea), PUT (aggiorna).
// Ogni mazzo è salvato in Redis (Upstash) sotto la chiave "deck:<CODICE>".
// Chi non conosce il codice non può né leggere né modificare il mazzo.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // niente 0/O, 1/I/L
const CODE_LEN = 8;
const MAX_CARDS = 500;
const MAX_CARD_LEN = 400;
const MAX_NAME_LEN = 80;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis(cmd) {
  const cfg = redisConfig();
  if (!cfg) throw Object.assign(new Error("Database non configurato"), { status: 503 });
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `Redis HTTP ${r.status}`);
  return data.result;
}

function newCode() {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function normalizeCode(raw) {
  const c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== CODE_LEN) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

function cleanDeck(body) {
  if (!body || typeof body !== "object") return { error: "Dati mancanti" };
  const name = String(body.name || "").trim().slice(0, MAX_NAME_LEN);
  if (!Array.isArray(body.cards)) return { error: "Carte mancanti" };
  const cards = body.cards
    .map((c) => String(c ?? "").trim().slice(0, MAX_CARD_LEN))
    .filter(Boolean);
  if (cards.length > MAX_CARDS) return { error: `Massimo ${MAX_CARDS} carte` };
  return { deck: { name, cards, updatedAt: Date.now() } };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const code = normalizeCode(req.query.code);
      if (!code) return res.status(404).json({ error: "Mazzo non trovato" });
      const raw = await redis(["GET", `deck:${code}`]);
      if (!raw) return res.status(404).json({ error: "Mazzo non trovato" });
      return res.status(200).json({ code, ...JSON.parse(raw) });
    }

    if (req.method === "POST") {
      const { deck, error } = cleanDeck(await readBody(req));
      if (error) return res.status(400).json({ error });
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const ok = await redis(["SET", `deck:${code}`, JSON.stringify(deck), "NX"]);
        if (ok === "OK") return res.status(201).json({ code, ...deck });
      }
      return res.status(500).json({ error: "Impossibile generare un codice, riprova" });
    }

    if (req.method === "PUT") {
      const code = normalizeCode(req.query.code);
      if (!code) return res.status(404).json({ error: "Mazzo non trovato" });
      const { deck, error } = cleanDeck(await readBody(req));
      if (error) return res.status(400).json({ error });
      // XX = aggiorna solo se esiste già: non si possono "inventare" codici.
      const ok = await redis(["SET", `deck:${code}`, JSON.stringify(deck), "XX"]);
      if (ok !== "OK") return res.status(404).json({ error: "Mazzo non trovato" });
      return res.status(200).json({ code, ...deck });
    }

    res.setHeader("Allow", "GET, POST, PUT");
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || "Errore del server" });
  }
}
