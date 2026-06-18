# Fixes the Daybreak production env vars via the Vercel REST API.
# Avoids the CLI entirely (no stdin truncation, no multi-env "already exists"
# errors). Reads the token + values from .env.local, deletes any existing
# copies of these vars, and creates them fresh for all environments.
# Run from project root:  .\scripts\fix-vercel-env.ps1

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$projectId = "prj_m4pbqqpUEQlZpuDDNouLXXAwdLOx"
$teamId    = "team_dqVEZeBAm9AsVeheIZvLHyHC"
$base      = "https://api.vercel.com"

$appVars = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET"
)

# --- load token + values from .env.local ---
$map = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$matches[1]] = $matches[2].Trim() }
}
$token = $map["VERCEL_TOKEN"]
if ([string]::IsNullOrWhiteSpace($token)) { Write-Host "VERCEL_TOKEN missing from .env.local" -ForegroundColor Red; exit 1 }

$headers = @{ Authorization = "Bearer $token" }

function Show-ApiError($err) {
  try {
    $stream = $err.Exception.Response.GetResponseStream()
    $body = (New-Object System.IO.StreamReader($stream)).ReadToEnd()
    Write-Host ("    API error: " + $body) -ForegroundColor Red
  } catch { Write-Host ("    " + $err.Exception.Message) -ForegroundColor Red }
}

Write-Host ""
Write-Host "=== 1. Deleting existing copies of these vars ===" -ForegroundColor Cyan
try {
  $existing = Invoke-RestMethod -Headers $headers -Uri "$base/v9/projects/$projectId/env?teamId=$teamId&decrypt=false"
  foreach ($e in $existing.envs) {
    if ($appVars -contains $e.key) {
      Invoke-RestMethod -Method Delete -Headers $headers -Uri "$base/v9/projects/$projectId/env/$($e.id)?teamId=$teamId" | Out-Null
      Write-Host ("  deleted " + $e.key + " [" + ($e.target -join ",") + "]")
    }
  }
} catch { Write-Host "  Could not list/delete:" -ForegroundColor Red; Show-ApiError $_; exit 1 }

Write-Host ""
Write-Host "=== 2. Creating fresh vars ===" -ForegroundColor Cyan
foreach ($name in $appVars) {
  $val = $map[$name]
  if ([string]::IsNullOrWhiteSpace($val)) { Write-Host ("  MISSING in .env.local: " + $name) -ForegroundColor Red; continue }
  $body = @{
    key    = $name
    value  = $val
    type   = "encrypted"
    target = @("production","preview","development")
  } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" `
      -Uri "$base/v10/projects/$projectId/env?teamId=$teamId" -Body $body | Out-Null
    Write-Host ("  created " + $name + " (" + $val.Length + " chars)") -ForegroundColor Green
  } catch { Write-Host ("  FAILED " + $name) -ForegroundColor Red; Show-ApiError $_ }
}

Write-Host ""
Write-Host "=== 3. Reading back what Vercel now stores ===" -ForegroundColor Cyan
try {
  $after = Invoke-RestMethod -Headers $headers -Uri "$base/v9/projects/$projectId/env?teamId=$teamId&decrypt=true"
  foreach ($e in $after.envs) {
    if ($appVars -contains $e.key) {
      $len = if ($e.value) { $e.value.Length } else { 0 }
      Write-Host ("  " + $e.key + " = " + $len + " chars  [" + ($e.target -join ",") + "]")
    }
  }
} catch { Write-Host "  Could not read back:" -ForegroundColor Red; Show-ApiError $_ }

Write-Host ""
Write-Host "Done. Now deploy with:  vercel --prod" -ForegroundColor Cyan
