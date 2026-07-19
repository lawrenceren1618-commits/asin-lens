import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import { collectAsin, collectProject } from "@/lib/research/collect";
import type { PipelineIssue } from "@/lib/research/pipeline-error";
import { sourcePrioritySchema } from "@/lib/research/source-priority";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = z
    .object({
      projectId: z.string().uuid().optional(),
      asinId: z.string().uuid().optional(),
      sourcePriority: sourcePrioritySchema.optional(),
    })
    .refine((value) => value.projectId || value.asinId, {
      message: "projectId or asinId required",
    })
    .parse(await request.json());

  try {
    if (body.asinId) {
      const result = await collectAsin(body.asinId, body.sourcePriority);
      return NextResponse.json({ result, failures: [] as PipelineIssue[] });
    }

    const result = await collectProject(body.projectId!, body.sourcePriority);
    return NextResponse.json(result);
  } catch (error) {
    const failures =
      error &&
      typeof error === "object" &&
      "failures" in error &&
      Array.isArray((error as { failures: unknown }).failures)
        ? ((error as { failures: PipelineIssue[] }).failures)
        : [];

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "采集失败",
        failures,
      },
      { status: 422 },
    );
  }
}
