<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();

$pdo = jasti_db();
$user = jasti_require_role($pdo, 'admin');

function campaign_admin_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare('SHOW TABLES LIKE :name');
    $stmt->execute(['name' => $table]);
    return (bool) $stmt->fetchColumn();
}

if (!campaign_admin_table_exists($pdo, 'campaign_site') || !campaign_admin_table_exists($pdo, 'campaign_media')) {
    jasti_json(['message' => 'Campaign CMS tables are not available yet. Run the campaign migration SQL first.'], 503);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $site = $pdo->query('SELECT * FROM campaign_site WHERE site_id = 1 LIMIT 1')->fetch() ?: null;
    $social = $pdo->query('SELECT social_id, platform, url, display_order, is_active FROM campaign_social_links ORDER BY display_order ASC, social_id ASC')->fetchAll();
    $nav = $pdo->query('SELECT nav_id, label, anchor, display_order, is_active FROM campaign_nav_links ORDER BY display_order ASC, nav_id ASC')->fetchAll();
    $slides = $pdo->query('SELECT slide_id, headline, subheadline, body, cta_label, cta_anchor, background_media_id, display_order, is_active FROM campaign_hero_slides ORDER BY display_order ASC, slide_id ASC')->fetchAll();
    $priorities = $pdo->query('SELECT priority_id, title, body, link_anchor, display_order, is_active FROM campaign_priorities ORDER BY display_order ASC, priority_id ASC')->fetchAll();
    $message = $pdo->query('SELECT message_id, title, body, signature, portrait_media_id FROM campaign_message WHERE message_id = 1 LIMIT 1')->fetch() ?: null;
    $pressReleases = $pdo->query('SELECT press_id, title, date_published, body, media_id, display_order, is_active FROM campaign_press_release ORDER BY display_order ASC, press_id ASC')->fetchAll();
    $statements = $pdo->query('SELECT statement_id, title, body, media_id, display_order, is_active FROM campaign_statement ORDER BY display_order ASC, statement_id ASC')->fetchAll();
    $getInvolved = $pdo->query('SELECT involved_id, eyebrow, title, body, image_media_id FROM campaign_get_involved WHERE involved_id = 1 LIMIT 1')->fetch() ?: null;
    $getInvolvedPoints = $pdo->query('SELECT point_id, involved_id, point_text, display_order FROM campaign_get_involved_points WHERE involved_id = 1 ORDER BY display_order ASC, point_id ASC')->fetchAll();
    $mission = $pdo->query('SELECT mission_id, title, subtitle FROM campaign_mission WHERE mission_id = 1 LIMIT 1')->fetch() ?: null;
    $missionItems = $pdo->query('SELECT item_id, mission_id, title, body, media_id, display_order FROM campaign_mission_items WHERE mission_id = 1 ORDER BY display_order ASC, item_id ASC')->fetchAll();
    $engagements = $pdo->query('SELECT engagement_id, title, location, date_label, time_label, media_id, display_order, is_active FROM campaign_engagements ORDER BY display_order ASC, engagement_id ASC')->fetchAll();
    $updates = $pdo->query('SELECT update_id, badge_top, badge_bottom, title, excerpt, link_anchor, media_id, display_order, is_active FROM campaign_updates ORDER BY display_order ASC, update_id ASC')->fetchAll();
    $media = $pdo->query('SELECT media_id, media_type, filename, original_name, mime_type, byte_size, alt_text, created_at FROM campaign_media ORDER BY created_at DESC, media_id DESC')->fetchAll();

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
        'media' => $media,
    ]);
}

jasti_require_method('POST');
$body = jasti_body();
$action = trim((string) ($body['action'] ?? ''));

if ($action === '') {
    jasti_json(['message' => 'Action is required.'], 422);
}

