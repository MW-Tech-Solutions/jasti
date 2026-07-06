<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
if (!ajasti_email_verification_schema_ready($pdo)) {
    http_response_code(302);
    header('Location: ' . ajasti_frontend_url('portal?verification=missing_schema'));
    exit;
}

$token = trim((string) ($_GET['token'] ?? ''));
$email = strtolower(trim((string) ($_GET['email'] ?? '')));

if ($token === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(302);
    header('Location: ' . ajasti_frontend_url('portal?verification=invalid'));
    exit;
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
    http_response_code(302);
    header('Location: ' . ajasti_frontend_url('portal?verification=invalid'));
    exit;
}

if (!empty($user['email_verified_at'])) {
    http_response_code(302);
    header('Location: ' . ajasti_frontend_url('portal?verification=already_verified'));
    exit;
}

$expiresAt = (string) ($user['email_verification_expires_at'] ?? '');
if ($expiresAt === '' || strtotime($expiresAt) < time() || !hash_equals((string) ($user['email_verification_token'] ?? ''), $tokenHash)) {
    http_response_code(302);
    header('Location: ' . ajasti_frontend_url('portal?verification=invalid'));
    exit;
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

ajasti_log($pdo, (int) $user['user_id'], 'verified email address', 'users', (int) $user['user_id']);

http_response_code(302);
header('Location: ' . ajasti_frontend_url('portal?verification=success'));
exit;
