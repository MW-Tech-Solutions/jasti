<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();

function campaign_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :name'
    );
    $stmt->execute(['name' => $table]);
    return ((int) $stmt->fetchColumn()) > 0;
}

$required = [
    'campaign_site',
    'campaign_social_links',
    'campaign_nav_links',
    'campaign_media',
    'campaign_hero_slides',
    'campaign_priorities',
    'campaign_message',
    'campaign_press_release',
    'campaign_statement',
    'campaign_get_involved',
    'campaign_get_involved_points',
    'campaign_mission',
    'campaign_mission_items',
    'campaign_engagements',
    'campaign_updates',
];

foreach ($required as $table) {
    if (!campaign_table_exists($pdo, $table)) {
        jasti_json([
            'message' => 'Campaign CMS tables are not available yet. Run the campaign migration SQL first.',
            'missing_table' => $table,
        ], 503);
    }
}

$site = $pdo->query('SELECT * FROM campaign_site WHERE site_id = 1 LIMIT 1')->fetch() ?: null;
$social = $pdo->query('SELECT social_id, platform, url, display_order, is_active FROM campaign_social_links ORDER BY display_order ASC, social_id ASC')->fetchAll();
$nav = $pdo->query('SELECT nav_id, label, anchor, display_order, is_active FROM campaign_nav_links ORDER BY display_order ASC, nav_id ASC')->fetchAll();

$slides = $pdo->query(
    'SELECT slide_id, headline, subheadline, body, cta_label, cta_anchor, background_media_id, display_order, is_active
     FROM campaign_hero_slides
     WHERE is_active = 1
     ORDER BY display_order ASC, slide_id ASC'
)->fetchAll();

$priorities = $pdo->query(
    'SELECT priority_id, title, body, link_anchor, display_order, is_active
     FROM campaign_priorities
     WHERE is_active = 1
     ORDER BY display_order ASC, priority_id ASC'
)->fetchAll();

$message = $pdo->query('SELECT message_id, title, body, signature, portrait_media_id FROM campaign_message WHERE message_id = 1 LIMIT 1')->fetch() ?: null;

$pressReleases = $pdo->query(
    'SELECT press_id, title, date_published, body, media_id, display_order, is_active
     FROM campaign_press_release
     WHERE is_active = 1
     ORDER BY display_order ASC, press_id ASC'
)->fetchAll();

$statements = $pdo->query(
    'SELECT statement_id, title, body, media_id, display_order, is_active
     FROM campaign_statement
     WHERE is_active = 1
     ORDER BY display_order ASC, statement_id ASC'
)->fetchAll();

$getInvolved = $pdo->query('SELECT involved_id, eyebrow, title, body, image_media_id FROM campaign_get_involved WHERE involved_id = 1 LIMIT 1')->fetch() ?: null;
$getInvolvedPoints = $pdo->query(
    'SELECT point_id, involved_id, point_text, display_order
     FROM campaign_get_involved_points
     WHERE involved_id = 1
     ORDER BY display_order ASC, point_id ASC'
)->fetchAll();

$mission = $pdo->query('SELECT mission_id, title, subtitle FROM campaign_mission WHERE mission_id = 1 LIMIT 1')->fetch() ?: null;
$missionItems = $pdo->query(
    'SELECT item_id, mission_id, title, body, media_id, display_order
     FROM campaign_mission_items
     WHERE mission_id = 1
     ORDER BY display_order ASC, item_id ASC'
)->fetchAll();

$engagements = $pdo->query(
    'SELECT engagement_id, title, location, date_label, time_label, media_id, display_order, is_active
     FROM campaign_engagements
     WHERE is_active = 1
     ORDER BY display_order ASC, engagement_id ASC'
)->fetchAll();

$updates = $pdo->query(
    'SELECT update_id, badge_top, badge_bottom, title, excerpt, link_anchor, media_id, display_order, is_active
     FROM campaign_updates
     WHERE is_active = 1
     ORDER BY display_order ASC, update_id ASC'
)->fetchAll();

jasti_json([
    'site' => $site,
    'social_links' => $social,
    'nav_links' => $nav,
    'hero_slides' => $slides,
    'priorities' => $priorities,
    'message' => $message,
    'press_releases' => $pressReleases,
    'statements' => $statements,
    'get_involved' => $getInvolved,
    'get_involved_points' => $getInvolvedPoints,
    'mission' => $mission,
    'mission_items' => $missionItems,
    'engagements' => $engagements,
    'updates' => $updates,
]);
