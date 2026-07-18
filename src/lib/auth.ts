import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isAuthorized(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const received = request.headers.get("x-admin-token");
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
