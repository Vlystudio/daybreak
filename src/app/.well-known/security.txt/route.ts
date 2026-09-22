import { getLegalIdentity } from "@/lib/legal/identity";

export const dynamic = "force-dynamic";

export function GET() {
  const identity = getLegalIdentity();
  const origin = new URL(identity.supportUrl).origin;
  const body = [
    `Contact: mailto:${identity.securityEmail}`,
    "Expires: 2027-07-28T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${origin}/.well-known/security.txt`,
    `Policy: ${origin}/security`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
