<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();

// Ensure editor types exist
jasti_ensure_editor_types($pdo);

// Get all editor types
$types = jasti_editor_types($pdo);

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

jasti_json([
    'editor_types' => $formattedTypes,
    'total' => count($formattedTypes),
]);
