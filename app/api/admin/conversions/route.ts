import { conversionReport, updateEnquiry } from "../../../../db/conversions";
import { requestIsAdmin, requestIsSameOrigin } from "../../../lib/admin-auth";
import { UUID } from "../../../lib/conversion-validation";
export async function GET(request: Request) {
  if (!(await requestIsAdmin(request))) return Response.json({ error: "Please sign in at /admin." }, { status: 401 });
  try { return Response.json(await conversionReport(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "The report couldn't load. Please try again." }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  if (!requestIsSameOrigin(request)) return new Response(null, { status: 403 });
  if (!(await requestIsAdmin(request))) return new Response(null, { status: 401 });
  try {
    const { id, status } = await request.json();
    if (typeof id !== "string" || !UUID.test(id) || !["new", "contacted", "qualified", "closed"].includes(status)) return new Response(null, { status: 400 });
    if (!(await updateEnquiry(id, status))) return new Response(null, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "The enquiry couldn't be updated." }, { status: 503 }); }
}
