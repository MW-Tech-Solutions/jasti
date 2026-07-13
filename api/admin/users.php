<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('POST');

try {
    $pdo = jasti_db();
    $user = jasti_require_role($pdo, 'admin');
    $userId = (int) $user['user_id'];
    $data = jasti_request_data();
    $allowedAccountRoles = ['author', 'reviewer', 'editor', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board', 'editor_in_chief', 'admin'];

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
    $roleName = jasti_normalize_role((string) ($data['role'] ?? 'author'));
    $skipOnboarding = !empty($data['skip_onboarding']);

    if ($firstName === '' || $lastName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
        jasti_json(['message' => 'First name, last name, valid email, and password with at least 8 characters are required.'], 422);
    }

    if (!in_array($status, ['active', 'inactive'], true)) {
        jasti_json(['message' => 'Invalid status value.'], 422);
    }

    if (!in_array($roleName, $allowedAccountRoles, true)) {
        jasti_json(['message' => 'Invalid role selected.'], 422);
    }

    $existing = $pdo->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
    $existing->execute(['email' => $email]);
    if ($existing->fetchColumn() !== false) {
        jasti_json(['message' => 'A user with this email already exists.'], 409);
    }

    $pdo->beginTransaction();
    try {
        $insertUser = $pdo->prepare(
            'INSERT INTO users (first_name, last_name, email, password_hash, email_verified_at, orcid_id, institution, country, phone, status)
             VALUES (:first_name, :last_name, :email, :password_hash, CURRENT_TIMESTAMP, :orcid_id, :institution, :country, :phone, :status)'
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
        jasti_assign_account_role($pdo, $targetUserId, $roleName);

        if ($roleName === 'reviewer') {
            $pdo->prepare(
                'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
                 VALUES (:reviewer_id, :expertise_area, 0.00, 0, :availability_status)'
            )->execute([
                'reviewer_id' => $targetUserId,
                'expertise_area' => trim((string) ($data['expertise_area'] ?? 'Reviewer expertise pending update')),
                'availability_status' => 'available',
            ]);

            if ($skipOnboarding) {
                // Pre-create the reviewers table record as approved and completed
                $pdo->prepare(
                    'INSERT INTO reviewers (
                        user_id, status, application_completed, first_name, last_name, email,
                        country, institution, phone, orcid_id, preferred_review_time, bio
                    ) VALUES (
                        :user_id, "approved", 1, :first_name, :last_name, :email,
                        :country, :institution, :phone, :orcid_id, "14", "Account created by Administrator."
                    )'
                )->execute([
                    'user_id' => $targetUserId,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $email,
                    'country' => $country !== '' ? $country : null,
                    'institution' => $institution !== '' ? $institution : null,
                    'phone' => $phone !== '' ? $phone : null,
                    'orcid_id' => $orcidId !== '' ? $orcidId : null,
                ]);
            }
        }

        $editorRoles = ['editor', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board', 'editor_in_chief'];
        if (in_array($roleName, $editorRoles, true)) {
            if ($skipOnboarding) {
                $etName = $roleName === 'editor' ? 'editorial_board' : $roleName;
                $et = jasti_editor_type_by_name($pdo, $etName);
                if (!$et) {
                    $et = jasti_editor_type_by_name($pdo, 'editorial_board');
                }
                if (!$et) {
                    $etList = jasti_editor_types($pdo);
                    if (!empty($etList)) {
                        $et = $etList[0];
                    }
                }
                if ($et) {
                    jasti_create_editor_profile($pdo, $targetUserId, (int) $et['editor_type_id']);
                    if (jasti_table_exists($pdo, 'editors')) {
                        $pdo->prepare(
                            'INSERT INTO editors (user_id, status, application_completed, first_name, last_name, email)
                             VALUES (:user_id, "approved", 1, :first_name, :last_name, :email)
                             ON DUPLICATE KEY UPDATE status="approved", application_completed=1'
                        )->execute([
                            'user_id' => $targetUserId,
                            'first_name' => $firstName,
                            'last_name' => $lastName,
                            'email' => $email,
                        ]);
                    }
                }
            }
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    // Send email notification to user
    $emailSent = false;
    $emailError = null;
    try {
        $subject = 'Your JASTI Account Has Been Created';
        $loginLink = jasti_frontend_url('login');
        
        $roleLabels = [
            'author' => 'Author',
            'reviewer' => 'Reviewer',
            'editor' => 'Editor',
            'managing_editor' => 'Managing Editor',
            'section_editor' => 'Section Editor',
            'technical_editor' => 'Technical Editor',
            'advisory_board' => 'Advisory Board',
            'editor_in_chief' => 'Editor-in-Chief',
            'admin' => 'Administrator',
        ];
        $roleLabel = $roleLabels[$roleName] ?? ucfirst($roleName);
        
        $htmlBody = '
        <p>Dear ' . htmlspecialchars($firstName . ' ' . $lastName, ENT_QUOTES, 'UTF-8') . ',</p>
        <p>An account has been created for you on JASTI (Journal of Applied Science, Technology, and Innovation) by the system administrator.</p>
        <p>Here are your login credentials:</p>
        <ul>
          <li><strong>Email:</strong> ' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</li>
          <li><strong>Password:</strong> ' . htmlspecialchars($password, ENT_QUOTES, 'UTF-8') . '</li>
          <li><strong>Assigned Role:</strong> ' . htmlspecialchars($roleLabel, ENT_QUOTES, 'UTF-8') . '</li>
        </ul>
        <p>You can sign in to your dashboard here: <a href="' . htmlspecialchars($loginLink, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($loginLink, ENT_QUOTES, 'UTF-8') . '</a></p>
        <p>Best regards,<br>JASTI Editorial Office</p>';

        $altBody = "Dear " . ($firstName . ' ' . $lastName) . ",\n\nAn account has been created for you on JASTI. Here are your login credentials:\n\nEmail: {$email}\nPassword: {$password}\nAssigned Role: {$roleLabel}\n\nLogin URL: {$loginLink}\n\nBest regards,\nJASTI Editorial Office";

        jasti_send_html_email($email, $subject, $htmlBody, $altBody);
        $emailSent = true;
    } catch (Throwable $exception) {
        $emailError = $exception->getMessage();
        error_log('Unable to send account creation email for ' . $email . ': ' . $emailError);
    }

    jasti_log($pdo, $userId, 'created user', 'users', $targetUserId);
    jasti_json([
        'message' => 'User created successfully.',
        'email_sent' => $emailSent,
        'email_error' => $emailError,
        'users' => jasti_users_with_roles($pdo)
    ]);
}

if (($data['action'] ?? '') === 'edit') {
    $targetUserId = (int) ($data['user_id'] ?? 0);
    if ($targetUserId <= 0) {
        jasti_json(['message' => 'Target user is required.'], 422);
    }

    $firstName = trim((string) ($data['first_name'] ?? ''));
    $lastName = trim((string) ($data['last_name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    if ($firstName === '' || $lastName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jasti_json(['message' => 'First name, last name, and valid email are required.'], 422);
    }

    $status = trim((string) ($data['status'] ?? 'active'));
    if (!in_array($status, ['active', 'inactive'], true)) {
        jasti_json(['message' => 'Invalid status value.'], 422);
    }

    $checkEmail = $pdo->prepare('SELECT user_id FROM users WHERE email = :email AND user_id <> :user_id LIMIT 1');
    $checkEmail->execute([
        'email' => $email,
        'user_id' => $targetUserId,
    ]);
    if ($checkEmail->fetchColumn() !== false) {
        jasti_json(['message' => 'Another user already uses this email.'], 409);
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

    jasti_log($pdo, $userId, 'edited user', 'users', $targetUserId);
    jasti_json(['message' => 'User edited successfully.', 'users' => jasti_users_with_roles($pdo)]);
}

if (($data['action'] ?? '') === 'delete') {
    $targetUserId = (int) ($data['user_id'] ?? 0);
    if ($targetUserId <= 0) {
        jasti_json(['message' => 'Target user is required.'], 422);
    }
    if ($targetUserId === $userId) {
        jasti_json(['message' => 'You cannot delete your own account.'], 422);
    }

    try {
        $pdo->prepare('DELETE FROM users WHERE user_id = :user_id')->execute(['user_id' => $targetUserId]);
    } catch (Throwable $exception) {
        jasti_json(['message' => 'This user cannot be deleted because related journal records still exist.'], 409);
    }

    jasti_log($pdo, $userId, 'deleted user', 'users', $targetUserId);
    jasti_json(['message' => 'User deleted successfully.', 'users' => jasti_users_with_roles($pdo)]);
}

$targetUserId = (int) ($data['user_id'] ?? 0);
if ($targetUserId <= 0) {
    jasti_json(['message' => 'Target user is required.'], 422);
}

// 1. Handle remove_role action
if (($data['action'] ?? '') === 'remove_role') {
    $roleToRemove = jasti_normalize_role((string) ($data['role'] ?? ''));
    if ($roleToRemove === '') {
        jasti_json(['message' => 'Role to remove is required.'], 422);
    }
    
    $currentRoles = jasti_user_roles($pdo, $targetUserId);
    if (count($currentRoles) <= 1 && in_array($roleToRemove, $currentRoles, true)) {
        jasti_json(['message' => 'Cannot remove the only remaining role. A user must have at least one role.'], 422);
    }

    $stmt = $pdo->prepare('SELECT role_id FROM roles WHERE LOWER(role_name) = :role_name LIMIT 1');
    $stmt->execute(['role_name' => $roleToRemove]);
    $roleId = $stmt->fetchColumn();
    if ($roleId) {
        $pdo->prepare('DELETE FROM user_roles WHERE user_id = :user_id AND role_id = :role_id')->execute([
            'user_id' => $targetUserId,
            'role_id' => (int) $roleId
        ]);
    }

    jasti_log($pdo, $userId, 'removed role ' . $roleToRemove, 'users', $targetUserId);
    jasti_json([
        'message' => 'Role removed successfully.',
        'users' => jasti_users_with_roles($pdo)
    ]);
}

// 2. Handle standard update role & status
if (array_key_exists('status', $data)) {
    $status = trim((string) $data['status']);
    if (!in_array($status, ['active', 'inactive'], true)) {
        jasti_json(['message' => 'Invalid status value.'], 422);
    }
    $pdo->prepare('UPDATE users SET status = :status WHERE user_id = :user_id')->execute([
        'status' => $status,
        'user_id' => $targetUserId,
    ]);
}

if (!empty($data['role'])) {
    $roleName = jasti_normalize_role((string) $data['role']);
    if (!in_array($roleName, $allowedAccountRoles, true)) {
        jasti_json(['message' => 'Invalid role selected.'], 422);
    }
    jasti_assign_account_role($pdo, $targetUserId, $roleName);
    
    $skipOnboarding = !empty($data['skip_onboarding']);
        // Fetch user details for profiles
    $stmt = $pdo->prepare('SELECT first_name, last_name, email, country, institution, phone, orcid_id FROM users WHERE user_id = :user_id LIMIT 1');
    $stmt->execute(['user_id' => $targetUserId]);
    $targetUser = $stmt->fetch();
    if ($targetUser) {
        $userFirstName = $targetUser['first_name'];
        $userLastName = $targetUser['last_name'];
        $userEmail = $targetUser['email'];
    } else {
        $userFirstName = 'User';
        $userLastName = 'Name';
        $userEmail = '';
    }
    
    if ($roleName === 'reviewer') {
        if ($skipOnboarding) {
            $pdo->prepare(
                'INSERT INTO reviewers (user_id, email, status, application_completed, first_name, last_name, cv_file, country, institution, phone, orcid_id, preferred_review_time, bio)
                 VALUES (:user_id, :email, "approved", 1, :first_name, :last_name, "", :country, :institution, :phone, :orcid_id, "14", "Account created by Administrator.")
                 ON DUPLICATE KEY UPDATE status = "approved", application_completed = 1'
            )->execute([
                'user_id' => $targetUserId,
                'email' => $userEmail,
                'first_name' => $userFirstName,
                'last_name' => $userLastName,
                'country' => $targetUser['country'] ?? null,
                'institution' => $targetUser['institution'] ?? null,
                'phone' => $targetUser['phone'] ?? null,
                'orcid_id' => $targetUser['orcid_id'] ?? null,
            ]);

            $pdo->prepare(
                'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
                 VALUES (:reviewer_id, :expertise_area, 0.00, 0, "available")
                 ON DUPLICATE KEY UPDATE availability_status = "available"'
            )->execute([
                'reviewer_id' => $targetUserId,
                'expertise_area' => 'Reviewer expertise pending update',
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO reviewers (user_id, email, status, application_completed, first_name, last_name, cv_file, country, institution, phone, orcid_id, preferred_review_time, bio)
                 VALUES (:user_id, :email, "pending", 0, :first_name, :last_name, "", :country, :institution, :phone, :orcid_id, "14", "Account pending onboarding.")
                 ON DUPLICATE KEY UPDATE status = "pending", application_completed = 0'
            )->execute([
                'user_id' => $targetUserId,
                'email' => $userEmail,
                'first_name' => $userFirstName,
                'last_name' => $userLastName,
                'country' => $targetUser['country'] ?? null,
                'institution' => $targetUser['institution'] ?? null,
                'phone' => $targetUser['phone'] ?? null,
                'orcid_id' => $targetUser['orcid_id'] ?? null,
            ]);

            $pdo->prepare(
                'INSERT INTO reviewer_profiles (reviewer_id, expertise_area, reviewer_rating, total_reviews, availability_status)
                 VALUES (:reviewer_id, :expertise_area, 0.00, 0, "available")
                 ON DUPLICATE KEY UPDATE availability_status = VALUES(availability_status)'
            )->execute([
                'reviewer_id' => $targetUserId,
                'expertise_area' => 'Reviewer expertise pending update',
            ]);
        }
    } else if (jasti_is_editor_workspace_role($roleName)) {
        if ($skipOnboarding) {
            $etName = $roleName === 'editor' ? 'editorial_board' : $roleName;
            $et = jasti_editor_type_by_name($pdo, $etName);
            if (!$et) {
                $et = jasti_editor_type_by_name($pdo, 'editorial_board');
            }
            if (!$et) {
                $etList = jasti_editor_types($pdo);
                if (!empty($etList)) {
                    $et = $etList[0];
                }
            }
            $editorTypeId = $et ? (int) $et['editor_type_id'] : 1;

            $pdo->prepare(
                'INSERT INTO editor_profiles (user_id, status, editor_type_id)
                 VALUES (:user_id, "active", :editor_type_id)
                 ON DUPLICATE KEY UPDATE status = "active"'
            )->execute([
                'user_id' => $targetUserId,
                'editor_type_id' => $editorTypeId,
            ]);

            $pdo->prepare(
                'INSERT INTO editors (user_id, status, application_completed, first_name, last_name, email)
                 VALUES (:user_id, "approved", 1, :first_name, :last_name, :email)
                 ON DUPLICATE KEY UPDATE status = "approved", application_completed = 1'
            )->execute([
                'user_id' => $targetUserId,
                'first_name' => $userFirstName,
                'last_name' => $userLastName,
                'email' => $userEmail,
            ]);
        }
    }
}

    jasti_log($pdo, $userId, 'updated user access', 'users', $targetUserId);
    jasti_json(['message' => 'User updated successfully.', 'users' => jasti_users_with_roles($pdo)]);
} catch (Throwable $e) {
    jasti_json([
        'message' => 'Internal server error occurred.',
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 500);
}
