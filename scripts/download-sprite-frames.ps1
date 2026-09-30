$ErrorActionPreference = 'Stop'
$animations = Get-Content 'assets/characters/reference-v2-animations.json' -Raw | ConvertFrom-Json
$downloads = foreach ($animation in $animations) {
    if (-not $animation.completed) { continue }
    $folder = "assets/characters/$($animation.name)/reference-v2/$($animation.state)/$($animation.direction)"
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    for ($index = 0; $index -lt $animation.count; $index++) {
        $destination = Join-Path (Resolve-Path $folder) "frame-$index.png"
        if (Test-Path -LiteralPath $destination) {
            [byte[]]$signature = Get-Content -LiteralPath $destination -AsByteStream -TotalCount 8
            if ($signature.Length -ne 8 -or $signature[0] -ne 137 -or $signature[1] -ne 80 -or
                $signature[2] -ne 78 -or $signature[3] -ne 71) {
                Remove-Item -LiteralPath $destination
            }
        }
        if (-not (Test-Path -LiteralPath $destination)) {
            [pscustomobject]@{ Url = "https://api.pixellab.ai/mcp/images/$($animation.job)/download?index=$index"; Path = $destination }
        }
    }
}
$downloads | ForEach-Object -Parallel {
    $ErrorActionPreference = 'Stop'
    $download = $_
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            Invoke-WebRequest -Uri $download.Url -OutFile $download.Path
            break
        } catch {
            if ($attempt -eq 5) {
                Write-Warning "PixelLab frame still processing: $($download.Url)"
                break
            }
            Start-Sleep -Seconds (2 * $attempt)
        }
    }
} -ThrottleLimit 6
Write-Output "Attempted $(@($downloads).Count) new frames."
