<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
ajasti_bootstrap();
ajasti_require_method('GET');

$pdo = ajasti_db();
$settings = ajasti_settings($pdo);

ajasti_json([
    'settings' => [
        'journal_name' => $settings['journal_name'],
        'journal_acronym' => $settings['journal_acronym'],
        'logo_path' => $settings['logo_path'],
        'homepage_tagline' => $settings['homepage_tagline'],
        'homepage_intro' => $settings['homepage_intro'],
        'home_topbar_text' => $settings['home_topbar_text'],
        'featured_articles_title' => $settings['featured_articles_title'],
        'featured_articles_description' => $settings['featured_articles_description'],
        'research_pathways_title' => $settings['research_pathways_title'],
        'call_for_papers_title' => $settings['call_for_papers_title'],
        'call_for_papers_description' => $settings['call_for_papers_description'],
        'call_for_papers_cta_title' => $settings['call_for_papers_cta_title'],
        'call_for_papers_cta_body' => $settings['call_for_papers_cta_body'],
        'call_for_papers_notes' => json_decode($settings['call_for_papers_notes_json'], true) ?: [],
        'trending_research_title' => $settings['trending_research_title'],
        'trending_research_description' => $settings['trending_research_description'],
        'publishing_overview_title' => $settings['publishing_overview_title'],
        'publishing_overview_description' => $settings['publishing_overview_description'],
        'workflow_snapshot_title' => $settings['workflow_snapshot_title'],
        'workflow_snapshot_description' => $settings['workflow_snapshot_description'],
        'discover_open_access_title' => $settings['discover_open_access_title'],
        'discover_open_access_body' => $settings['discover_open_access_body'],
        'discover_open_access_image' => $settings['discover_open_access_image'],
        'discover_open_access_points' => json_decode($settings['discover_open_access_points_json'], true) ?: [],
        'publish_with_us_title' => $settings['publish_with_us_title'],
        'publish_with_us_body' => $settings['publish_with_us_body'],
        'publish_with_us_image' => $settings['publish_with_us_image'],
        'publish_with_us_points' => json_decode($settings['publish_with_us_points_json'], true) ?: [],
        'track_research_title' => $settings['track_research_title'],
        'track_research_body' => $settings['track_research_body'],
        'track_research_image' => $settings['track_research_image'],
        'call_for_papers' => json_decode($settings['call_for_papers_json'], true) ?: [],
        'trending_research' => json_decode($settings['trending_research_json'], true) ?: [],
        'aims' => json_decode($settings['aims_json'], true) ?: [],
        'scope' => json_decode($settings['scope_json'], true) ?: [],
        'objectives' => json_decode($settings['objectives_json'], true) ?: [],
        'review_specializations' => json_decode($settings['review_specializations_json'], true) ?: [],
        'footer_summary' => $settings['footer_summary'],
        'footer_bottom_text' => $settings['footer_bottom_text'],
        'footer_bottom_tagline' => $settings['footer_bottom_tagline'],
    ],
]);
