import type { Pagina } from "./access.ts";
import { verificaAccess } from "./access.ts";

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const email = process.env.ACCESS_EMAIL_PROPRIETARIO;
if (!token || !account || !email)
  throw new Error(
    "Servono CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID e ACCESS_EMAIL_PROPRIETARIO",
  );
await verificaAccess(
  async (percorso) => {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}${percorso}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!r.ok)
      throw new Error(
        `Verifica Access non riuscita (HTTP ${r.status}): deploy bloccato`,
      );
    return (await r.json()) as Pagina;
  },
  "utopia-ucronia.marcoranica.com",
  email,
);
console.log(
  "Access verificato: dominio esatto, tre indirizzi email espliciti incluso il proprietario e nessuna eccezione pubblica.",
);
