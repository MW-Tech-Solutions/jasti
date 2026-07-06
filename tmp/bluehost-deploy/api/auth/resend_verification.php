<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$data = ajasti_request_data();

if (!ajasti_email_verification_schema_ready($pdo)) {
    ajasti_json(['message' => 'Email verification schema is not available yet. Run database/email_verification_migration.sql first.'], 503);
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ajasti_json(['message' => 'A valid email address is required.'], 422);
}

$stmt = $pdo->prepare(
    'SELECT user_id, email, email_verified_at, email_verification_sent_at, email_verification_expires_at
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    ajasti_json(['message' => 'If an account with that email exists, a verification email has been sent.']);
}

if (!empty($user['email_verified_at'])) {
    ajasti_json([
        'message' => 'This email address has already been verified. You can sign in now.',
        'verification' => [
            'sent_at' => $user['email_verification_sent_at'] ?? null,
            'expires_at' => $user['email_verification_expires_at'] ?? null,
            'verified' => true,
        ],
    ]);
}

$verification = ajasti_issue_email_verification($pdo, (int) $user['user_id'], (string) $user['email']);
try {
    ajasti_send_verification_email((string) $user['email'], (string) $verification['link']);
} catch (Throwable $exception) {
    ajasti_json([
        'message' => 'Unable to send verification email.',
        'error' => $exception->getMessage(),
    ], 500);
}

ajasti_json([
    'message' => 'If an account with that email exists, a verification email has been sent.',
    'verification' => [
        'sent_at' => $verification['sent_at'],
        'expires_at' => $verification['expires_at'],
        'verified' => false,
    ],
]);
