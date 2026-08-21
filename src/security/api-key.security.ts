import crypto from "node:crypto";

export function isValidApiKey(provided: string | undefined, expectedValue: string): boolean {
  if (!provided) return false;

  const expected = Buffer.from(expectedValue);
  const received = Buffer.from(provided);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
