import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import {
  getLatestSnapshot,
  getProject,
  listDailyReports,
  listProjectAsins,
  listSnapshotsForProject,
} from "@/lib/db/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const asinRows = await listProjectAsins(id);
  const withLatest = await Promise.all(
    asinRows.map(async (row) => ({
      ...row,
      latest: await getLatestSnapshot(row.id),
    })),
  );
  const snapshots = await listSnapshotsForProject(id, 60);
  const reports = await listDailyReports(id, 14);

  return NextResponse.json({
    project,
    asins: withLatest,
    snapshots,
    reports,
  });
}
