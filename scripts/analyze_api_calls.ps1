# API 호출 분석 스크립트
# 사용법: .\scripts\analyze_api_calls.ps1 <log_file_path>

param(
    [Parameter(Mandatory=$true)]
    [string]$LogPath
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "API Call Analysis" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# API 호출 추출
$apiCalls = Get-Content $LogPath | Select-String 'INFO:\s+127\.0\.0\.1.*HTTP/1\.1" 200 OK' | ForEach-Object {
    if ($_ -match '- "(GET|POST|PUT|DELETE|PATCH)\s+([^\s]+)') {
        [PSCustomObject]@{
            Method = $matches[1]
            Endpoint = $matches[2]
        }
    }
}

# API별 호출 횟수 집계
$grouped = $apiCalls | Group-Object -Property Method,Endpoint | Sort-Object Count -Descending

Write-Host "Top 20 Most Called APIs:" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow
$grouped | Select-Object -First 20 | ForEach-Object {
    $color = if ($_.Count -gt 3) { "Red" } elseif ($_.Count -gt 1) { "Yellow" } else { "Green" }
    Write-Host ("{0,3}x  {1}" -f $_.Count, $_.Name) -ForegroundColor $color
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ("Total API Calls: {0}" -f $apiCalls.Count) -ForegroundColor White
Write-Host ("Unique APIs: {0}" -f $grouped.Count) -ForegroundColor White
Write-Host ("Potential Duplicates (>1): {0}" -f ($grouped | Where-Object { $_.Count -gt 1 }).Count) -ForegroundColor Yellow
Write-Host ("High Duplicates (>3): {0}" -f ($grouped | Where-Object { $_.Count -gt 3 }).Count) -ForegroundColor Red
Write-Host ""
