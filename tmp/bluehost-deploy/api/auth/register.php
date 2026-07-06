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

$role = ajasti_normalize_role((string) ($data['role'] ?? ''));
$editor_type = strtolower(trim((string) ($data['editor_type'] ?? '')));

// Check if this is editor registration or regular registration
$isEditorRegistration = $editor_type !== '';
$allowedRoles = $isEditorRegistration ? ['editor_in_chief', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board', 'reviewer'] : ['author', 'reviewer'];

if ($isEditorRegistration) {
    ajasti_ensure_editor_types($pdo);
    ajasti_ensure_editor_applications($pdo);
    $editor_type_data = ajasti_editor_type_by_name($pdo, $editor_type);
    if (!$editor_type_data) {
        ajasti_json(['message' => 'Invalid editor type.'], 422);
    }
} else {
    if (!in_array($role, $allowedRoles, true)) {
        ajasti_json(['message' => 'Role must be either author or reviewer.'], 422);
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
    ajasti_json(['message' => 'First name, last name, institution, and country are required.'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ajasti_json(['message' => 'A valid email address is required.'], 422);
}
if (strlen($password) < 8) {
    ajasti_json(['message' => 'Password must be at least 8 characters long.'], 422);
}
if ($confirmPassword !== '' && $password !== $confirmPassword) {
    ajasti_json(['message' => 'Password confirmation does not match.'], 422);
}

$check = $pdo->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
$check->execute(['email' => $email]);
if ($check->fetch()) {
    ajasti_json(['message' => 'An account with this email already exists.'], 409);
}

$roleDescriptions = [
    'author' => 'Author account for manuscript submission and revision workflow.',
    'reviewer' => 'Reviewer account for peer review evaluation and invitation management.',
];

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
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
        ajasti_create_editor_application($pdo, $userId, (int) $editor_type_data['editor_type_id'], [
            'subject_areas' => trim((string) ($data['subject_areas'] ?? '')),
            'bio' => trim((string) ($data['bio'] ?? '')),
            'expertise_description' => trim((string) ($data['expertise_description'] ?? '')),
        ]);
        
        $roleToAssign = $editor_type;
    } else {
        $roleToAssign = $role;
    }
    
    $roleId = ajasti_ensure_role($pdo, $roleToAssign, $roleDescriptions[$role] ?? 'Editorial role');

    $userRoleStmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
    $userRoleStmt->execute([
        'user_id' => $userId,
        'role_id' => $roleId,
    ]);

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

    $verification = ajasti_issue_email_verification($pdo, $userId, $email);
    try {
        ajasti_send_verification_email($email, (string) $verification['link']);
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to send verification email. ' . $exception->getMessage(), 0, $exception);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to register account.', 'error' => $exception->getMessage()], 500);
}

if ($isEditorRegistration) {
    if (session_status() === PHP_SESSION_ACTIVE) {
        @session_regenerate_id(true);
    }
    $_SESSION['user_id'] = $userId;
    $_SESSION['roles'] = [$roleToAssign];
}

ajasti_json([
    'message' => 'Registration successful. Check your email and verify your account before signing in.',
    'user' => [
        'user_id' => $userId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'roles' => [$isEditorRegistration ? $editor_type : $role],
        'editor_type' => $isEditorRegistration ? $editor_type : null,
        'dashboard_url' => $isEditorRegistration ? ajasti_get_dashboard_url($editor_type) : null,
    ],
    'verification' => [
        'sent_at' => $verification['sent_at'],
        'expires_at' => $verification['expires_at'],
    ],
]);
