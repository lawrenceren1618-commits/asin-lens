import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAuthorized } from "@/lib/auth";
import { runResearch } from "@/lib/research/runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runResearch(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Research run failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Research run failed",
      },
      { status: 500 },
    );
  }
}
