<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

$pdo = jasti_db();
$data = jasti_request_data();

if (!jasti_email_verification_schema_ready($pdo)) {
    jasti_json(['message' => 'Email verification schema is not available yet. Run database/email_verification_migration.sql first.'], 503);
}

$email = strtolower(trim((string) ($data['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jasti_json(['message' => 'A valid email address is required.'], 422);
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
    jasti_json(['message' => 'If an account with that email exists, a verification email has been sent.']);
}

if (!empty($user['email_verified_at'])) {
    jasti_json([
        'message' => 'This email address has already been verified. You can sign in now.',
        'verification' => [
            'sent_at' => $user['email_verification_sent_at'] ?? null,
            'expires_at' => $user['email_verification_expires_at'] ?? null,
            'verified' => true,
        ],
    ]);
}

$verification = jasti_issue_email_verification($pdo, (int) $user['user_id'], (string) $user['email']);
$emailSent = false;
$emailError = null;
try {
    jasti_send_verification_email((string) $user['email'], (string) $verification['link']);
    $emailSent = true;
} catch (Throwable $exception) {
    $emailError = $exception->getMessage();
    error_log('Unable to resend verification email for ' . (string) $user['email'] . ': ' . $emailError);
}

$payload = [
    'message' => $emailSent
        ? 'If an account with that email exists, a verification email has been sent.'
        : 'A new verification link was prepared, but the email could not be sent right now. Please try again later or contact support.',
    'verification' => [
        'sent_at' => $emailSent ? ($verification['sent_at'] ?? null) : null,
        'expires_at' => $verification['expires_at'],
        'verified' => false,
        'email_sent' => $emailSent,
    ],
];

if (!$emailSent && jasti_debug_enabled()) {
    $payload['verification']['email_error'] = $emailError;
}

jasti_json($payload, $emailSent ? 200 : 202);
