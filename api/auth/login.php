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
$password = (string) ($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    jasti_json(['message' => 'Email and password are required.'], 422);
}

$stmt = $pdo->prepare(
    'SELECT user_id, first_name, last_name, email, password_hash, status, email_verified_at, email_verification_token, email_verification_sent_at, email_verification_expires_at
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !jasti_password_verify_legacy($password, (string) $user['password_hash'])) {
    jasti_json(['message' => 'Invalid login credentials.'], 401);
}

if (jasti_password_needs_upgrade((string) $user['password_hash'])) {
    $newPasswordHash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id')
        ->execute([
            'password_hash' => $newPasswordHash,
            'user_id' => (int) $user['user_id'],
        ]);
    $user['password_hash'] = $newPasswordHash;
}

if (($user['status'] ?? 'inactive') !== 'active') {
    if (($user['status'] ?? '') === 'pending') {
        jasti_json(['message' => 'Your account is pending review. Complete any required onboarding and wait for approval before signing in.'], 403);
    }
    jasti_json(['message' => 'This account is inactive.'], 403);
}

try {
    $roles = jasti_user_roles($pdo, (int) $user['user_id']);
} catch (Throwable $exception) {
    jasti_json(['message' => 'User role data is not available for login yet.', 'error' => $exception->getMessage()], 500);
}
if ($roles === []) {
    jasti_json(['message' => 'This account has no assigned roles.'], 403);
}

if (empty($user['email_verified_at'])) {
    $backfillVerification = array_intersect(
        $roles,
        ['reviewer', 'editor', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board', 'editor_in_chief', 'admin']
    ) !== [];
    $hasVerificationTicket = !empty($user['email_verification_token'])
        || !empty($user['email_verification_sent_at'])
        || !empty($user['email_verification_expires_at']);

    if ($backfillVerification && !$hasVerificationTicket) {
        $pdo->prepare(
            'UPDATE users
             SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                 email_verification_token = NULL,
                 email_verification_sent_at = NULL,
                 email_verification_expires_at = NULL
             WHERE user_id = :user_id'
        )->execute(['user_id' => (int) $user['user_id']]);
        $user['email_verified_at'] = date('Y-m-d H:i:s');
    }
}

if (empty($user['email_verified_at'])) {
    jasti_json([
        'message' => 'Verify your email address before signing in.',
        'verification' => [
            'sent_at' => $user['email_verification_sent_at'] ?? null,
            'expires_at' => $user['email_verification_expires_at'] ?? null,
            'verified' => false,
        ],
    ], 403);
}

if (jasti_has_editor_application_role($roles)) {
    $application = jasti_get_latest_editor_application($pdo, (int) $user['user_id']);
    $editorProfile = jasti_user_editor_profile($pdo, (int) $user['user_id']);

    if ($application !== null && $editorProfile === null) {
        $applicationStatus = strtolower((string) ($application['status'] ?? ''));

        if ($applicationStatus === 'pending') {
            jasti_json(['message' => 'Your editor application is pending review. You can sign in after approval.'], 403);
        }

        if ($applicationStatus === 'rejected') {
            jasti_json(['message' => 'Your editor application was not approved. Contact the journal office if you need support.'], 403);
        }

        jasti_json(['message' => 'Your editorial access is not active yet.'], 403);
    }
}

$pdo->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = :user_id')
    ->execute(['user_id' => (int) $user['user_id']]);

if (session_status() === PHP_SESSION_ACTIVE) {
    @session_regenerate_id(true);
}
$_SESSION['user_id'] = (int) $user['user_id'];
$_SESSION['roles'] = $roles;

jasti_json([
    'message' => 'Login successful.',
    'user' => [
        'user_id' => (int) $user['user_id'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'email' => $user['email'],
        'avatar_path' => $user['avatar_path'] ?? null,
        'roles' => $roles,
    ],
]);
