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

$role = jasti_normalize_role((string) ($data['role'] ?? ''));
$editor_type = strtolower(trim((string) ($data['editor_type'] ?? '')));

// Check if this is editor registration or regular registration
$isEditorRegistration = $editor_type !== '';
$allowedRoles = $isEditorRegistration ? ['editor_in_chief', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board', 'reviewer'] : ['author', 'reviewer'];

if ($isEditorRegistration) {
    jasti_ensure_editor_types($pdo);
    jasti_ensure_editor_applications($pdo);
    $editor_type_data = jasti_editor_type_by_name($pdo, $editor_type);
    if (!$editor_type_data) {
        jasti_json(['message' => 'Invalid editor type.'], 422);
    }
} else {
    if (!in_array($role, $allowedRoles, true)) {
        jasti_json(['message' => 'Role must be either author or reviewer.'], 422);
    }
}

$firstName = trim((string) ($data['first_name'] ?? ''));
$lastName = trim((string) ($data['last_name'] ?? ''));
$email = strtolower(trim((string) ($data['email'] ?? '')));
$password = (string) ($data['password'] ?? '');
$confirmPassword = (string) ($data['confirm_password'] ?? '');
$institution = trim((string) ($data['institution'] ?? ''));
$country = trim((string) ($data['country'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));
$orcidId = trim((string) ($data['orcid_id'] ?? ''));

if ($firstName === '' || $lastName === '' || $institution === '' || $country === '') {
    jasti_json(['message' => 'First name, last name, institution, and country are required.'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jasti_json(['message' => 'A valid email address is required.'], 422);
}
if (strlen($password) < 8) {
    jasti_json(['message' => 'Password must be at least 8 characters long.'], 422);
}
if ($confirmPassword !== '' && $password !== $confirmPassword) {
    jasti_json(['message' => 'Password confirmation does not match.'], 422);
}

$check = $pdo->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
$check->execute(['email' => $email]);
if ($check->fetch()) {
    jasti_json(['message' => 'An account with this email already exists.'], 409);
}

$roleDescriptions = [
    'author' => 'Author account for manuscript submission and revision workflow.',
    'reviewer' => 'Reviewer account for peer review evaluation and invitation management.',
];

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$verification = null;
$emailSent = false;
$emailError = null;
$pdo->beginTransaction();
try {
    $userStmt = $pdo->prepare(
        'INSERT INTO users (first_name, last_name, email, password_hash, email_verification_token, email_verification_sent_at, email_verification_expires_at, email_verified_at, orcid_id, institution, country, phone, status, editor_type_id)
         VALUES (:first_name, :last_name, :email, :password_hash, NULL, NULL, NULL, NULL, :orcid_id, :institution, :country, :phone, :status, :editor_type_id)'
    );
    $userStmt->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'password_hash' => $passwordHash,
        'orcid_id' => $orcidId !== '' ? $orcidId : null,
        'institution' => $institution,
        'country' => $country,
        'phone' => $phone !== '' ? $phone : null,
        'status' => 'active',
        'editor_type_id' => $isEditorRegistration ? $editor_type_data['editor_type_id'] : null,
    ]);

    $userId = (int) $pdo->lastInsertId();
    
    // If editor registration, create the application record. The editor profile is created on approval.
    if ($isEditorRegistration) {
        jasti_create_editor_application($pdo, $userId, (int) $editor_type_data['editor_type_id'], [
            'subject_areas' => trim((string) ($data['subject_areas'] ?? '')),
            'bio' => trim((string) ($data['bio'] ?? '')),
            'expertise_description' => trim((string) ($data['expertise_description'] ?? '')),
        ]);
        
        $roleToAssign = $editor_type;
    } else {
        $roleToAssign = $role;
    }
    
    jasti_assign_account_role($pdo, $userId, $roleToAssign, $roleDescriptions[$role] ?? 'Editorial role');

    if (!$isEditorRegistration && $role === 'reviewer') {
        $reviewerStmt = $pdo->prepare(
            'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
             VALUES (:reviewer_id, :expertise_area, :reviewer_rating, :total_reviews, :availability_status)'
        );
        $reviewerStmt->execute([
            'reviewer_id' => $userId,
            'expertise_area' => trim((string) ($data['expertise_area'] ?? 'Peer review area pending update')),
            'reviewer_rating' => 0.00,
            'total_reviews' => 0,
            'availability_status' => 'available',
        ]);
    }

    $verification = jasti_issue_email_verification($pdo, $userId, $email);

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jasti_json(['message' => 'Unable to register account.', 'error' => $exception->getMessage()], 500);
}

try {
    jasti_send_verification_email($email, (string) ($verification['link'] ?? ''));
    $emailSent = true;
} catch (Throwable $exception) {
    $emailError = $exception->getMessage();
    error_log('Unable to send registration verification email for ' . $email . ': ' . $emailError);
}

if ($isEditorRegistration) {
    if (session_status() === PHP_SESSION_ACTIVE) {
        @session_regenerate_id(true);
    }
    $_SESSION['user_id'] = $userId;
    $_SESSION['roles'] = jasti_user_roles($pdo, $userId);
}

$payload = [
    'message' => $emailSent
        ? 'Registration successful. Check your email and verify your account before signing in.'
        : 'Registration successful, but the verification email could not be sent. Please contact support or try resending the verification email later.',
    'user' => [
        'user_id' => $userId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'roles' => jasti_user_roles($pdo, $userId),
        'editor_type' => $isEditorRegistration ? $editor_type : null,
        'dashboard_url' => $isEditorRegistration ? jasti_get_dashboard_url($editor_type) : null,
    ],
    'verification' => [
        'sent_at' => $emailSent ? ($verification['sent_at'] ?? null) : null,
        'expires_at' => $verification['expires_at'] ?? null,
        'email_sent' => $emailSent,
    ],
];

if (!$emailSent && jasti_debug_enabled()) {
    $payload['verification']['email_error'] = $emailError;
}

jasti_json($payload, $emailSent ? 201 : 202);
