# Consuelo · carte

Sito per creare mazzi di carte (una frase per carta) ed estrarle a caso.
Ogni mazzo ha un codice di 8 caratteri: chi non lo conosce non può vederlo né modificarlo.

- `index.html` – interfaccia (home, editor, estrazione)
- `api/deck.js` – API serverless Vercel (GET / POST / PUT) che salva i mazzi su Redis (Upstash)

## Deploy su Vercel

1. Su vercel.com → **Add New → Project** → importa questo repository (nessuna configurazione di build necessaria).
2. Nel progetto → **Storage** → **Create Database** → **Upstash for Redis** (piano gratuito) → collegalo al progetto.
   Vercel aggiunge da solo le variabili `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. **Redeploy** (Deployments → ⋯ → Redeploy) per far leggere le nuove variabili.

In alternativa si possono impostare a mano `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
