import { getHiddenProductHandles } from "../../../db/merchandising";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { hiddenProductHandles: await getHiddenProductHandles() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
