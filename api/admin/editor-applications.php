<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
jasti_ensure_editor_applications($pdo);

// Check if user is admin or editor_in_chief
$isAdmin = in_array('admin', $user['roles']);
$isEIC = in_array('editor_in_chief', $user['roles']);

if (!$isAdmin && !$isEIC) {
    jasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can view applications.'], 403);
}

// Get query parameters
$limit = (int) ($_GET['limit'] ?? 50);
$offset = (int) ($_GET['offset'] ?? 0);
$status = $_GET['status'] ?? 'pending';

// Validate limit
$limit = min($limit, 100);

// Get pending applications
$stmt = $pdo->prepare(
    'SELECT ea.*, u.first_name, u.last_name, u.email, et.type_name,
            et.description AS title, et.responsibilities AS description,
            ru.first_name as reviewer_first_name, ru.last_name as reviewer_last_name
     FROM editor_applications ea
     JOIN users u ON u.user_id = ea.user_id
     JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
     LEFT JOIN users ru ON ru.user_id = ea.reviewed_by
     WHERE ea.status = :status
     ORDER BY ea.applied_at ASC
     LIMIT :limit OFFSET :offset'
);

$stmt->bindValue('status', $status, PDO::PARAM_STR);
$stmt->bindValue('limit', $limit, PDO::PARAM_INT);
$stmt->bindValue('offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$applications = $stmt->fetchAll();

// Get total count
$countStmt = $pdo->prepare('SELECT COUNT(*) as count FROM editor_applications WHERE status = :status');
$countStmt->execute(['status' => $status]);
$totalResult = $countStmt->fetch();
$totalCount = (int) ($totalResult['count'] ?? 0);

jasti_json([
    'applications' => array_map(function($app) {
        return [
            'application_id' => (int) $app['application_id'],
            'user_id' => (int) $app['user_id'],
            'applicant_name' => $app['first_name'] . ' ' . $app['last_name'],
            'applicant_email' => $app['email'],
            'editor_type' => $app['type_name'],
            'editor_title' => $app['title'],
            'status' => $app['status'],
            'subject_areas' => $app['subject_areas'],
            'expertise_description' => $app['expertise_description'],
            'bio' => $app['bio'],
            'cv_file_path' => $app['cv_file_path'],
            'cv_original_filename' => $app['cv_original_filename'],
            'applied_at' => $app['applied_at'],
            'reviewed_at' => $app['reviewed_at'],
            'reviewed_by_name' => $app['reviewer_first_name'] ? $app['reviewer_first_name'] . ' ' . $app['reviewer_last_name'] : null,
            'rejection_reason' => $app['rejection_reason'],
            'acceptance_notes' => $app['acceptance_notes'],
        ];
    }, $applications),
    'pagination' => [
        'limit' => $limit,
        'offset' => $offset,
        'total' => $totalCount,
        'page' => (int) floor($offset / $limit) + 1,
        'pages' => (int) ceil($totalCount / $limit),
    ],
], 200);
