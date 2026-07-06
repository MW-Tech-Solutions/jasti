<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
ajasti_bootstrap();

$pdo = ajasti_db();
$user = ajasti_require_role($pdo, 'admin');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    ajasti_json([
        'user' => $user,
        'settings' => ajasti_settings($pdo),
    ]);
}

ajasti_require_method('POST');
$data = ajasti_request_data();

$updates = [
    'journal_name' => trim((string) ($data['journal_name'] ?? '')),
    'journal_acronym' => trim((string) ($data['journal_acronym'] ?? '')),
    'homepage_tagline' => trim((string) ($data['homepage_tagline'] ?? '')),
    'homepage_intro' => trim((string) ($data['homepage_intro'] ?? '')),
    'home_topbar_text' => trim((string) ($data['home_topbar_text'] ?? '')),
    'featured_articles_title' => trim((string) ($data['featured_articles_title'] ?? '')),
    'featured_articles_description' => trim((string) ($data['featured_articles_description'] ?? '')),
    'research_pathways_title' => trim((string) ($data['research_pathways_title'] ?? '')),
    'call_for_papers_title' => trim((string) ($data['call_for_papers_title'] ?? '')),
    'call_for_papers_description' => trim((string) ($data['call_for_papers_description'] ?? '')),
    'call_for_papers_cta_title' => trim((string) ($data['call_for_papers_cta_title'] ?? '')),
    'call_for_papers_cta_body' => trim((string) ($data['call_for_papers_cta_body'] ?? '')),
    'call_for_papers_notes_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['call_for_papers_notes'] ?? null) ? (json_decode((string) $data['call_for_papers_notes'], true) ?: []) : (array) ($data['call_for_papers_notes'] ?? []))))),
    'trending_research_title' => trim((string) ($data['trending_research_title'] ?? '')),
    'trending_research_description' => trim((string) ($data['trending_research_description'] ?? '')),
    'publishing_overview_title' => trim((string) ($data['publishing_overview_title'] ?? '')),
    'publishing_overview_description' => trim((string) ($data['publishing_overview_description'] ?? '')),
    'workflow_snapshot_title' => trim((string) ($data['workflow_snapshot_title'] ?? '')),
    'workflow_snapshot_description' => trim((string) ($data['workflow_snapshot_description'] ?? '')),
    'discover_open_access_title' => trim((string) ($data['discover_open_access_title'] ?? '')),
    'discover_open_access_body' => trim((string) ($data['discover_open_access_body'] ?? '')),
    'discover_open_access_points_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['discover_open_access_points'] ?? null) ? (json_decode((string) $data['discover_open_access_points'], true) ?: []) : (array) ($data['discover_open_access_points'] ?? []))))),
    'publish_with_us_title' => trim((string) ($data['publish_with_us_title'] ?? '')),
    'publish_with_us_body' => trim((string) ($data['publish_with_us_body'] ?? '')),
    'publish_with_us_points_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['publish_with_us_points'] ?? null) ? (json_decode((string) $data['publish_with_us_points'], true) ?: []) : (array) ($data['publish_with_us_points'] ?? []))))),
    'track_research_title' => trim((string) ($data['track_research_title'] ?? '')),
    'track_research_body' => trim((string) ($data['track_research_body'] ?? '')),
    'call_for_papers_json' => json_encode(array_values(array_filter(is_string($data['call_for_papers'] ?? null) ? (json_decode((string) $data['call_for_papers'], true) ?: []) : (array) ($data['call_for_papers'] ?? []), static fn ($entry) => is_array($entry) && trim((string) ($entry['title'] ?? '')) !== '')), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    'trending_research_json' => json_encode(array_values(array_filter(is_string($data['trending_research'] ?? null) ? (json_decode((string) $data['trending_research'], true) ?: []) : (array) ($data['trending_research'] ?? []), static fn ($entry) => is_array($entry) && trim((string) ($entry['title'] ?? '')) !== '')), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    'aims_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['aims'] ?? null) ? (json_decode((string) $data['aims'], true) ?: []) : (array) ($data['aims'] ?? []))))),
    'scope_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['scope'] ?? null) ? (json_decode((string) $data['scope'], true) ?: []) : (array) ($data['scope'] ?? []))))),
    'objectives_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['objectives'] ?? null) ? (json_decode((string) $data['objectives'], true) ?: []) : (array) ($data['objectives'] ?? []))))),
    'review_specializations_json' => json_encode(array_values(array_filter(array_map('trim', is_string($data['review_specializations'] ?? null) ? (json_decode((string) $data['review_specializations'], true) ?: []) : (array) ($data['review_specializations'] ?? []))))),
    'footer_summary' => trim((string) ($data['footer_summary'] ?? '')),
    'footer_bottom_text' => trim((string) ($data['footer_bottom_text'] ?? '')),
    'footer_bottom_tagline' => trim((string) ($data['footer_bottom_tagline'] ?? '')),
];

if ($updates['journal_name'] === '' || $updates['journal_acronym'] === '') {
    ajasti_json(['message' => 'Journal name and acronym are required.'], 422);
}

foreach ([
    'discover_open_access_image' => 'discover_open_access',
    'publish_with_us_image' => 'publish_with_us',
    'track_research_image' => 'track_research',
] as $field => $prefix) {
    if (isset($_FILES[$field]) && (int) ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $updates[$field] = ajasti_store_uploaded_image($_FILES[$field], 'uploads/settings', $prefix);
    }
}

$pdo->beginTransaction();
try {
    foreach ($updates as $key => $value) {
        ajasti_upsert_setting($pdo, $key, $value);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ajasti_json(['message' => 'Unable to update system settings.', 'error' => $exception->getMessage()], 500);
}

ajasti_json([
    'message' => 'System settings updated successfully.',
    'settings' => ajasti_settings($pdo),
]);
