param(
    [string] $BasePath = "/",
    [string] $Domain = "your-domain.com"
)

$ErrorActionPreference = "Stop"

if (-not $BasePath.StartsWith("/")) {
    $BasePath = "/$BasePath"
}

if (-not $BasePath.EndsWith("/")) {
    $BasePath = "$BasePath/"
}

$baseSlug = ($BasePath -replace "/", "")
$baseSlug = ($baseSlug -replace "[^A-Za-z0-9_-]", "-")
if ([string]::IsNullOrWhiteSpace($baseSlug)) {
    $baseSlug = "root"
}

$apiPath = "$($BasePath.TrimEnd('/'))/api"
if ($BasePath -eq "/") {
    $apiPath = "/api"
    $frontendUrl = "https://$Domain"
} else {
    $frontendUrl = "https://$Domain$($BasePath.TrimEnd('/'))"
}
$backendUrl = "https://$Domain$apiPath"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stageDir = Join-Path "build" "hosting-package-$baseSlug-$stamp"
$zipPath = "jasti-bluehost-deploy-$baseSlug-$stamp.zip"

Write-Host "Building frontend for base path: $BasePath"
$env:VITE_APP_BASE_PATH = $BasePath
npm.cmd run build

if (Test-Path -LiteralPath $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir | Out-Null

Copy-Item -Path "dist\*" -Destination $stageDir -Recurse -Force
Copy-Item -Path "api" -Destination $stageDir -Recurse -Force
Copy-Item -Path "vendor" -Destination $stageDir -Recurse -Force
Copy-Item -Path "database" -Destination $stageDir -Recurse -Force
Copy-Item -Path "composer.json", "composer.lock", ".env.example" -Destination $stageDir -Force

$uploadRoot = Join-Path $stageDir "api\uploads"
if (Test-Path -LiteralPath $uploadRoot) {
    Remove-Item -LiteralPath $uploadRoot -Recurse -Force
}

$uploadDirs = @(
    "manuscripts",
    "revisions",
    "payments",
    "copyright",
    "profiles",
    "settings",
    "system",
    "reviewers\cv",
    "reviewers\publications",
    "reviewers\orcid",
    "editors\cv",
    "editors\publications",
    "cv"
)

foreach ($dir in $uploadDirs) {
    New-Item -ItemType Directory -Path (Join-Path $uploadRoot $dir) -Force | Out-Null
}

if (Test-Path -LiteralPath "api\uploads\.htaccess") {
    Copy-Item -LiteralPath "api\uploads\.htaccess" -Destination (Join-Path $uploadRoot ".htaccess") -Force
}

if (Test-Path -LiteralPath "api\uploads\system") {
    Copy-Item -Path "api\uploads\system\*" -Destination (Join-Path $uploadRoot "system") -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath "api\uploads\settings") {
    Copy-Item -Path "api\uploads\settings\*" -Destination (Join-Path $uploadRoot "settings") -Recurse -Force -ErrorAction SilentlyContinue
}

@"
VITE_API_URL=$apiPath
VITE_APP_BASE_PATH=$BasePath
"@ | Set-Content -LiteralPath (Join-Path $stageDir ".env") -Encoding ASCII

@"
JASTI Bluehost Deployment Package

1. Upload this ZIP to Bluehost.
2. Extract it into public_html for a root-domain install, or into the matching subfolder for this build.
3. Edit the root .env file:
   VITE_API_URL=$apiPath
4. Edit api/support/config.php with your real Bluehost database, SMTP, and Paystack settings.
5. Import/update the database using the SQL files in database/ if your Bluehost database is not current.
6. Ensure api/uploads/* remains writable by PHP.

This package was built for:
- Frontend URL: $frontendUrl
- Backend URL: $backendUrl
- Base path: $BasePath
"@ | Set-Content -LiteralPath (Join-Path $stageDir "DEPLOY-README.txt") -Encoding ASCII

@"
<?php
declare(strict_types=1);

return [
    'APP_DEBUG' => false,

    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_SOCKET' => '',
    'DB_NAME' => 'your_bluehost_db_name',
    'DB_USER' => 'your_bluehost_db_user',
    'DB_PASS' => 'your_bluehost_db_password',

    'FRONTEND_APP_URL' => '$frontendUrl',
    'BACKEND_APP_URL' => '$backendUrl',
    'ALLOWED_ORIGINS' => [
        'https://$Domain',
        'https://www.$Domain',
    ],

    'MAIL_FROM_ADDRESS' => 'no-reply@$Domain',
    'MAIL_FROM_NAME' => 'JASTI Support',
    'MAIL_BRAND_NAME' => 'JASTI',
    'SMTP_HOST' => '',
    'SMTP_PORT' => '465',
    'SMTP_SECURE' => 'ssl',
    'SMTP_TIMEOUT' => '20',
    'SMTP_USERNAME' => '',
    'SMTP_PASSWORD' => '',

    'PAYSTACK_SECRET_KEY' => '',
    'PAYSTACK_PUBLIC_KEY' => '',
    'PAYSTACK_BASE_URL' => 'https://api.paystack.co',

    'MAX_UPLOAD_SIZE_BYTES' => 10485760,
];
"@ | Set-Content -LiteralPath (Join-Path $stageDir "api\support\config.php") -Encoding ASCII

$hostedConfig = Join-Path $stageDir "api\support\config-hosted-fixed.php"
if (Test-Path -LiteralPath $hostedConfig) {
    Remove-Item -LiteralPath $hostedConfig -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force

Write-Host "Stage directory: $stageDir"
Write-Host "Zip package: $zipPath"
