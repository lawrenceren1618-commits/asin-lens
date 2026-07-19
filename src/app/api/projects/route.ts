import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listProjects();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = z
    .object({ name: z.string().trim().min(1).max(120) })
    .parse(await request.json());
  const project = await createProject(body.name);
  return NextResponse.json({ project });
}
