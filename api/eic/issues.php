<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'editor_in_chief');
$userId = (int) $user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC')->fetchAll();
    jasti_json(['issues' => $issues]);
}

jasti_require_method('POST');
$data = jasti_request_data();
$action = trim((string) ($data['action'] ?? 'create'));

if ($action === 'create') {
    $journalId = (int) ($data['journal_id'] ?? jasti_first_journal_id($pdo));
    $volume = (int) ($data['volume'] ?? 0);
    $issueNumber = (int) ($data['issue_number'] ?? 0);
    $publicationYear = (int) ($data['publication_year'] ?? 0);
    $publicationDate = trim((string) ($data['publication_date'] ?? ''));
    $status = strtolower(trim((string) ($data['status'] ?? 'upcoming')));

    if ($journalId <= 0 || $volume <= 0 || $issueNumber <= 0 || $publicationYear <= 0 || $publicationDate === '') {
        jasti_json(['message' => 'Journal, volume, issue number, publication year, and publication date are required.'], 422);
    }
    if (!in_array($status, ['upcoming', 'published'], true)) {
        jasti_json(['message' => 'Invalid issue status.'], 422);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO issues (journal_id, volume, issue_number, publication_year, publication_date, status)
         VALUES (:journal_id, :volume, :issue_number, :publication_year, :publication_date, :status)'
    );
    $stmt->execute([
        'journal_id' => $journalId,
        'volume' => $volume,
        'issue_number' => $issueNumber,
        'publication_year' => $publicationYear,
        'publication_date' => $publicationDate,
        'status' => $status,
    ]);

    $issueId = (int) $pdo->lastInsertId();
    jasti_log($pdo, $userId, 'created issue', 'issues', $issueId);
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC')->fetchAll();
    jasti_json(['message' => 'Issue created successfully.', 'issues' => $issues]);
}

if ($action === 'delete') {
    $issueId = (int) ($data['issue_id'] ?? 0);
    if ($issueId <= 0) {
        jasti_json(['message' => 'Issue is required.'], 422);
    }

    $articleCheck = $pdo->prepare('SELECT COUNT(*) FROM articles WHERE issue_id = :issue_id');
    $articleCheck->execute(['issue_id' => $issueId]);
    if ((int) $articleCheck->fetchColumn() > 0) {
        jasti_json(['message' => 'This issue cannot be deleted because published articles are linked to it.'], 409);
    }

    $pdo->prepare('DELETE FROM issues WHERE issue_id = :issue_id')->execute(['issue_id' => $issueId]);
    jasti_log($pdo, $userId, 'deleted issue', 'issues', $issueId);
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC')->fetchAll();
    jasti_json(['message' => 'Issue deleted successfully.', 'issues' => $issues]);
}

if ($action === 'edit') {
    $issueId = (int) ($data['issue_id'] ?? 0);
    $status = strtolower(trim((string) ($data['status'] ?? '')));

    if ($issueId <= 0) {
        jasti_json(['message' => 'Issue is required.'], 422);
    }
    if (!in_array($status, ['upcoming', 'published'], true)) {
        jasti_json(['message' => 'Invalid issue status.'], 422);
    }

    $check = $pdo->prepare('SELECT issue_id FROM issues WHERE issue_id = :issue_id LIMIT 1');
    $check->execute(['issue_id' => $issueId]);
    if ($check->fetchColumn() === false) {
        jasti_json(['message' => 'Issue not found.'], 404);
    }

    $pdo->prepare('UPDATE issues SET status = :status WHERE issue_id = :issue_id')->execute([
        'status' => $status,
        'issue_id' => $issueId,
    ]);

    jasti_log($pdo, $userId, 'edited issue', 'issues', $issueId);
    $issues = $pdo->query('SELECT * FROM issues ORDER BY publication_year DESC, volume DESC, issue_number DESC, issue_id DESC')->fetchAll();
    jasti_json(['message' => 'Issue updated successfully.', 'issues' => $issues]);
}

jasti_json(['message' => 'Unsupported issue action.'], 422);
