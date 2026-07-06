<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('POST');

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'admin');
$userId = (int) $user['user_id'];
$data = ajasti_request_data();

if (($data['action'] ?? '') === 'create') {
    $firstName = trim((string) ($data['first_name'] ?? ''));
    $lastName = trim((string) ($data['last_name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $password = (string) ($data['password'] ?? '');
    $institution = trim((string) ($data['institution'] ?? ''));
    $country = trim((string) ($data['country'] ?? ''));
    $phone = trim((string) ($data['phone'] ?? ''));
    $orcidId = trim((string) ($data['orcid_id'] ?? ''));
    $status = trim((string) ($data['status'] ?? 'active'));
    $roleName = ajasti_normalize_role((string) ($data['role'] ?? 'author'));

    if ($firstName === '' || $lastName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
        ajasti_json(['message' => 'First name, last name, valid email, and password with at least 8 characters are required.'], 422);
    }

    if (!in_array($status, ['active', 'inactive'], true)) {
        ajasti_json(['message' => 'Invalid status value.'], 422);
    }

    $allowedRoles = ['author', 'reviewer', 'editor', 'editor_in_chief', 'admin'];
    if (!in_array($roleName, $allowedRoles, true)) {
        ajasti_json(['message' => 'Invalid role selected.'], 422);
    }

    $existing = $pdo->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);
    if ($existing->fetchColumn() !== false) {
        ajasti_json(['message' => 'A user with this email already exists.'], 409);
    }

    $pdo->beginTransaction();
    try {
        $insertUser = $pdo->prepare(
            'INSERT INTO users (first_name, last_name, email, password_hash, orcid_id, institution, country, phone, status)
             VALUES (:first_name, :last_name, :email, :password_hash, :orcid_id, :institution, :country, :phone, :status)'
        );
        $insertUser->execute([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'orcid_id' => $orcidId !== '' ? $orcidId : null,
            'institution' => $institution !== '' ? $institution : null,
            'country' => $country !== '' ? $country : null,
            'phone' => $phone !== '' ? $phone : null,
            'status' => $status,
        ]);

        $targetUserId = (int) $pdo->lastInsertId();
        $roleId = ajasti_ensure_role($pdo, $roleName, ucfirst(str_replace('_', ' ', $roleName)) . ' role');
        $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)')->execute([
            'user_id' => $targetUserId,
            'role_id' => $roleId,
        ]);

        if ($roleName === 'reviewer') {
            $pdo->prepare(
                'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
                 VALUES (:reviewer_id, :expertise_area, 0.00, 0, :availability_status)'
            )->execute([
                'reviewer_id' => $targetUserId,
                'expertise_area' => trim((string) ($data['expertise_area'] ?? 'Reviewer expertise pending update')),
                'availability_status' => 'available',
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    ajasti_log($pdo, $userId, 'created user', 'users', $targetUserId);
    ajasti_json(['message' => 'User created successfully.', 'users' => ajasti_users_with_roles($pdo)]);
}

if (($data['action'] ?? '') === 'edit') {
    $targetUserId = (int) ($data['user_id'] ?? 0);
    if ($targetUserId <= 0) {
        ajasti_json(['message' => 'Target user is required.'], 422);
    }

    $firstName = trim((string) ($data['first_name'] ?? ''));
    $lastName = trim((string) ($data['last_name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    if ($firstName === '' || $lastName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        ajasti_json(['message' => 'First name, last name, and valid email are required.'], 422);
    }

    $status = trim((string) ($data['status'] ?? 'active'));
    if (!in_array($status, ['active', 'inactive'], true)) {
        ajasti_json(['message' => 'Invalid status value.'], 422);
    }

    $checkEmail = $pdo->prepare('SELECT user_id FROM users WHERE email = :email AND user_id <> :user_id LIMIT 1');
    $checkEmail->execute([
        'email' => $email,
        'user_id' => $targetUserId,
    ]);
    if ($checkEmail->fetchColumn() !== false) {
        ajasti_json(['message' => 'Another user already uses this email.'], 409);
    }

    $pdo->prepare(
        'UPDATE users
         SET first_name = :first_name,
             last_name = :last_name,
             email = :email,
             institution = :institution,
             country = :country,
             phone = :phone,
             orcid_id = :orcid_id,
             status = :status
         WHERE user_id = :user_id'
    )->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'institution' => trim((string) ($data['institution'] ?? '')) ?: null,
        'country' => trim((string) ($data['country'] ?? '')) ?: null,
        'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
        'orcid_id' => trim((string) ($data['orcid_id'] ?? '')) ?: null,
        'status' => $status,
        'user_id' => $targetUserId,
    ]);

    ajasti_log($pdo, $userId, 'edited user', 'users', $targetUserId);
    ajasti_json(['message' => 'User edited successfully.', 'users' => ajasti_users_with_roles($pdo)]);
}

if (($data['action'] ?? '') === 'delete') {
    $targetUserId = (int) ($data['user_id'] ?? 0);
    if ($targetUserId <= 0) {
        ajasti_json(['message' => 'Target user is required.'], 422);
    }
    if ($targetUserId === $userId) {
        ajasti_json(['message' => 'You cannot delete your own account.'], 422);
    }

    try {
        $pdo->prepare('DELETE FROM users WHERE user_id = :user_id')->execute(['user_id' => $targetUserId]);
    } catch (Throwable $exception) {
        ajasti_json(['message' => 'This user cannot be deleted because related journal records still exist.'], 409);
    }

    ajasti_log($pdo, $userId, 'deleted user', 'users', $targetUserId);
    ajasti_json(['message' => 'User deleted successfully.', 'users' => ajasti_users_with_roles($pdo)]);
}

$targetUserId = (int) ($data['user_id'] ?? 0);
if ($targetUserId <= 0) {
    ajasti_json(['message' => 'Target user is required.'], 422);
}

if (array_key_exists('status', $data)) {
    $status = trim((string) $data['status']);
    if (!in_array($status, ['active', 'inactive'], true)) {
        ajasti_json(['message' => 'Invalid status value.'], 422);
    }
    $pdo->prepare('UPDATE users SET status = :status WHERE user_id = :user_id')->execute([
        'status' => $status,
        'user_id' => $targetUserId,
    ]);
}

if (!empty($data['role'])) {
    $roleName = ajasti_normalize_role((string) $data['role']);
    $roleId = ajasti_ensure_role($pdo, $roleName, ucfirst(str_replace('_', ' ', $roleName)) . ' role');
    $check = $pdo->prepare('SELECT user_role_id FROM user_roles WHERE user_id = :user_id AND role_id = :role_id LIMIT 1');
    $check->execute(['user_id' => $targetUserId, 'role_id' => $roleId]);
    if ($check->fetchColumn() === false) {
        $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)')->execute([
            'user_id' => $targetUserId,
            'role_id' => $roleId,
        ]);
        if ($roleName === 'reviewer') {
            $pdo->prepare(
                'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
                 VALUES (:reviewer_id, :expertise_area, 0.00, 0, :availability_status)
                 ON DUPLICATE KEY UPDATE availability_status = VALUES(availability_status)'
            )->execute([
                'reviewer_id' => $targetUserId,
                'expertise_area' => 'Reviewer expertise pending update',
                'availability_status' => 'available',
            ]);
        }
    }
}

ajasti_log($pdo, $userId, 'updated user access', 'users', $targetUserId);
ajasti_json(['message' => 'User updated successfully.', 'users' => ajasti_users_with_roles($pdo)]);
