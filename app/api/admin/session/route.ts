import { adminPasswordIsConfigured, requestIsAdmin } from "../../../lib/admin-auth";

export async function GET(request: Request) {
  return Response.json(
    {
      authenticated: await requestIsAdmin(request),
      configured: adminPasswordIsConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
