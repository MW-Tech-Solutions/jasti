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
$password = (string) ($data['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    ajasti_json(['message' => 'Email and password are required.'], 422);
}

$stmt = $pdo->prepare(
    'SELECT user_id, first_name, last_name, email, password_hash, status, email_verified_at, email_verification_sent_at, email_verification_expires_at
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute(['email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string) $user['password_hash'])) {
    ajasti_json(['message' => 'Invalid login credentials.'], 401);
}

if (($user['status'] ?? 'inactive') !== 'active') {
    if (($user['status'] ?? '') === 'pending') {
        ajasti_json(['message' => 'Your account is pending review. Complete any required onboarding and wait for approval before signing in.'], 403);
    }
    ajasti_json(['message' => 'This account is inactive.'], 403);
}

if (empty($user['email_verified_at'])) {
    ajasti_json([
        'message' => 'Verify your email address before signing in.',
        'verification' => [
            'sent_at' => $user['email_verification_sent_at'] ?? null,
            'expires_at' => $user['email_verification_expires_at'] ?? null,
            'verified' => false,
        ],
    ], 403);
}

try {
    $roles = ajasti_user_roles($pdo, (int) $user['user_id']);
} catch (Throwable $exception) {
    ajasti_json(['message' => 'User role data is not available for login yet.', 'error' => $exception->getMessage()], 500);
}
if ($roles === []) {
    ajasti_json(['message' => 'This account has no assigned roles.'], 403);
}

if (ajasti_has_editor_application_role($roles)) {
    $application = ajasti_get_latest_editor_application($pdo, (int) $user['user_id']);
    $editorProfile = ajasti_user_editor_profile($pdo, (int) $user['user_id']);

    if ($application !== null && $editorProfile === null) {
        $applicationStatus = strtolower((string) ($application['status'] ?? ''));

        if ($applicationStatus === 'pending') {
            ajasti_json(['message' => 'Your editor application is pending review. You can sign in after approval.'], 403);
        }

        if ($applicationStatus === 'rejected') {
            ajasti_json(['message' => 'Your editor application was not approved. Contact the journal office if you need support.'], 403);
        }

        ajasti_json(['message' => 'Your editorial access is not active yet.'], 403);
    }
}

$pdo->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = :user_id')
    ->execute(['user_id' => (int) $user['user_id']]);

if (session_status() === PHP_SESSION_ACTIVE) {
    @session_regenerate_id(true);
}
$_SESSION['user_id'] = (int) $user['user_id'];
$_SESSION['roles'] = $roles;

ajasti_json([
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
