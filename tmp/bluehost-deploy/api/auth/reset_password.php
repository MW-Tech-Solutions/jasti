<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$data = ajasti_request_data();

if (!ajasti_password_reset_schema_ready($pdo)) {
    ajasti_json(['message' => 'Password reset schema is not available yet. Run database/password_reset_migration.sql first.'], 503);
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
$token = trim((string) ($data['token'] ?? ''));
$password = (string) ($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $token === '' || $password === '') {
    ajasti_json(['message' => 'Email, reset token, and new password are required.'], 422);
}

if (strlen($password) < 8) {
    ajasti_json(['message' => 'Password must be at least 8 characters long.'], 422);
}

$tokenHash = hash('sha256', $token);
$stmt = $pdo->prepare(
    'SELECT user_id, password_reset_token, password_reset_expires_at
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    ajasti_json(['message' => 'This reset link is invalid or has expired.'], 422);
}

$expiresAt = (string) ($user['password_reset_expires_at'] ?? '');
if (
    $expiresAt === ''
    || strtotime($expiresAt) < time()
    || !hash_equals((string) ($user['password_reset_token'] ?? ''), $tokenHash)
) {
    ajasti_json(['message' => 'This reset link is invalid or has expired.'], 422);
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$updateStmt = $pdo->prepare(
    'UPDATE users
     SET password_hash = :password_hash,
         password_reset_token = NULL,
         password_reset_sent_at = NULL,
         password_reset_expires_at = NULL
     WHERE user_id = :user_id'
);
$updateStmt->execute([
    'password_hash' => $passwordHash,
    'user_id' => (int) $user['user_id'],
]);

ajasti_log($pdo, (int) $user['user_id'], 'reset password', 'users', (int) $user['user_id']);

ajasti_json(['message' => 'Password reset successful. You can sign in now.']);
