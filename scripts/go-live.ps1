# One-shot deploy for Daybreak.
# Reads correct values from .env.local, sets them in Vercel RELIABLY
# (temp-file + cmd redirection, so long JWTs cannot get truncated like the old
# "$val | vercel env add" piping did), verifies them, deploys, checks the URL.
# Run from the project root:  .\scripts\go-live.ps1

$ErrorActionPreference = "Stop"
$AppUrl = "https://daybreak-one.vercel.app"

$appVars = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "CRON_SECRET"
)

# read known-good values from .env.local
$map = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$matches[1]] = $matches[2].Trim() }
}

function Set-VercelEnv {
  param([string]$Name, [string]$Value)
  try { vercel env rm $Name production --yes 2>$null | Out-Null } catch {}
  $tmp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp, $Value, (New-Object System.Text.UTF8Encoding($false)))
  cmd /c "vercel env add $Name production < `"$tmp`"" | Out-Null
  Remove-Item $tmp -Force
}

Write-Host ""
Write-Host "=== 1. Setting Vercel production env vars ===" -ForegroundColor Cyan
foreach ($name in $appVars) {
  $val = $map[$name]
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host ("  MISSING in .env.local: " + $name) -ForegroundColor Red
    continue
  }
  Set-VercelEnv -Name $name -Value $val
  Write-Host ("  set " + $name + " (" + $val.Length + " chars)")
}

Write-Host ""
Write-Host "=== 2. Verifying what Vercel actually stored ===" -ForegroundColor Cyan
$check = ".env.vercel-check"
vercel env pull $check --environment=production --yes 2>$null | Out-Null
Get-Content $check | ForEach-Object {
  if ($_ -match '^([A-Za-z0-9_]+)=(.*)$' -and $appVars -contains $matches[1]) {
    Write-Host ("  " + $matches[1] + " = " + $matches[2].Length + " chars")
  }
}
Remove-Item $check -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== 3. Deploying to production ===" -ForegroundColor Cyan
vercel --prod

Write-Host ""
Write-Host "=== 4. Checking the live site ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3
$ProgressPreference = "SilentlyContinue"
try {
  Invoke-WebRequest -Uri $AppUrl -Method Head -ErrorAction Stop | Out-Null
  Write-Host ("  SUCCESS - " + $AppUrl + " returned 200. You are live.") -ForegroundColor Green
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $code = [int]$resp.StatusCode
    $verr = $resp.Headers['x-vercel-error']
    Write-Host ("  STILL FAILING - status " + $code + "  x-vercel-error: " + $verr) -ForegroundColor Red
  } else {
    Write-Host ("  Could not reach the site - " + $_.Exception.Message) -ForegroundColor Red
  }
}
