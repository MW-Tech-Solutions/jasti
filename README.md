# JASTI Journal Management System

JASTI is a React + Vite frontend with a PHP PDO backend for journal publishing workflows:

- public journal website
- author, reviewer, editor, editor-in-chief, and admin dashboards
- manuscript submission and revision uploads
- reviewer onboarding and assignment
- payment and copyright workflows
- public article pages

## Stack

- Frontend: React, TypeScript, Vite, Tailwind
- Backend: PHP 8+, PDO, MySQL/MariaDB
- Web server: Apache

## Local development

1. Edit `api/support/config.php`
2. Set database credentials and site values
3. Run:

```bash
composer install
npm install
npm run dev
```

## Production configuration

Set the values directly in:

- `api/support/config.php`

Use values like:

```php
return [
    'APP_DEBUG' => false,
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_SOCKET' => '',
    'DB_NAME' => 'your_database_name',
    'DB_USER' => 'your_database_user',
    'DB_PASS' => 'your_database_password',
    'FRONTEND_APP_URL' => 'https://your-domain.com',
    'ALLOWED_ORIGINS' => 'https://your-domain.com',
    'MAIL_FROM_ADDRESS' => 'no-reply@your-domain.com',
    'PAYSTACK_SECRET_KEY' => 'your_paystack_secret_key',
    'PAYSTACK_PUBLIC_KEY' => 'your_paystack_public_key',
    'PAYSTACK_BASE_URL' => 'https://api.paystack.co',
    'MAX_UPLOAD_SIZE_BYTES' => 10485760,
];
```

## Bluehost deployment

Assumption:
- the site is hosted from one Apache document root
- frontend and PHP API are served from the same domain

### 1. Build the frontend

```bash
npm run build
```

### 2. Upload these items to `public_html/jasti` or your target web root

- contents of `dist/`
- `api/`
- `vendor/` or run `composer install --no-dev` on the server
- `.htaccess`

Keep the `api/uploads/` directory writable by PHP.

### 3. Database

- create the MySQL database
- import your JASTI schema
- ensure the tables used by the app exist
- the backend will add some auxiliary tables/columns automatically on first run

If you are upgrading an existing database instead of importing a fresh dump, run:

```sql
SOURCE database/password_reset_migration.sql;
```

That migration adds the password-reset columns required by the portal recovery flow.

### 4. Apache requirements

- `mod_rewrite` enabled
- PHP upload limits large enough for manuscript uploads
- `pdftotext` available on the server for PDF similarity extraction
- `libreoffice` available on the server for legacy `.doc` similarity extraction

Recommended PHP values:

```ini
upload_max_filesize = 10M
post_max_size = 12M
max_execution_time = 120
memory_limit = 256M
```

### 5. Upload directories

The app writes files under:

- `api/uploads/manuscripts`
- `api/uploads/revisions`
- `api/uploads/payments`
- `api/uploads/copyright`
- `api/uploads/profiles`
- `api/uploads/system`
- `api/uploads/settings`

Ensure Apache/PHP can create and write to these directories.

### 6. Paystack

- put Paystack keys in `api/support/config.php`
- do not expose secrets in frontend files
- set the Paystack callback domain to your deployed frontend URL

### 7. Mail

Account verification and password-reset mail use SMTP settings from `api/support/config.php`.
Reviewer invitation and payment notification mail use PHP `mail()`.

For reliable production delivery, configure domain mail correctly on Bluehost:

- valid sender address
- SPF/DKIM/DMARC
- mailbox or SMTP-backed sender if needed

## Routing

- root `.htaccess` handles SPA route fallback to `index.html`
- `/api` is excluded from SPA rewrites
- `api/uploads/.htaccess` blocks execution of uploaded scripts

## Deployment notes

- Frontend API resolution is runtime-based and does not require `.env`
- For your current deployment path, use `public_html/jasti`
- Uploaded files are served from `/api/uploads/...`

## Validation

Before deployment:

```bash
npm run build
php -l api/support/bootstrap.php
php -l api/support/copyleaks.php
php -l api/admin/integrations.php
php -l api/integrations/copyleaks_webhook.php
php -l api/author/check_plagiarism.php
php -l api/author/plagiarism_status.php
php -l api/author/manuscripts.php
php -l api/author/revisions.php
php -l api/author/payments.php
php -l api/author/copyright.php
php -l api/author/paystack_initialize.php
php -l api/author/paystack_verify.php
php -l api/workspace.php
```

## Plagiarism scoring

- The author manuscript form calculates the plagiarism score automatically after the main manuscript file is uploaded.
- The score is read-only in the UI and is recalculated on final submission by the PHP backend before it is saved.
- If Copyleaks is configured in `Admin > Integrations`, the manuscript is submitted to Copyleaks for a real web-scale plagiarism scan and the author dashboard polls for the live result.
- If Copyleaks is not configured, the system falls back to the JASTI manuscript archive similarity engine.
- Start with Copyleaks sandbox mode, then switch to live mode after the webhook URLs shown in the admin integrations panel are reachable from the public internet.
- Copyleaks callbacks are handled by `api/integrations/copyleaks_webhook.php`, and the latest scan jobs are visible in the admin integrations panel.
