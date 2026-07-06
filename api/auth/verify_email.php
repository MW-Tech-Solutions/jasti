<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$showVerificationResult = static function (string $verification, string $loginPath = '/login/author'): void {
    $loginRole = trim(basename($loginPath));
    if (!in_array($loginRole, ['author', 'reviewer', 'editor', 'admin'], true)) {
        $loginRole = 'author';
    }

    $messages = [
        'success' => [
            'title' => 'Email verified successfully',
            'body' => 'Your email address has been verified. You can now sign in to your JASTI workspace.',
            'tone' => 'success',
        ],
        'already_verified' => [
            'title' => 'Email already verified',
            'body' => 'This email address has already been verified. You can sign in now.',
            'tone' => 'success',
        ],
        'invalid' => [
            'title' => 'Verification link invalid or expired',
            'body' => 'This verification link is invalid, expired, or has already been replaced. Please request a new verification email.',
            'tone' => 'error',
        ],
        'missing_schema' => [
            'title' => 'Verification is not configured',
            'body' => 'Email verification is not available yet. Please contact support.',
            'tone' => 'error',
        ],
    ];

    $message = $messages[$verification] ?? $messages['invalid'];
    $loginUrl = jasti_frontend_url(ltrim($loginPath, '/') . '?verification=' . urlencode($verification) . '&login=' . urlencode($loginRole));
    $homeUrl = jasti_frontend_url('');
    $title = htmlspecialchars($message['title'], ENT_QUOTES, 'UTF-8');
    $body = htmlspecialchars($message['body'], ENT_QUOTES, 'UTF-8');
    $safeLoginUrl = htmlspecialchars($loginUrl, ENT_QUOTES, 'UTF-8');
    $safeHomeUrl = htmlspecialchars($homeUrl, ENT_QUOTES, 'UTF-8');
    $isSuccess = $message['tone'] === 'success';
    $badgeColor = $isSuccess ? '#0f766e' : '#b42318';
    $badgeBg = $isSuccess ? '#ecfdf5' : '#fef3f2';
    $icon = $isSuccess ? '&#10003;' : '!';

    http_response_code(200);
    header('Content-Type: text/html; charset=UTF-8');
    echo <<<HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{$title} | JASTI</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 36%,#f8fafc 100%);color:#0f172a;font-family:Inter,Arial,Helvetica,sans-serif}.panel{width:min(100%,620px);overflow:hidden;background:#fff;border:1px solid #dce7ef;border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.14)}.bar{height:8px;background:linear-gradient(90deg,#0b6fa4,#1f6b5c)}.content{padding:clamp(24px,5vw,44px)}.badge{width:58px;height:58px;display:grid;place-items:center;margin-bottom:22px;border-radius:18px;background:{$badgeBg};color:{$badgeColor};font-size:28px;font-weight:900}.eyebrow{margin:0 0 10px;color:#0b6fa4;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;color:#0f172a;font-size:clamp(28px,5vw,42px);line-height:1.05}p{margin:16px 0 0;color:#526174;font-size:16px;line-height:1.7}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:12px;font-weight:800;text-decoration:none}.primary{color:#fff;background:#0b6fa4}.secondary{color:#334155;background:#f1f5f9;border:1px solid #dbe4ee}
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="bar"></div>
      <section class="content">
        <div class="badge">{$icon}</div>
        <p class="eyebrow">JASTI Email Verification</p>
        <h1>{$title}</h1>
        <p>{$body}</p>
        <div class="actions">
          <a class="btn primary" href="{$safeLoginUrl}">Continue To Login</a>
          <a class="btn secondary" href="{$safeHomeUrl}">Go To Homepage</a>
        </div>
      </section>
    </main>
  </body>
</html>
HTML;
    exit;
};

if (!jasti_email_verification_schema_ready($pdo)) {
    $showVerificationResult('missing_schema');
}

$token = trim((string) ($_GET['token'] ?? ''));
$email = strtolower(trim((string) ($_GET['email'] ?? '')));

if ($token === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $showVerificationResult('invalid');
}

$tokenHash = hash('sha256', $token);
$stmt = $pdo->prepare(
    'SELECT user_id, email_verified_at, email_verification_token, email_verification_expires_at
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    $showVerificationResult('invalid');
}

$loginPath = jasti_login_path_for_roles(jasti_user_roles($pdo, (int) $user['user_id']));

if (!empty($user['email_verified_at'])) {
    $showVerificationResult('already_verified', $loginPath);
}

$expiresAt = (string) ($user['email_verification_expires_at'] ?? '');
if ($expiresAt === '' || strtotime($expiresAt) < time() || !hash_equals((string) ($user['email_verification_token'] ?? ''), $tokenHash)) {
    $showVerificationResult('invalid', $loginPath);
}

$updateStmt = $pdo->prepare(
    'UPDATE users
     SET email_verified_at = CURRENT_TIMESTAMP,
         email_verification_token = NULL,
         email_verification_sent_at = NULL,
         email_verification_expires_at = NULL
     WHERE user_id = :user_id'
);
$updateStmt->execute(['user_id' => (int) $user['user_id']]);

jasti_log($pdo, (int) $user['user_id'], 'verified email address', 'users', (int) $user['user_id']);

$showVerificationResult('success', $loginPath);
