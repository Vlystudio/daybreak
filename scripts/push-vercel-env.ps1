# Pushes the app's required env vars from .env.local to Vercel (production).
# Run AFTER `vercel link`. Re-runnable: it removes then re-adds each var.
# Does NOT push SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD (CLI/local only,
# never used by the app at runtime).

$ErrorActionPreference = "Stop"

$wanted = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  # Optional integrations — pushed only if present and non-empty in .env.local.
  "OURA_CLIENT_ID",
  "OURA_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "OPENAI_API_KEY"
)

$map = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$matches[1]] = $matches[2] }
}

foreach ($name in $wanted) {
  $val = $map[$name]
  if ([string]::IsNullOrWhiteSpace($val)) { Write-Host "skip  $name (empty / not set)"; continue }
  foreach ($target in @("production", "preview", "development")) {
    try { vercel env rm $name $target --yes 2>$null | Out-Null } catch {}
    $val | vercel env add $name $target | Out-Null
  }
  Write-Host "set   $name"
}

Write-Host "`nDone. Env vars pushed to Vercel."
