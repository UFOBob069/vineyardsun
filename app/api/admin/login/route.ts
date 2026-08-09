import {
  adminPasswordIsConfigured,
  createAdminCookie,
  passwordMatches,
  requestIsSameOrigin,
} from "../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Request rejected." }, { status: 403 });
  }
  if (!adminPasswordIsConfigured()) {
    return Response.json(
      { error: "Set ADMIN_PASSWORD to at least 12 characters before signing in." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as { password?: string };
  if (!(await passwordMatches(payload.password ?? ""))) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  return Response.json(
    { authenticated: true },
    { headers: { "Set-Cookie": await createAdminCookie() } },
  );
}
