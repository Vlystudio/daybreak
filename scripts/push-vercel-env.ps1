# Pushes the app's required env vars from .env.local to Vercel (production).
# Run AFTER `vercel link`. Re-runnable: it removes then re-adds each var.
# Does NOT push SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD (CLI/local only,
# never used by the app at runtime).

$ErrorActionPreference = "Stop"

$wanted = @(
  # Core — the app fails fast without these.
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET",
  # Optional integrations — pushed only if present and non-empty in .env.local.
  # Wearables + calendar (OAuth)
  "OURA_CLIENT_ID",
  "OURA_CLIENT_SECRET",
  "FITBIT_CLIENT_ID",
  "FITBIT_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  # AI
  "OPENAI_API_KEY",
  # Weather, recipes, food-photo nutrition
  "WEATHER_API_KEY",
  "SPOONACULAR_API_KEY",
  "LOGMEAL_API_KEY",
  # Email (Resend)
  "RESEND_API_KEY",
  "EMAIL_FROM",
  # Web Push (VAPID)
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT"
)

$map = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$matches[1]] = $matches[2] }
}

foreach ($name in $wanted) {
  $val = $map[$name]
  if ([string]::IsNullOrWhiteSpace($val)) { Write-Host "skip  $name (empty / not set)"; continue }
  # Production only — that's what the live site uses. Remove any existing value
  # first so re-runs update (add alone errors if the var already exists).
  try { vercel env rm $name production --yes 2>$null | Out-Null } catch {}
  $val | vercel env add $name production 2>$null | Out-Null
  Write-Host "set   $name"
}

Write-Host "`nDone. Env vars pushed to Vercel."
