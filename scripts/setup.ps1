<#
.SYNOPSIS
    First-time setup script for FangOps.
.DESCRIPTION
    Checks prerequisites (Node, pnpm), copies .env.example to .env,
    runs pnpm install, initializes the SQLite database, and prints next steps.
#>

Write-Host "Starting FangOps Setup..." -ForegroundColor Cyan

# 1. Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = (node -v).Trim()
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Check pnpm
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVersion = (pnpm -v).Trim()
    Write-Host "✅ pnpm found: $pnpmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ pnpm not found. Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install pnpm. Please install it manually." -ForegroundColor Red
        exit 1
    }
}

# 3. Setup environment variables
if (Test-Path ".env") {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
} elseif (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Copied .env.example to .env" -ForegroundColor Green
} else {
    Write-Host "⚠️ .env.example not found. You may need to create .env manually." -ForegroundColor Yellow
}

# 4. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ pnpm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# 5. Initialize Database
Write-Host "🗄️ Initializing the database..." -ForegroundColor Cyan
pnpm db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to initialize the database." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database initialized" -ForegroundColor Green

# 6. Seed Data
Write-Host "🌱 Seeding initial data..." -ForegroundColor Cyan
pnpm tsx scripts/seed-data.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Seed data failed (non-critical)." -ForegroundColor Yellow
} else {
    Write-Host "✅ Data seeded successfully." -ForegroundColor Green
}

# 7. Print next steps
Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start the development environment:" -ForegroundColor Cyan
Write-Host "     pnpm dev"
Write-Host "  2. The API will be available at http://localhost:3000"
Write-Host "  3. The Dashboard will be available at http://localhost:5173"
Write-Host ""
Write-Host "Login with the default admin account:"
Write-Host "  Email: admin@fangops.local"
Write-Host "  Password: admin"
Write-Host ""
