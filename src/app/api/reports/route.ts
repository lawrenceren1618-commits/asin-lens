import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { listRecentReports } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listRecentReports(30);
  return NextResponse.json({ items });
}
