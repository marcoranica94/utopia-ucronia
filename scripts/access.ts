export type Page = {
  success: boolean;
  result: unknown;
  result_info?: { page?: number; total_pages?: number; total_count?: number };
};
export type Fetcher = (path: string) => Promise<Page>;
type App = {
  id: string;
  domain: string;
  type: string;
  destinations?: { uri?: string; overrides?: { behavior?: string }[] }[];
};
type Policy = { decision: string; include?: Record<string, unknown>[] };
export async function list(fetcher: Fetcher, path: string): Promise<unknown[]> {
  const items: unknown[] = [];
  let total = 1;
  for (let page = 1; page <= total; page++) {
    const response = await fetcher(`${path}?per_page=1000&page=${page}`);
    if (
      !response.success ||
      !Array.isArray(response.result) ||
      !response.result_info ||
      !Number.isInteger(response.result_info.total_pages) ||
      response.result_info.page !== page
    )
      throw new Error("Incomplete Access response: deploy blocked");
    total = response.result_info.total_pages ?? 0;
    if (total > 1000) throw new Error("Too many Access pages: deploy blocked");
    items.push(...response.result);
    if (page === total && response.result_info.total_count !== items.length)
      throw new Error("Inconsistent Access result count: deploy blocked");
  }
  return items;
}
export async function verifyAccess(
  fetcher: Fetcher,
  domain: string,
  email: string,
): Promise<void> {
  const apps = (await list(fetcher, "/access/apps")) as App[];
  const app = apps.find((a) => a.domain === domain && a.type === "self_hosted");
  if (!app || apps.filter((a) => a.domain === domain).length !== 1)
    throw new Error(
      "Exact Access application not found or ambiguous: deploy blocked",
    );
  if (
    apps.some(
      (a) =>
        a.id !== app.id &&
        (a.domain?.startsWith(`${domain}/`) ||
          a.destinations?.some(
            (d) => d.uri === domain || d.uri?.startsWith(`${domain}/`),
          )),
    )
  )
    throw new Error(
      "Another Access application on the domain or on one of its paths: deploy blocked",
    );
  if (
    app.destinations?.some((d) =>
      d.overrides?.some((o) => o.behavior === "public"),
    )
  )
    throw new Error("Public Access exception found: deploy blocked");
  const policies = (await list(
    fetcher,
    `/access/apps/${encodeURIComponent(app.id)}/policies`,
  )) as Policy[];
  const allows = policies.filter((p) => p.decision === "allow");
  const addresses = allows.flatMap((p) =>
    (p.include ?? []).map(
      (r) => (r.email as { email?: unknown } | undefined)?.email,
    ),
  );
  const summary = policies.map((p) => ({
    decision: p.decision,
    selectors: (p.include ?? []).map((rule) => ({
      types: Object.keys(rule),
      email_matches:
        typeof (rule.email as { email?: unknown } | undefined)?.email ===
          "string" &&
        (rule.email as { email: string }).email.toLowerCase() ===
          email.toLowerCase(),
    })),
  }));
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
            !(value as { email: string }).email.includes("@")
          );
        }),
    ) ||
    addresses.length !== 3 ||
    new Set(
      addresses.map((a) => (typeof a === "string" ? a.toLowerCase() : "")),
    ).size !== 3 ||
    !addresses.some(
      (a) => typeof a === "string" && a.toLowerCase() === email.toLowerCase(),
    )
  )
    throw new Error(
      `Policy details (without addresses): ${JSON.stringify(summary)}. ` +
        "Access must allow exactly three distinct email addresses, including the owner's: deploy blocked",
    );
}
