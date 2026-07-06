<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$data = ajasti_request_data();

// Ensure database tables exist
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS editor_types (
        editor_type_id INT PRIMARY KEY AUTO_INCREMENT,
        type_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )'
);

$role = ajasti_normalize_role((string) ($data['role'] ?? ''));
$editorType = trim((string) ($data['editor_type'] ?? ''));
$allowedRoles = ['author', 'reviewer', 'editor'];

if (!in_array($role, $allowedRoles, true)) {
    ajasti_json(['message' => 'Role must be author, reviewer, or editor.'], 422);
}

if ($role === 'editor' && $editorType === '') {
    ajasti_json(['message' => 'Editor type is required when registering as editor.'], 422);
}

// Validate editor type
$validEditorTypes = ['editorial_board', 'associate_editor', 'section_editor', 'managing_editor'];
if ($role === 'editor' && !in_array($editorType, $validEditorTypes, true)) {
    ajasti_json(['message' => 'Invalid editor type. Must be one of: ' . implode(', ', $validEditorTypes)], 422);
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

if (!ajasti_email_verification_schema_ready($pdo)) {
    ajasti_json(['message' => 'Email verification schema is not available yet. Run database/email_verification_migration.sql first.'], 503);
}

$roleDescriptions = [
    'author' => 'Author account for manuscript submission and revision workflow.',
    'reviewer' => 'Reviewer account for peer review evaluation and invitation management.',
    'editor' => 'Editor account - ' . ucfirst(str_replace('_', ' ', $editorType)) . ' for manuscript coordination and editorial decisions.',
];

$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$pdo->beginTransaction();

try {
    // Create user account
    $userStmt = $pdo->prepare(
        'INSERT INTO users (first_name, last_name, email, password_hash, email_verification_token, email_verification_sent_at, email_verification_expires_at, email_verified_at, orcid_id, institution, country, phone, status)
         VALUES (:first_name, :last_name, :email, :password_hash, NULL, NULL, NULL, NULL, :orcid_id, :institution, :country, :phone, :status)'
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
        'status' => $role === 'editor' ? 'pending' : 'active',
    ]);

    $userId = (int) $pdo->lastInsertId();
    $roleId = ajasti_ensure_role($pdo, $role, $roleDescriptions[$role]);

    // Assign role to user
    $userRoleStmt = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)');
    $userRoleStmt->execute([
        'user_id' => $userId,
        'role_id' => $roleId,
    ]);

    // Role-specific initialization
    if ($role === 'reviewer') {
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
    } elseif ($role === 'editor') {
        // Create editor profile
        $editorStmt = $pdo->prepare(
            'INSERT INTO editors (editor_id, editor_role, application_completed, status, first_name, last_name, email, institution, country, orcid_id)
             VALUES (:editor_id, :editor_role, :application_completed, :status, :first_name, :last_name, :email, :institution, :country, :orcid_id)'
        );
        $editorStmt->execute([
            'editor_id' => $userId,
            'editor_role' => $editorType,
            'application_completed' => false,
            'status' => 'pending',
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'institution' => $institution,
            'country' => $country,
            'orcid_id' => $orcidId !== '' ? $orcidId : null,
        ]);
    }

    // Send verification email
    $verification = ajasti_issue_email_verification($pdo, $userId, $email);
    try {
        ajasti_send_verification_email($email, (string) $verification['link']);
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to send verification email. ' . $exception->getMessage(), 0, $exception);
    }

    $pdo->commit();

    ajasti_json([
        'message' => 'Registration successful. Please check your email to verify your account.',
        'user_id' => $userId,
        'role' => $role,
        'editor_type' => $role === 'editor' ? $editorType : null,
    ]);
} catch (Throwable $exception) {
    $pdo->rollBack();
    throw $exception;
}
