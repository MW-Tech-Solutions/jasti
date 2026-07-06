<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$data = jasti_request_data();

if (!jasti_password_reset_schema_ready($pdo)) {
    jasti_json(['message' => 'Password reset schema is not available yet. Run database/password_reset_migration.sql first.'], 503);
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jasti_json(['message' => 'A valid email address is required.'], 422);
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
    jasti_json(['message' => 'If an account with that email exists, a password reset email has been sent.']);
}

$reset = jasti_issue_password_reset($pdo, (int) $user['user_id'], (string) $user['email']);
$emailSent = false;
$emailError = null;
try {
    jasti_send_password_reset_email((string) $user['email'], (string) $reset['link']);
    $emailSent = true;
} catch (Throwable $exception) {
    $emailError = $exception->getMessage();
    error_log('Unable to send password reset email for ' . (string) $user['email'] . ': ' . $emailError);
}

$payload = [
    'message' => $emailSent
        ? 'If an account with that email exists, a password reset email has been sent.'
        : 'A password reset link was prepared, but the email could not be sent right now. Please try again later or contact support.',
    'reset' => [
        'sent_at' => $emailSent ? ($reset['sent_at'] ?? null) : null,
        'expires_at' => $reset['expires_at'] ?? null,
        'email_sent' => $emailSent,
    ],
];

if (!$emailSent && jasti_debug_enabled()) {
    $payload['reset']['email_error'] = $emailError;
}

jasti_json($payload, $emailSent ? 200 : 202);
