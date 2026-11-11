export type Pagina = {
  success: boolean;
  result: unknown;
  result_info?: { page?: number; total_pages?: number; total_count?: number };
};
export type Carica = (percorso: string) => Promise<Pagina>;
type App = {
  id: string;
  domain: string;
  type: string;
  destinations?: { uri?: string; overrides?: { behavior?: string }[] }[];
};
type Policy = { decision: string; include?: Record<string, unknown>[] };
export async function elenco(
  carica: Carica,
  percorso: string,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let totale = 1;
  for (let pagina = 1; pagina <= totale; pagina++) {
    const risposta = await carica(`${percorso}?per_page=1000&page=${pagina}`);
    if (
      !risposta.success ||
      !Array.isArray(risposta.result) ||
      !risposta.result_info ||
      !Number.isInteger(risposta.result_info.total_pages) ||
      risposta.result_info.page !== pagina
    )
      throw new Error("Risposta Access incompleta: deploy bloccato");
    totale = risposta.result_info.total_pages ?? 0;
    if (totale > 1000) throw new Error("Troppe pagine Access: deploy bloccato");
    items.push(...risposta.result);
    if (pagina === totale && risposta.result_info.total_count !== items.length)
      throw new Error("Numero di risultati Access incoerente: deploy bloccato");
  }
  return items;
}
export async function verificaAccess(
  carica: Carica,
  dominio: string,
  email: string,
): Promise<void> {
  const apps = (await elenco(carica, "/access/apps")) as App[];
  const app = apps.find(
    (a) => a.domain === dominio && a.type === "self_hosted",
  );
  if (!app || apps.filter((a) => a.domain === dominio).length !== 1)
    throw new Error(
      "Applicazione Access esatta non trovata o ambigua: deploy bloccato",
    );
  if (
    apps.some(
      (a) =>
        a.id !== app.id &&
        (a.domain?.startsWith(`${dominio}/`) ||
          a.destinations?.some(
            (d) => d.uri === dominio || d.uri?.startsWith(`${dominio}/`),
          )),
    )
  )
    throw new Error(
      "Altra applicazione Access sul dominio o su un suo percorso: deploy bloccato",
    );
  if (
    app.destinations?.some((d) =>
      d.overrides?.some((o) => o.behavior === "public"),
    )
  )
    throw new Error("Eccezione pubblica Access rilevata: deploy bloccato");
  const policies = (await elenco(
    carica,
    `/access/apps/${encodeURIComponent(app.id)}/policies`,
  )) as Policy[];
  const allows = policies.filter((p) => p.decision === "allow");
  if (
    policies.some((p) => !["allow", "deny"].includes(p.decision)) ||
    !allows.length ||
    allows.some(
      (p) =>
        !p.include?.length ||
        p.include.some((rule) => {
          const value = rule.email;
          return (
            Object.keys(rule).length !== 1 ||
            !value ||
            typeof value !== "object" ||
            typeof (value as { email?: unknown }).email !== "string" ||
            (value as { email: string }).email.toLowerCase() !==
              email.toLowerCase()
          );
        }),
    )
  )
    throw new Error(
      "Access non è limitato alla sola email del proprietario: deploy bloccato",
    );
}
