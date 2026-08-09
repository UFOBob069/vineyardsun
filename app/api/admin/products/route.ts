import catalogData from "../../../data/catalog.json";
import { requestIsAdmin, requestIsSameOrigin } from "../../../lib/admin-auth";
import { replaceHiddenProductHandles } from "../../../../db/merchandising";

const validHandles = new Set(catalogData.map((product) => product.handle));

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Request rejected." }, { status: 403 });
  }
  if (!(await requestIsAdmin(request))) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const payload = (await request.json()) as { hiddenProductHandles?: unknown };
  if (!Array.isArray(payload.hiddenProductHandles)) {
    return Response.json({ error: "Invalid product selection." }, { status: 400 });
  }

  const hiddenProductHandles = payload.hiddenProductHandles.filter(
    (handle): handle is string => typeof handle === "string" && validHandles.has(handle),
  );
  await replaceHiddenProductHandles(hiddenProductHandles);

  return Response.json({ saved: true, hiddenProductHandles });
}
