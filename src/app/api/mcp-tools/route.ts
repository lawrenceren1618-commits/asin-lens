import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/auth";
import { listSellerSpriteTools } from "@/lib/mcp/sellersprite";
import { listSifTools } from "@/lib/mcp/sif";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sellerSprite, sif] = await Promise.allSettled([
    listSellerSpriteTools(),
    listSifTools(),
  ]);

  const serialize = (result: PromiseSettledResult<unknown>) =>
    result.status === "fulfilled"
      ? { status: "connected", result: result.value }
      : {
          status: "error",
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        };

  const response = {
    sellerSprite: serialize(sellerSprite),
    sif: serialize(sif),
  };
  const healthy =
    sellerSprite.status === "fulfilled" && sif.status === "fulfilled";
  return NextResponse.json(response, { status: healthy ? 200 : 502 });
}
