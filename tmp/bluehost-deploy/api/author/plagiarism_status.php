<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
ajasti_require_role($pdo, 'author');

ajasti_json([
    'provider' => 'manual_editor_review',
    'status' => 'pending',
    'draft_token' => null,
    'score' => null,
    'require_completion' => false,
    'top_matches' => [],
    'message' => 'Plagiarism scoring is handled manually by the editorial team after submission.',
]);
