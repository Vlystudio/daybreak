import { matchCronSecret } from "@/lib/security/cron-auth-core";

/** Pure constant-time credential check shared with the request wrapper. */
export function matchAdminSecret(presented: string, configured: string | undefined): boolean {
  return Boolean(configured) && matchCronSecret(presented, [configured as string]) === 0;
}
