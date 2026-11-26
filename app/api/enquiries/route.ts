import { allowRequest, saveEnquiry } from "../../../db/conversions";
import { parseEnquiry } from "../../lib/conversion-validation";
import { requestIsSameOrigin } from "../../lib/admin-auth";
export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return Response.json({ error: "Please submit from the Vineyard Sun website." }, { status: 403 });
  const text = await request.text();
  if (text.length > 12000) return Response.json({ error: "Please shorten your enquiry." }, { status: 413 });
  let enquiry;
  try { enquiry = parseEnquiry(JSON.parse(text)); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Please check your enquiry." }, { status: 400 }); }
  try {
    if (!(await allowRequest(request, "enquiry"))) return Response.json({ error: "Too many attempts. Please try again later or email info@vineyardsun.com." }, { status: 429 });
    await saveEnquiry(enquiry);
    return Response.json({ id: enquiry.id }, { status: 201 });
  } catch { return Response.json({ error: "We couldn't save your enquiry. Please try again or email info@vineyardsun.com." }, { status: 503 }); }
}
