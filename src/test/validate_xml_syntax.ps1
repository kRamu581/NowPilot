$files = @(
    'update_sets\now_pilot_global.xml',
    'update_sets\now_pilot_scoped.xml'
)

$allPassed = $true

foreach ($f in $files) {
    if (-not (Test-Path $f)) {
        Write-Host "[FAIL] $f : File does not exist" -ForegroundColor Red
        $allPassed = $false
        continue
    }
    try {
        [xml]$doc = Get-Content -Raw -Path $f
        $root = $doc.DocumentElement.Name
        $nodes = $doc.DocumentElement.ChildNodes.Count
        Write-Host "[PASS] $f : Valid XML parsed successfully (Root: <$root>, Children: $nodes)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $f : XML Parse Error: $_" -ForegroundColor Red
        $allPassed = $false
    }
}

if (-not $allPassed) {
    exit 1
} else {
    exit 0
}
