#!/usr/bin/env bash
set -euo pipefail

BASE_PATH="/"
DOMAIN="your-domain.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-path)
      BASE_PATH="${2:-/}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-your-domain.com}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: bash scripts/package_bluehost.sh [--base-path /|/jasti/] [--domain example.com]" >&2
      exit 1
      ;;
  esac
done

if [[ "${BASE_PATH}" != /* ]]; then
  BASE_PATH="/${BASE_PATH}"
fi

if [[ "${BASE_PATH}" != */ ]]; then
  BASE_PATH="${BASE_PATH}/"
fi

BASE_SLUG="${BASE_PATH//\//}"
BASE_SLUG="$(printf '%s' "${BASE_SLUG}" | tr -c 'A-Za-z0-9_-' '-')"
if [[ -z "${BASE_SLUG}" ]]; then
  BASE_SLUG="root"
fi

API_PATH="${BASE_PATH%/}/api"
if [[ "${BASE_PATH}" == "/" ]]; then
  FRONTEND_URL="https://${DOMAIN}"
else
  FRONTEND_URL="https://${DOMAIN}${BASE_PATH%/}"
fi
BACKEND_URL="https://${DOMAIN}${API_PATH}"

STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE_DIR="build/hosting-package-${BASE_SLUG}-${STAMP}"
ZIP_PATH="jasti-bluehost-deploy-${BASE_SLUG}-${STAMP}.zip"

echo "Building frontend for base path: ${BASE_PATH}"
VITE_APP_BASE_PATH="${BASE_PATH}" npm run build

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"

cp -a dist/. "${STAGE_DIR}/"
cp -a api "${STAGE_DIR}/"
cp -a vendor "${STAGE_DIR}/"
cp -a database "${STAGE_DIR}/"
cp composer.json composer.lock "${STAGE_DIR}/"
cp .env.example "${STAGE_DIR}/.env.example"

rm -rf "${STAGE_DIR}/api/uploads"
mkdir -p \
  "${STAGE_DIR}/api/uploads/manuscripts" \
  "${STAGE_DIR}/api/uploads/revisions" \
  "${STAGE_DIR}/api/uploads/payments" \
  "${STAGE_DIR}/api/uploads/copyright" \
  "${STAGE_DIR}/api/uploads/profiles" \
  "${STAGE_DIR}/api/uploads/settings" \
  "${STAGE_DIR}/api/uploads/system" \
  "${STAGE_DIR}/api/uploads/reviewers/cv" \
  "${STAGE_DIR}/api/uploads/reviewers/publications" \
  "${STAGE_DIR}/api/uploads/reviewers/orcid" \
  "${STAGE_DIR}/api/uploads/editors/cv" \
  "${STAGE_DIR}/api/uploads/editors/publications" \
  "${STAGE_DIR}/api/uploads/cv"

if [[ -f "api/uploads/.htaccess" ]]; then
  cp -a "api/uploads/.htaccess" "${STAGE_DIR}/api/uploads/.htaccess"
fi

if [[ -d "api/uploads/system" ]]; then
  cp -a api/uploads/system/. "${STAGE_DIR}/api/uploads/system/"
fi

if [[ -d "api/uploads/settings" ]]; then
  cp -a api/uploads/settings/. "${STAGE_DIR}/api/uploads/settings/"
fi

cat > "${STAGE_DIR}/.env" <<EOF
VITE_API_URL=${API_PATH}
VITE_APP_BASE_PATH=${BASE_PATH}
EOF

cat > "${STAGE_DIR}/DEPLOY-README.txt" <<EOF
JASTI Bluehost Deployment Package

1. Upload this ZIP to Bluehost.
2. Extract it into ${BASE_PATH#/} (or the matching web root for this build).
3. Edit the root .env file:
   VITE_API_URL=${API_PATH}
4. Edit api/support/config.php with your real Bluehost database, SMTP, and Paystack settings.
5. Import/update the database using the SQL files in database/ if your Bluehost database is not current.
6. Ensure api/uploads/* remains writable by PHP.

This package was built for:
- Frontend URL: ${FRONTEND_URL}
- Backend URL: ${BACKEND_URL}
- Base path: ${BASE_PATH}
EOF

cat > "${STAGE_DIR}/api/support/config.php" <<EOF
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

    'FRONTEND_APP_URL' => '${FRONTEND_URL}',
    'BACKEND_APP_URL' => '${BACKEND_URL}',
    'ALLOWED_ORIGINS' => [
        'https://${DOMAIN}',
        'https://www.${DOMAIN}',
    ],

    'MAIL_FROM_ADDRESS' => 'no-reply@${DOMAIN}',
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
EOF

rm -f "${STAGE_DIR}/api/support/config-hosted-fixed.php"
rm -f "${ZIP_PATH}"

(
  cd "${STAGE_DIR}"
  zip -qr "../../${ZIP_PATH}" .
)

echo "Stage directory: ${STAGE_DIR}"
echo "Zip package: ${ZIP_PATH}"
