import { clearAdminCookie, requestIsSameOrigin } from "../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Request rejected." }, { status: 403 });
  }
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearAdminCookie() } },
  );
}
