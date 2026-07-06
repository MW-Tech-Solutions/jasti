<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();

// Ensure editor types exist
ajasti_ensure_editor_types($pdo);

// Get all editor types
$types = ajasti_editor_types($pdo);

$formattedTypes = array_map(function ($type) {
    return [
        'editor_type_id' => (int) $type['editor_type_id'],
        'type_name' => $type['type_name'],
        'title' => $type['description'],
        'description' => $type['responsibilities'],
        'access_level' => (int) $type['access_level'],
        'capabilities' => [
            'can_assign_reviewers' => (bool) $type['can_assign_reviewers'],
            'can_make_decisions' => (bool) $type['can_make_decisions'],
            'can_appoint_editors' => (bool) $type['can_appoint_editors'],
        ],
    ];
}, $types);

ajasti_json([
    'editor_types' => $formattedTypes,
    'total' => count($formattedTypes),
]);
