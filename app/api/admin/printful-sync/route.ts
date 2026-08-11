import { requestIsAdmin, requestIsSameOrigin } from "../../../lib/admin-auth";
import { syncDavidsPrintfulStore } from "../../../lib/printful-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Request rejected." }, { status: 403 });
  }
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    return Response.json(await syncDavidsPrintfulStore());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Printful sync failed.";
    console.error("David's Store product sync failed", { message });
    return Response.json({ error: message }, { status: 502 });
  }
}
