import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Dev-only diagnostic sink. The /office leak probe (src/lib/dev/leakProbe.ts) POSTs
// a small metrics snapshot here every few seconds; we log it to the dev-server
// stdout so an operator watching the server log can see WHICH in-page structure
// grows before a renderer OOM — used to diagnose a crash that isn't reproducible
// synthetically. Disabled in production.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    // Single compact line so it's easy to grep in /tmp/claw3d-dev.log.
    console.info(`[leak-probe] ${JSON.stringify(body)}`);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
