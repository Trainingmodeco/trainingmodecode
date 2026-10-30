# Builds a Netlify deploy zip for trainingmode.co from this repo. FALLBACK ONLY: pushes to main deploy
# automatically. Forward-slash entries (Netlify flattens backslash zips), no repo-only files.
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File _tools\make-deploy-zip.ps1 [-Out C:\path\site.zip]
param([string]$Out = (Join-Path $env:TEMP ("trainingmode-co-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".zip")))

$root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $Out) { throw "$Out already exists" }

$skip = '^(\.git(/|$)|\.gitignore$|\.gitattributes$|_tools/|README\.md$|netlify\.toml$)'
$zip = [System.IO.Compression.ZipFile]::Open($Out, 'Create')
$count = 0
try {
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace([char]92, '/')
    if ($rel -notmatch $skip) {
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel)
      $count++
    }
  }
} finally { $zip.Dispose() }

$mb = [math]::Round((Get-Item -LiteralPath $Out).Length / 1MB, 2)
"$count files -> $Out ($mb MB)"
if ($mb -ge 10) { Write-Warning "Over 10 MB: Claude-in-Chrome uploads stop at 10 MB; drag the zip onto Netlify by hand instead." }
