# Запуск из PowerShell в папке проекта:
# Set-ExecutionPolicy -Scope Process Bypass
# .\scripts\publish-to-github.ps1

$ErrorActionPreference = 'Stop'
$Repository = 'https://github.com/dev-vbs/vbios-client.git'
$Branch = 'main'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git не найден. Установите Git for Windows: https://git-scm.com/download/win'
}

if (-not (Test-Path '.git')) {
  git init
  git branch -M $Branch
  git remote add origin $Repository
} elseif (-not (git remote get-url origin 2>$null)) {
  git remote add origin $Repository
}

git add .
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m 'feat: redesign account dashboard and add Docker CI'
} else {
  Write-Host 'Нет новых файлов для коммита.' -ForegroundColor Yellow
}

git push -u origin $Branch
if ($LASTEXITCODE -eq 0) {
  Write-Host 'Готово. GitHub Actions начнёт сборку Docker-образа.' -ForegroundColor Green
}
