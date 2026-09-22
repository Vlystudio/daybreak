import { writeFileSync } from "node:fs";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const e = process.env;
if (e.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:56321")
  throw Error("Loopback fixture required");
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const client = () =>
  createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, options);
const checks = [];
function check(name, pass) {
  checks.push({ name, pass });
  if (!pass) throw Error(name);
  console.log("PASS " + name);
}
function totp(secret) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=/g, ""))
    bits += chars.indexOf(c.toUpperCase()).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((v) => parseInt(v, 2)));
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(count).digest();
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
try {
  const a = client(),
    b = client();
  const email = "launch-auth-" + randomUUID() + "@example.invalid",
    password = randomBytes(25).toString("base64url");
  const bad = await admin.auth.admin.createUser({
    email: "invalid-" + randomUUID() + "@example.invalid",
    password,
    email_confirm: true,
  });
  check("Auth creation without adult/legal metadata rejected", !!bad.error);
  const signup = await a.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: "Synthetic auth test",
        adult_attested: true,
        adult_attestation_version: "2026-07-28",
        accepted_terms_version: "2026-07-28",
        acknowledged_privacy_version: "2026-07-28",
      },
    },
  });
  check("Normal signup with adult/legal metadata succeeds", !!signup.data.user && !signup.error);
  const eligibility = await a.from("account_eligibility").select("status").single();
  check("Signed-in user can read own eligibility", !eligibility.error);
  const login2 = await b.auth.signInWithPassword({ email, password });
  check("Second password session succeeds", !!login2.data.session && !login2.error);
  const revoked = await a.auth.signOut({ scope: "global" });
  const refresh = await b.auth.refreshSession();
  check("Global logout prevents refresh in second session", !revoked.error && !!refresh.error);
  const link = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (link.error) throw Error("Generate recovery link");
  const token = link.data.properties.hashed_token;
  const recovery = client();
  const verified = await recovery.auth.verifyOtp({ token_hash: token, type: "recovery" });
  check("Recovery token establishes recovery session", !verified.error && !!verified.data.session);
  const newPassword = randomBytes(26).toString("base64url");
  const update = await recovery.auth.updateUser({ password: newPassword });
  check("Recovery session can change password", !update.error);
  const reused = await client().auth.verifyOtp({ token_hash: token, type: "recovery" });
  check("Used recovery token cannot be reused", !!reused.error);
  const oldLogin = await client().auth.signInWithPassword({ email, password });
  check("Old password rejected after recovery", !!oldLogin.error);
  const m = client();
  const newLogin = await m.auth.signInWithPassword({ email, password: newPassword });
  check("New password authenticates", !newLogin.error);
  const enrollment = await m.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Disposable local QA",
  });
  if (enrollment.error) throw Error("TOTP enrollment: " + enrollment.error.code);
  const verify = await m.auth.mfa.challengeAndVerify({
    factorId: enrollment.data.id,
    code: totp(enrollment.data.totp.secret),
  });
  check("Valid TOTP upgrades session", !verify.error);
  const strong = await m.auth.mfa.getAuthenticatorAssuranceLevel();
  check("Verified TOTP session is AAL2", strong.data.currentLevel === "aal2");
  const weaker = client();
  await weaker.auth.signInWithPassword({ email, password: newPassword });
  const level = await weaker.auth.mfa.getAuthenticatorAssuranceLevel();
  check(
    "Password-only login requires AAL2 after MFA enrollment",
    level.data.currentLevel === "aal1" && level.data.nextLevel === "aal2"
  );
  const wrong = await weaker.auth.mfa.challengeAndVerify({
    factorId: enrollment.data.id,
    code: "000000",
  });
  check("Incorrect TOTP rejected", !!wrong.error);
} finally {
  writeFileSync(
    "docs/launch-readiness/evidence/04-auth-and-accounts/local-auth-behavior.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        observedAt: new Date().toISOString(),
        environment: "Disposable daybreak-local loopback fixture",
        productionAccessed: false,
        containsRealUserData: false,
        status: checks.length === 14 && checks.every((x) => x.pass) ? "pass" : "partial",
        checks,
        limits: [
          "Local email confirmation is disabled; actual production SMTP delivery not exercised",
          "Recovery link generated through Admin API; expiry duration read separately from production configuration",
          "AAL state verified through Auth API; full browser challenge navigation covered by repository code checks, not this harness",
        ],
      },
      null,
      2
    ) + "\n"
  );
}
