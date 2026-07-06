<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);
$userId = (int) $user['user_id'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    ajasti_json(['user' => ajasti_current_user($pdo)]);
}

ajasti_require_method('POST');
$data = ajasti_request_data();
$contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');

$avatarPath = null;
if (str_starts_with($contentType, 'multipart/form-data') && isset($_FILES['avatar']) && is_array($_FILES['avatar'])) {
    $avatarPath = ajasti_store_uploaded_image($_FILES['avatar'], 'uploads/profiles', 'profile_' . $userId);
}

$password = (string) ($data['password'] ?? '');
$confirmPassword = (string) ($data['confirm_password'] ?? '');
if ($password !== '' || $confirmPassword !== '') {
    if (strlen($password) < 8) {
        ajasti_json(['message' => 'New password must be at least 8 characters.'], 422);
    }
    if ($password !== $confirmPassword) {
        ajasti_json(['message' => 'Password confirmation does not match.'], 422);
    }
}

$stmt = $pdo->prepare(
    'UPDATE users
     SET first_name = :first_name,
         last_name = :last_name,
         orcid_id = :orcid_id,
         institution = :institution,
         country = :country,
         phone = :phone,
         avatar_path = COALESCE(:avatar_path, avatar_path),
         password_hash = COALESCE(:password_hash, password_hash)
     WHERE user_id = :user_id'
);
$stmt->execute([
    'first_name' => trim((string) ($data['first_name'] ?? '')),
    'last_name' => trim((string) ($data['last_name'] ?? '')),
    'orcid_id' => trim((string) ($data['orcid_id'] ?? '')) ?: null,
    'institution' => trim((string) ($data['institution'] ?? '')) ?: null,
    'country' => trim((string) ($data['country'] ?? '')) ?: null,
    'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
    'avatar_path' => $avatarPath,
    'password_hash' => $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null,
    'user_id' => $userId,
]);

ajasti_log($pdo, $userId, 'updated profile', 'users', $userId);
ajasti_json(['message' => 'Profile updated successfully.', 'user' => ajasti_current_user($pdo)]);
