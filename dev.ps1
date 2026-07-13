# rubai — Windows dev helper
# Run from repo root:  .\dev.ps1 api   or   .\dev.ps1 mobile   or   .\dev.ps1 db

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("db", "api", "mobile", "android", "build-android")]
  [string]$Target
)

$pnpmDir = "$env:APPDATA\npm"
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
$env:Path = "$pnpmDir;$dockerBin;" + $env:Path

Set-Location $PSScriptRoot

switch ($Target) {
  "db"            { node scripts/db-up.mjs }
  "api"           { node scripts/dev-api.mjs }
  "mobile"        { node scripts/dev-mobile.mjs }
  "android"       { node scripts/dev-android.mjs }
  "build-android" { node scripts/build-android-dev.mjs }
}
