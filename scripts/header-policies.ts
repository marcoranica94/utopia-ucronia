/** CSP policies from the path-only _headers rules used by this static site.
 * Cloudflare joins matching policies; browsers enforce every policy.
 * Fail closed if the configuration grows beyond the supported syntax.
 */
export function contentPolicies(headers: string, pathname: string): string[] {
  const policies: string[] = [];
  let matches = false;
  for (const raw of headers.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      if (!line.startsWith("/") || line.includes(":"))
        throw new Error(`Unsupported header pattern: ${line}`);
      const pattern = line
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      matches = new RegExp(`^${pattern}$`).test(pathname);
    } else if (matches && /^Content-Security-Policy:/i.test(line)) {
      policies.push(line.slice(line.indexOf(":") + 1).trim());
    } else if (matches && /^!\s*Content-Security-Policy$/i.test(line)) {
      policies.length = 0;
    }
  }
  return policies;
}

export function allowsSameOriginScripts(policies: string[]): boolean {
  return (
    policies.length > 0 &&
    policies.every((policy) => {
      const directives = new Map(
        policy.split(";").map((part) => {
          const [name, ...values] = part.trim().split(/\s+/);
          return [name.toLowerCase(), values];
        }),
      );
      const sources =
        directives.get("script-src-elem") ??
        directives.get("script-src") ??
        directives.get("default-src");
      return (
        sources?.includes("'self'") === true && !sources.includes("'none'")
      );
    })
  );
}
