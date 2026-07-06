<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
$user = ajasti_require_auth($pdo);

$isAdmin = in_array('admin', $user['roles'], true);
$isEIC = in_array('editor_in_chief', $user['roles'], true);
if (!$isAdmin && !$isEIC) {
    ajasti_json(['message' => 'Unauthorized. Only admin or editor-in-chief can view reviewer applications.'], 403);
}

ajasti_ensure_onboarding_review_columns($pdo, 'reviewers');

$status = strtolower(trim((string) ($_GET['status'] ?? 'pending')));
$allowedStatuses = ['pending', 'approved', 'rejected'];
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'pending';
}

$limit = min(100, max(1, (int) ($_GET['limit'] ?? 50)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));
$completedOnly = in_array((string) ($_GET['completed_only'] ?? '1'), ['1', 'true', 'yes', 'on'], true);

$where = 'r.status = :status';
if ($completedOnly) {
    $where .= ' AND r.application_completed = 1';
}

$stmt = $pdo->prepare(
    'SELECT r.reviewer_id, r.user_id, r.first_name, r.last_name, r.email, r.country, r.institution, r.department, r.position,
            r.cv_file, r.publication_list_file, r.application_completed, r.status, r.date_registered,
            r.reviewed_at, r.reviewed_by, r.rejection_reason, r.acceptance_notes,
            CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS account_name,
            ru.first_name AS reviewer_first_name, ru.last_name AS reviewer_last_name
     FROM reviewers r
     INNER JOIN users u ON u.user_id = r.user_id
     LEFT JOIN users ru ON ru.user_id = r.reviewed_by
     WHERE ' . $where . '
     ORDER BY r.date_registered ASC
     LIMIT :limit OFFSET :offset'
);

$stmt->bindValue('status', $status, PDO::PARAM_STR);
$stmt->bindValue('limit', $limit, PDO::PARAM_INT);
$stmt->bindValue('offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM reviewers r WHERE ' . $where);
$countStmt->bindValue('status', $status, PDO::PARAM_STR);
$countStmt->execute();
$total = (int) $countStmt->fetchColumn();

ajasti_json([
    'applications' => array_map(static function (array $row): array {
        return [
            'reviewer_id' => (int) $row['reviewer_id'],
            'user_id' => (int) $row['user_id'],
            'name' => trim((string) $row['first_name'] . ' ' . (string) $row['last_name']),
            'email' => (string) $row['email'],
            'country' => $row['country'],
            'institution' => $row['institution'],
            'department' => $row['department'],
            'position' => $row['position'],
            'cv_file' => $row['cv_file'],
            'publication_list_file' => $row['publication_list_file'],
            'application_completed' => (bool) ((int) ($row['application_completed'] ?? 0)),
            'status' => (string) $row['status'],
            'date_registered' => $row['date_registered'],
            'reviewed_at' => $row['reviewed_at'] ?? null,
            'reviewed_by' => $row['reviewed_by'] ? (int) $row['reviewed_by'] : null,
            'reviewed_by_name' => $row['reviewer_first_name'] ? trim((string) $row['reviewer_first_name'] . ' ' . (string) $row['reviewer_last_name']) : null,
            'rejection_reason' => $row['rejection_reason'] ?? null,
            'acceptance_notes' => $row['acceptance_notes'] ?? null,
        ];
    }, $rows),
    'pagination' => [
        'limit' => $limit,
        'offset' => $offset,
        'total' => $total,
        'page' => (int) floor($offset / $limit) + 1,
        'pages' => (int) ceil($total / $limit),
    ],
], 200);

