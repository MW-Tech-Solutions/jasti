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
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ajasti_json(['message' => 'A valid email address is required.'], 422);
}

$stmt = $pdo->prepare(
    'SELECT user_id, email, status
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || (string) ($user['status'] ?? 'inactive') !== 'active') {
    ajasti_json(['message' => 'If an account with that email exists, a password reset email has been sent.']);
}

$reset = ajasti_issue_password_reset($pdo, (int) $user['user_id'], (string) $user['email']);
try {
    ajasti_send_password_reset_email((string) $user['email'], (string) $reset['link']);
} catch (Throwable $exception) {
    $payload = ['message' => 'Unable to send password reset email.'];
    if (ajasti_debug_enabled()) {
        $payload['error'] = $exception->getMessage();
    }
    ajasti_json($payload, 500);
}

ajasti_json([
    'message' => 'If an account with that email exists, a password reset email has been sent.',
]);
