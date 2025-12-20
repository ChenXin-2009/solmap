# download-planet-textures.ps1
# 下载行星贴图脚本（基于 NASA 数据）
# 
# 使用方法：
# 1. 在项目根目录打开 PowerShell
# 2. 运行：.\scripts\download-planet-textures.ps1
#
# 注意：某些网站可能有防爬虫保护，如果下载失败请手动下载

param(
    [string]$OutputDir = "public/textures/planets",
    [switch]$Force = $false
)

# 确保输出目录存在
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force
    Write-Host "Created directory: $OutputDir"
}

# 行星贴图 URL 列表（多个备用源）
$textureUrls = @{
    "mercury" = @(
        "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg",
        "https://planetpixelemporium.com/download/mercury.jpg"
    )
    "venus" = @(
        "https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg",
        "https://planetpixelemporium.com/download/venus.jpg"
    )
    "earth" = @(
        "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg",
        "https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography/57752l.jpg"
    )
    "mars" = @(
        "https://www.solarsystemscope.com/textures/download/2k_mars.jpg",
        "https://planetpixelemporium.com/download/mars.jpg"
    )
    "jupiter" = @(
        "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg",
        "https://planetpixelemporium.com/download/jupiter.jpg"
    )
    "saturn" = @(
        "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg",
        "https://planetpixelemporium.com/download/saturn.jpg"
    )
    "uranus" = @(
        "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg",
        "https://planetpixelemporium.com/download/uranus.jpg"
    )
    "neptune" = @(
        "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg",
        "https://planetpixelemporium.com/download/neptune.jpg"
    )
}

# User-Agent 字符串（模拟浏览器）
$userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# 下载函数
function Download-Texture {
    param(
        [string]$Planet,
        [string[]]$Urls,
        [string]$OutputPath
    )
    
    if ((Test-Path $OutputPath) -and !$Force) {
        Write-Host "✓ $Planet texture already exists: $OutputPath" -ForegroundColor Green
        return $true
    }
    
    Write-Host "Downloading $Planet texture..." -ForegroundColor Yellow
    
    foreach ($url in $Urls) {
        try {
            Write-Host "  Trying: $url"
            Invoke-WebRequest -Uri $url -OutFile $OutputPath -UserAgent $userAgent -TimeoutSec 30
            
            # 验证文件是否下载成功
            if (Test-Path $OutputPath) {
                $fileSize = (Get-Item $OutputPath).Length
                if ($fileSize -gt 10KB) {  # 至少 10KB
                    Write-Host "✓ Successfully downloaded $Planet ($([math]::Round($fileSize/1KB, 1)) KB)" -ForegroundColor Green
                    return $true
                } else {
                    Write-Host "  File too small, trying next URL..." -ForegroundColor Yellow
                    Remove-Item $OutputPath -ErrorAction SilentlyContinue
                }
            }
        }
        catch {
            Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "✗ Failed to download $Planet texture from all sources" -ForegroundColor Red
    return $false
}

# 主下载循环
Write-Host "=== Planet Texture Downloader ===" -ForegroundColor Cyan
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$totalCount = $textureUrls.Count

foreach ($planet in $textureUrls.Keys) {
    $outputPath = Join-Path $OutputDir "${planet}_2k.jpg"
    $urls = $textureUrls[$planet]
    
    if (Download-Texture -Planet $planet -Urls $urls -OutputPath $outputPath) {
        $successCount++
    }
}

Write-Host ""
Write-Host "=== Download Summary ===" -ForegroundColor Cyan
Write-Host "Successfully downloaded: $successCount/$totalCount textures" -ForegroundColor $(if ($successCount -eq $totalCount) { "Green" } else { "Yellow" })

if ($successCount -lt $totalCount) {
    Write-Host ""
    Write-Host "Some textures failed to download. You can:" -ForegroundColor Yellow
    Write-Host "1. Run the script again with -Force to retry" -ForegroundColor White
    Write-Host "2. Manually download from the sources listed in README.md" -ForegroundColor White
    Write-Host "3. Use alternative sources like:" -ForegroundColor White
    Write-Host "   - https://www.solarsystemscope.com/textures/" -ForegroundColor White
    Write-Host "   - https://planetpixelemporium.com/planets.html" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify textures are loaded correctly: npm run dev" -ForegroundColor White
Write-Host "2. Check browser console for any loading errors" -ForegroundColor White
Write-Host "3. See README.md for troubleshooting tips" -ForegroundColor White