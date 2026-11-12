import type { Page } from "./access.ts";
import { verifyAccess } from "./access.ts";

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const email = process.env.ACCESS_OWNER_EMAIL;
if (!token || !account || !email)
  throw new Error(
    "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and ACCESS_OWNER_EMAIL are required",
  );
await verifyAccess(
  async (path) => {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}${path}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!r.ok)
      throw new Error(`Access check failed (HTTP ${r.status}): deploy blocked`);
    return (await r.json()) as Page;
  },
  "utopia-ucronia.marcoranica.com",
  email,
);
console.log(
  "Access verified: exact domain, three explicit email addresses including the owner's, and no public exception.",
);
