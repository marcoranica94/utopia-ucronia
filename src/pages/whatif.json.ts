import { whatIfEntries } from "../whatif-entries";

/** One shared file for both interface languages: paths carry no locale. */
export async function GET() {
  return new Response(JSON.stringify(await whatIfEntries()), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