$pdo->beginTransaction();
try {
    if ($action === 'upsert_site') {
        $payload = is_array($body['site'] ?? null) ? $body['site'] : [];
        $stmt = $pdo->prepare(
            'INSERT INTO campaign_site
             (site_id, site_title, meta_description, constituency, state, country, address_line, media_team, notice_text, newsletter_title, newsletter_text, copyright_text)
             VALUES (1, :site_title, :meta_description, :constituency, :state, :country, :address_line, :media_team, :notice_text, :newsletter_title, :newsletter_text, :copyright_text)
             ON DUPLICATE KEY UPDATE
               site_title = VALUES(site_title),
               meta_description = VALUES(meta_description),
               constituency = VALUES(constituency),
               state = VALUES(state),
               country = VALUES(country),
               address_line = VALUES(address_line),
               media_team = VALUES(media_team),
               notice_text = VALUES(notice_text),
               newsletter_title = VALUES(newsletter_title),
               newsletter_text = VALUES(newsletter_text),
               copyright_text = VALUES(copyright_text)'
        );
        $stmt->execute([
            'site_title' => (string) ($payload['site_title'] ?? ''),
            'meta_description' => (string) ($payload['meta_description'] ?? ''),
            'constituency' => (string) ($payload['constituency'] ?? ''),
            'state' => (string) ($payload['state'] ?? ''),
            'country' => (string) ($payload['country'] ?? ''),
            'address_line' => (string) ($payload['address_line'] ?? ''),
            'media_team' => (string) ($payload['media_team'] ?? ''),
            'notice_text' => (string) ($payload['notice_text'] ?? ''),
            'newsletter_title' => (string) ($payload['newsletter_title'] ?? ''),
            'newsletter_text' => (string) ($payload['newsletter_text'] ?? ''),
            'copyright_text' => (string) ($payload['copyright_text'] ?? ''),
        ]);
    } elseif ($action === 'set_social_links') {
        $items = is_array($body['social_links'] ?? null) ? $body['social_links'] : [];
        $pdo->exec('DELETE FROM campaign_social_links');
        $stmt = $pdo->prepare('INSERT INTO campaign_social_links (platform, url, display_order, is_active) VALUES (:platform, :url, :display_order, :is_active)');
        foreach ($items as $idx => $item) {
            if (!is_array($item)) continue;
            $stmt->execute([
                'platform' => (string) ($item['platform'] ?? ''),
                'url' => (string) ($item['url'] ?? '#'),
                'display_order' => (int) ($item['display_order'] ?? ($idx + 1)),
                'is_active' => !empty($item['is_active']) ? 1 : 0,
            ]);
        }
    } elseif ($action === 'set_nav_links') {
        $items = is_array($body['nav_links'] ?? null) ? $body['nav_links'] : [];
        $pdo->exec('DELETE FROM campaign_nav_links');
        $stmt = $pdo->prepare('INSERT INTO campaign_nav_links (label, anchor, display_order, is_active) VALUES (:label, :anchor, :display_order, :is_active)');
        foreach ($items as $idx => $item) {
            if (!is_array($item)) continue;
            $stmt->execute([
                'label' => (string) ($item['label'] ?? ''),
                'anchor' => (string) ($item['anchor'] ?? '#top'),
                'display_order' => (int) ($item['display_order'] ?? ($idx + 1)),
                'is_active' => !empty($item['is_active']) ? 1 : 0,
            ]);
        }
    } elseif ($action === 'save_collection') {
        $collection = (string) ($body['collection'] ?? '');
        $items = is_array($body['items'] ?? null) ? $body['items'] : [];

        $allowed = [
            'hero_slides',
            'priorities',
            'press_releases',
            'statements',
            'engagements',
            'updates',
            'mission_items',
            'get_involved_points',
        ];
        if (!in_array($collection, $allowed, true)) {
            jasti_json(['message' => 'Unsupported collection.'], 422);
        }

        $map = [
            'hero_slides' => ['table' => 'campaign_hero_slides', 'pk' => 'slide_id', 'cols' => ['headline','subheadline','body','cta_label','cta_anchor','background_media_id','display_order','is_active']],
            'priorities' => ['table' => 'campaign_priorities', 'pk' => 'priority_id', 'cols' => ['title','body','link_anchor','display_order','is_active']],
            'press_releases' => ['table' => 'campaign_press_release', 'pk' => 'press_id', 'cols' => ['title','date_published','body','media_id','display_order','is_active']],
            'statements' => ['table' => 'campaign_statement', 'pk' => 'statement_id', 'cols' => ['title','body','media_id','display_order','is_active']],
            'engagements' => ['table' => 'campaign_engagements', 'pk' => 'engagement_id', 'cols' => ['title','location','date_label','time_label','media_id','display_order','is_active']],
            'updates' => ['table' => 'campaign_updates', 'pk' => 'update_id', 'cols' => ['badge_top','badge_bottom','title','excerpt','link_anchor','media_id','display_order','is_active']],
            'mission_items' => ['table' => 'campaign_mission_items', 'pk' => 'item_id', 'cols' => ['mission_id','title','body','media_id','display_order']],
            'get_involved_points' => ['table' => 'campaign_get_involved_points', 'pk' => 'point_id', 'cols' => ['involved_id','point_text','display_order']],
        ];

        $meta = $map[$collection];
        $table = $meta['table'];
        $pk = $meta['pk'];
        $cols = $meta['cols'];

        $existingIds = $pdo->query("SELECT {$pk} FROM {$table}")->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $keepIds = [];

        foreach ($items as $idx => $item) {
            if (!is_array($item)) continue;
            $id = isset($item[$pk]) ? (int) $item[$pk] : 0;
            $values = [];
            foreach ($cols as $col) {
                $values[$col] = $item[$col] ?? null;
            }
            if (in_array($collection, ['mission_items','get_involved_points'], true)) {
                if ($collection === 'mission_items') $values['mission_id'] = 1;
                if ($collection === 'get_involved_points') $values['involved_id'] = 1;
            }
            if (isset($values['display_order']) && ($values['display_order'] === null || $values['display_order'] === '')) {
                $values['display_order'] = $idx + 1;
            }

            if ($id > 0) {
                $set = [];
                foreach ($cols as $col) {
                    $set[] = "{$col} = :{$col}";
                }
                $values[$pk] = $id;
                $sql = "UPDATE {$table} SET " . implode(', ', $set) . " WHERE {$pk} = :{$pk}";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                $keepIds[] = $id;
            } else {
                $columns = implode(', ', $cols);
                $placeholders = implode(', ', array_map(static fn ($c) => ':' . $c, $cols));
                $sql = "INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                $keepIds[] = (int) $pdo->lastInsertId();
            }
        }

        // delete removed rows for mutable collections (not mission/get points are also mutable)
        $keepIds = array_values(array_filter(array_map('intval', $keepIds)));
        if ($keepIds !== []) {
            $in = implode(',', array_fill(0, count($keepIds), '?'));
            $del = $pdo->prepare("DELETE FROM {$table} WHERE {$pk} NOT IN ({$in})");
            $del->execute($keepIds);
        } else {
            $pdo->exec("DELETE FROM {$table}");
        }
    } elseif ($action === 'upsert_message') {
        $payload = is_array($body['message'] ?? null) ? $body['message'] : [];
        $stmt = $pdo->prepare(
            'INSERT INTO campaign_message (message_id, title, body, signature, portrait_media_id)
             VALUES (1, :title, :body, :signature, :portrait_media_id)
             ON DUPLICATE KEY UPDATE title=VALUES(title), body=VALUES(body), signature=VALUES(signature), portrait_media_id=VALUES(portrait_media_id)'
        );
        $stmt->execute([
            'title' => (string) ($payload['title'] ?? ''),
            'body' => (string) ($payload['body'] ?? ''),
            'signature' => (string) ($payload['signature'] ?? ''),
            'portrait_media_id' => isset($payload['portrait_media_id']) ? (int) $payload['portrait_media_id'] : null,
        ]);
    } elseif ($action === 'upsert_get_involved') {
        $payload = is_array($body['get_involved'] ?? null) ? $body['get_involved'] : [];
        $stmt = $pdo->prepare(
            'INSERT INTO campaign_get_involved (involved_id, eyebrow, title, body, image_media_id)
             VALUES (1, :eyebrow, :title, :body, :image_media_id)
             ON DUPLICATE KEY UPDATE eyebrow=VALUES(eyebrow), title=VALUES(title), body=VALUES(body), image_media_id=VALUES(image_media_id)'
        );
        $stmt->execute([
            'eyebrow' => (string) ($payload['eyebrow'] ?? ''),
            'title' => (string) ($payload['title'] ?? ''),
            'body' => (string) ($payload['body'] ?? ''),
            'image_media_id' => isset($payload['image_media_id']) ? (int) $payload['image_media_id'] : null,
        ]);
    } elseif ($action === 'upsert_mission') {
        $payload = is_array($body['mission'] ?? null) ? $body['mission'] : [];
        $stmt = $pdo->prepare(
            'INSERT INTO campaign_mission (mission_id, title, subtitle)
             VALUES (1, :title, :subtitle)
             ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle)'
        );
        $stmt->execute([
            'title' => (string) ($payload['title'] ?? ''),
            'subtitle' => (string) ($payload['subtitle'] ?? ''),
        ]);
    } else {
        jasti_json(['message' => 'Unsupported action.'], 422);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

jasti_json(['message' => 'Saved.']);

