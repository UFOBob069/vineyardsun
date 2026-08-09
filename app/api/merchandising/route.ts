import { getMerchandisingSettings } from "../../../db/merchandising";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    await getMerchandisingSettings(),
    { headers: { "Cache-Control": "no-store" } },
  );
}
