export {};

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const email = process.env.ACCESS_EMAIL_PROPRIETARIO;
const dominio = "utopia-ucronia.marcoranica.com";
if (!token || !account || !email)
  throw new Error(
    "Servono CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID e ACCESS_EMAIL_PROPRIETARIO per verificare Access prima del deploy",
  );
async function api(p: string) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}${p}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  const body = (await r.json()) as { success: boolean; result: unknown };
  if (!r.ok || !body.success)
    throw new Error(
      "Verifica Access non riuscita: controllare i permessi Access in lettura del token",
    );
  return body.result;
}
type Policy = {
  decision: string;
  include?: { email?: { email: string } }[];
  require?: unknown[];
  exclude?: unknown[];
};
const apps = (await api("/access/apps?per_page=1000")) as {
  id: string;
  domain: string;
  type: string;
}[];
const app = apps.find((a) => a.domain === dominio && a.type === "self_hosted");
if (!app)
  throw new Error(
    "Applicazione Access esatta per il dominio non trovata: deploy bloccato",
  );
const policies = (await api(`/access/apps/${app.id}/policies`)) as Policy[];
const allows = policies.filter((p) => p.decision === "allow");
if (
  policies.some((p) => !["allow", "deny"].includes(p.decision)) ||
  !allows.length ||
  allows.some(
    (p) =>
      !p.include?.length ||
      p.include.some(
        (rule) =>
          Object.keys(rule).length !== 1 ||
          rule.email?.email.toLowerCase() !== email.toLowerCase(),
      ),
  )
)
  throw new Error(
    "Access non è limitato alla sola email del proprietario: deploy bloccato",
  );
console.log(
  "Access verificato: dominio esatto, sola email del proprietario, nessuna policy bypass o service_auth.",
);
