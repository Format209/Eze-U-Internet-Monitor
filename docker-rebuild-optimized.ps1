# Docker Performance Fix - Quick Deployment

Write-Host "🚀 Fixing Docker Performance Issues..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop current container
Write-Host "📦 Step 1: Stopping current container..." -ForegroundColor Yellow
docker-compose down
Write-Host "✅ Container stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Rebuild with no cache
Write-Host "🔨 Step 2: Rebuilding container (this may take 5-10 minutes)..." -ForegroundColor Yellow
Write-Host "   - Upgrading to Node.js 20 (better-sqlite3 requirement)" -ForegroundColor Gray
Write-Host "   - Adding build tools for better-sqlite3" -ForegroundColor Gray
Write-Host "   - Adding Python distutils support" -ForegroundColor Gray
Write-Host "   - Increasing memory limit to 1GB" -ForegroundColor Gray
Write-Host "   - Increasing CPU limit to 2.0" -ForegroundColor Gray
Write-Host "   - Adding Node.js optimization flags" -ForegroundColor Gray
Write-Host ""

docker-compose build --no-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed! Check errors above." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Start container
Write-Host "🚀 Step 3: Starting optimized container..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start container! Check errors above." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Wait for container to be ready
Write-Host "⏳ Step 4: Waiting for container to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""

# Step 5: Check logs
Write-Host "📋 Step 5: Checking startup logs..." -ForegroundColor Yellow
Write-Host ""
docker-compose logs --tail=20 | Select-String -Pattern "✓"
Write-Host ""

# Step 6: Check resource usage
Write-Host "📊 Step 6: Current resource usage..." -ForegroundColor Yellow
docker stats eze-u-internet-monitor --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
Write-Host ""

# Step 7: Test connection
Write-Host "🧪 Step 7: Testing API connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8745/api/settings" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API is responding!" -ForegroundColor Green
        
        # Check compression
        $encoding = $response.Headers["Content-Encoding"]
        if ($encoding) {
            Write-Host "✅ HTTP Compression: $encoding" -ForegroundColor Green
        }
        
        $size = $response.RawContentLength
        Write-Host "📦 Response size: $size bytes" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️  API not ready yet, give it a few more seconds..." -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Docker Performance Fix Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Changes Applied:" -ForegroundColor White
Write-Host "   • Memory limit: 512MB → 1GB" -ForegroundColor Gray
Write-Host "   • CPU limit: 1.0 → 2.0" -ForegroundColor Gray
Write-Host "   • Build tools added for better-sqlite3" -ForegroundColor Gray
Write-Host "   • Node.js optimization flags enabled" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Next Steps:" -ForegroundColor White
Write-Host "   1. Open browser: http://localhost:8745" -ForegroundColor Cyan
Write-Host "   2. Test performance (should be much faster!)" -ForegroundColor Cyan
Write-Host "   3. Monitor resources: docker stats eze-u-internet-monitor" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor White
Write-Host "   • See DOCKER_PERFORMANCE_FIX.md for details" -ForegroundColor Gray
Write-Host "   • Expected improvement: 5-10x faster" -ForegroundColor Gray
Write-Host ""
Write-Host "🔍 Watch logs:" -ForegroundColor White
Write-Host "   docker-compose logs -f" -ForegroundColor Cyan
Write-Host ""
Write-Host "Performance fix deployed! 🚀" -ForegroundColor Green
