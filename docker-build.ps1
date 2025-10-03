# PowerShell script to build and run Docker containers
# Ezé-U Internet Monitor

Write-Host "🐳 Ezé-U Internet Monitor - Docker Build Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
$dockerRunning = docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "✅ Cleaned up existing containers" -ForegroundColor Green
Write-Host ""

# Build the image
Write-Host "Building Docker image..." -ForegroundColor Yellow
Write-Host "(This may take a few minutes on first build)" -ForegroundColor Gray
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

# Create data directory if it doesn't exist
if (-not (Test-Path ".\backend\data")) {
    New-Item -ItemType Directory -Path ".\backend\data" | Out-Null
    Write-Host "✅ Created data directory" -ForegroundColor Green
}

# Start containers
Write-Host "Starting containers..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Containers started" -ForegroundColor Green
Write-Host ""

# Wait for container to be healthy
Write-Host "Waiting for application to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Show container status
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose ps
Write-Host ""

# Show logs
Write-Host "📋 Recent Logs:" -ForegroundColor Cyan
docker-compose logs --tail=20
Write-Host ""

# Final messages
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ Ezé-U Internet Monitor is now running!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Access the application at: http://localhost:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:      docker-compose logs -f" -ForegroundColor Gray
Write-Host "  Stop:           docker-compose stop" -ForegroundColor Gray
Write-Host "  Start:          docker-compose start" -ForegroundColor Gray
Write-Host "  Restart:        docker-compose restart" -ForegroundColor Gray
Write-Host "  Stop & Remove:  docker-compose down" -ForegroundColor Gray
Write-Host "  Shell access:   docker-compose exec internet-monitor sh" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to exit this script (container will keep running)" -ForegroundColor Gray
Write-Host ""

# Follow logs
docker-compose logs -f
