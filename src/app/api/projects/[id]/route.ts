import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/auth";
import {
  getProject,
  listDailyReports,
  listIndustryOptReports,
  listLatestSnapshotsForAsinIds,
  listProjectAsins,
  listProjectNamesExcept,
  listSnapshotsForProject,
  nextUniqueProjectName,
  updateProjectAutoDaily,
  updateProjectName,
} from "@/lib/db/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "90");
  const days = Math.min(
    365,
    Math.max(7, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 90),
  );
  const skipSnapshots = url.searchParams.get("snapshots") === "0";

  const [project, asinRows] = await Promise.all([
    getProject(id),
    listProjectAsins(id),
  ]);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [latestMap, reports, industryOptReports, snapshots] = await Promise.all(
    [
      listLatestSnapshotsForAsinIds(asinRows.map((row) => row.id)),
      listDailyReports(id, 14),
      listIndustryOptReports(id, 14),
      skipSnapshots
        ? Promise.resolve(
            [] as Awaited<ReturnType<typeof listSnapshotsForProject>>,
          )
        : listSnapshotsForProject(id, days),
    ],
  );

  const withLatest = asinRows.map((row) => ({
    ...row,
    latest: latestMap.get(row.id) ?? null,
  }));

  return NextResponse.json({
    project,
    asins: withLatest,
    snapshots,
    reports,
    industryOptReports,
    chartDays: days,
    snapshotsIncluded: !skipSnapshots,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getProject(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "项目名称不能为空")
          .max(120, "项目名称过长")
          .optional(),
        acceptDuplicateSuffix: z.boolean().optional(),
        autoDaily: z.boolean().optional(),
      })
      .parse(await request.json());

    if (body.autoDaily !== undefined) {
      const project = await updateProjectAutoDaily(id, body.autoDaily);
      return NextResponse.json({ project, autoDailyUpdated: true });
    }

    if (body.name === undefined) {
      return NextResponse.json(
        { error: "请提供 name 或 autoDaily" },
        { status: 400 },
      );
    }

    if (body.name === existing.name.trim()) {
      return NextResponse.json({ project: existing, renamed: false });
    }

    const otherNames = await listProjectNamesExcept(id);
    const exactTaken = otherNames.some((name) => name.trim() === body.name);

    if (exactTaken && !body.acceptDuplicateSuffix) {
      const suggestedName = nextUniqueProjectName(body.name, otherNames);
      return NextResponse.json(
        {
          error: `已有同名项目「${body.name}」。坚持保存将命名为「${suggestedName}」。`,
          conflict: true,
          suggestedName,
        },
        { status: 409 },
      );
    }

    const name = body.acceptDuplicateSuffix
      ? nextUniqueProjectName(body.name, otherNames)
      : body.name;
    const project = await updateProjectName(id, name);
    return NextResponse.json({ project, renamed: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "参数无效" },
        { status: 400 },
      );
    }
    throw error;
  }
}
