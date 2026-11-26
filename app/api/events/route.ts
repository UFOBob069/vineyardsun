import { allowRequest, recordConversion } from "../../../db/conversions";
import { parseEvent } from "../../lib/conversion-validation";
import { requestIsSameOrigin } from "../../lib/admin-auth";
export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 2048) return new Response(null, { status: 413 });
  let event;
  try { event = parseEvent(JSON.parse(text)); } catch { return new Response(null, { status: 400 }); }
  try {
    if (!(await allowRequest(request, "event"))) return new Response(null, { status: 429 });
    await recordConversion(event);
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 503 }); }
}
