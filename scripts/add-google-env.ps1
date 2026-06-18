# Adds GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to Vercel via the REST API.
# Reads values + token from .env.local. Leaves all other env vars untouched.
# Run from project root:  .\scripts\add-google-env.ps1

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$projectId = "prj_m4pbqqpUEQlZpuDDNouLXXAwdLOx"
$teamId    = "team_dqVEZeBAm9AsVeheIZvLHyHC"
$base      = "https://api.vercel.com"

$vars = @("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")

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

try {
  $existing = Invoke-RestMethod -Headers $headers -Uri "$base/v9/projects/$projectId/env?teamId=$teamId&decrypt=false"
  foreach ($e in $existing.envs) {
    if ($vars -contains $e.key) {
      Invoke-RestMethod -Method Delete -Headers $headers -Uri "$base/v9/projects/$projectId/env/$($e.id)?teamId=$teamId" | Out-Null
      Write-Host ("deleted existing " + $e.key)
    }
  }
} catch { Write-Host "Could not list/delete:" -ForegroundColor Red; Show-ApiError $_; exit 1 }

foreach ($name in $vars) {
  $val = $map[$name]
  if ([string]::IsNullOrWhiteSpace($val)) { Write-Host ("MISSING in .env.local: " + $name) -ForegroundColor Red; continue }
  $body = @{ key = $name; value = $val; type = "encrypted"; target = @("production","preview","development") } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" `
      -Uri "$base/v10/projects/$projectId/env?teamId=$teamId" -Body $body | Out-Null
    Write-Host ("created " + $name + " (" + $val.Length + " chars)") -ForegroundColor Green
  } catch { Write-Host ("FAILED " + $name) -ForegroundColor Red; Show-ApiError $_ }
}

Write-Host "`nDone. Now redeploy:  vercel --prod" -ForegroundColor Cyan
