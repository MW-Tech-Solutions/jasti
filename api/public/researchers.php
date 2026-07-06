<?php
declare(strict_types=1);

require_once __DIR__ . '/../support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

function researcher_slugify(string $value): string
{
    $normalized = strtolower(trim($value));
    $normalized = preg_replace('/[^a-z0-9]+/i', '-', $normalized) ?? '';
    return trim($normalized, '-') ?: 'researcher';
}

function researcher_format_tag(string $value): string
{
    $normalized = trim(preg_replace('/\s+/u', ' ', str_replace(['_', ';'], ' ', $value)) ?? '');
    if ($normalized === '') {
        return '';
    }

    if (preg_match('/^[A-Z0-9 -]{2,8}$/', $normalized) === 1) {
        return $normalized;
    }

    return ucwords(strtolower($normalized));
}

function researcher_keywords(string $value): array
{
    if (trim($value) === '') {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn (string $tag): string => researcher_format_tag($tag),
        preg_split('/[,|]/', $value) ?: []
    )));
}

function researcher_h_index(array $citations): int
{
    rsort($citations, SORT_NUMERIC);
    $hIndex = 0;

    foreach ($citations as $index => $citationCount) {
        $rank = $index + 1;
        if ((int) $citationCount >= $rank) {
            $hIndex = $rank;
            continue;
        }

        break;
    }

    return $hIndex;
}

function researcher_profile_label(int $publicationCount, int $hIndex): string
{
    if ($publicationCount >= 10 || $hIndex >= 8) {
        return 'Established Researcher';
    }

    if ($publicationCount >= 5 || $hIndex >= 4) {
        return 'Active Researcher';
    }

    return 'Published Researcher';
}

function researcher_top_label(array $counts, string $fallback): string
{
    if ($counts === []) {
        return $fallback;
    }

    arsort($counts, SORT_NUMERIC);
    $label = array_key_first($counts);

    return is_string($label) && trim($label) !== '' ? $label : $fallback;
}

function researcher_top_labels(array $counts, int $limit = 5): array
{
    if ($counts === []) {
        return [];
    }

    arsort($counts, SORT_NUMERIC);
    return array_slice(array_keys($counts), 0, $limit);
}

$pdo = jasti_db();
jasti_ensure_manuscript_author_schema($pdo);

try {
    $stmt = $pdo->query(
        'SELECT
            COALESCE(ma.author_id, 0) AS author_id,
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, ""))), ""),
                NULLIF(TRIM(COALESCE(ma.author_name, "")), ""),
                NULLIF(TRIM(COALESCE(ma.author_email, "")), "")
            ) AS author_name,
            LOWER(TRIM(COALESCE(NULLIF(ma.author_email, ""), COALESCE(u.email, "")))) AS author_email,
            COALESCE(NULLIF(TRIM(ma.affiliation), ""), NULLIF(TRIM(COALESCE(u.institution, "")), "")) AS affiliation,
            NULLIF(TRIM(COALESCE(u.country, "")), "") AS country,
            NULLIF(TRIM(COALESCE(u.orcid_id, "")), "") AS orcid_id,
            NULLIF(TRIM(COALESCE(u.avatar_path, "")), "") AS avatar_path,
            a.article_id,
            a.manuscript_id,
            a.publication_date,
            m.title,
            m.abstract,
            m.article_type,
            m.keywords,
            COALESCE(j.journal_name, "JASTI") AS journal_name,
            COALESCE(am.views, 0) AS views,
            COALESCE(am.downloads, 0) AS downloads,
            COALESCE(am.citations, 0) AS citations
         FROM articles a
         INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
         INNER JOIN manuscript_authors ma ON ma.manuscript_id = m.manuscript_id
         LEFT JOIN users u ON u.user_id = ma.author_id
         LEFT JOIN issues i ON i.issue_id = a.issue_id
         LEFT JOIN journals j ON j.journal_id = i.journal_id OR j.journal_id = m.journal_id
         LEFT JOIN (
             SELECT article_id,
                    SUM(COALESCE(views, 0)) AS views,
                    SUM(COALESCE(downloads, 0)) AS downloads,
                    SUM(COALESCE(citations, 0)) AS citations
             FROM article_metrics
             GROUP BY article_id
         ) am ON am.article_id = a.article_id
         WHERE m.status = "published"
         ORDER BY a.publication_date DESC, a.article_id DESC, ma.author_order ASC'
    );
    $rows = $stmt->fetchAll();
} catch (Throwable $exception) {
    jasti_json([
        'researchers' => [],
        'message' => 'Researcher directory data is not available yet.',
    ]);
}

$researchers = [];

foreach ($rows as $row) {
    $name = trim((string) ($row['author_name'] ?? ''));
    if ($name === '') {
        continue;
    }

    $authorId = (int) ($row['author_id'] ?? 0);
    $email = strtolower(trim((string) ($row['author_email'] ?? '')));
    $affiliation = trim((string) ($row['affiliation'] ?? ''));
    $country = trim((string) ($row['country'] ?? ''));
    $key = $authorId > 0
        ? 'user:' . $authorId
        : ($email !== '' ? 'email:' . $email : 'name:' . strtolower($name . '|' . $affiliation));

    if (!isset($researchers[$key])) {
        $researchers[$key] = [
            'name' => $name,
            'author_id' => $authorId > 0 ? $authorId : null,
            'orcid_id' => trim((string) ($row['orcid_id'] ?? '')),
            'avatar_path' => trim((string) ($row['avatar_path'] ?? '')),
            'institution_counts' => [],
            'country_counts' => [],
            'tag_counts' => [],
            'publication_index' => [],
            'publications' => [],
            'views' => 0,
            'downloads' => 0,
            'citations' => 0,
        ];
    }

    if ($affiliation !== '') {
        $researchers[$key]['institution_counts'][$affiliation] = ($researchers[$key]['institution_counts'][$affiliation] ?? 0) + 1;
    }
    if ($country !== '') {
        $researchers[$key]['country_counts'][$country] = ($researchers[$key]['country_counts'][$country] ?? 0) + 1;
    }

    $articleId = (int) ($row['article_id'] ?? 0);
    if ($articleId <= 0 || isset($researchers[$key]['publication_index'][$articleId])) {
        continue;
    }

    $articleType = trim((string) ($row['article_type'] ?? ''));
    $keywords = researcher_keywords((string) ($row['keywords'] ?? ''));
    $tagPool = $keywords;
    if ($tagPool === [] && $articleType !== '') {
        $tagPool[] = researcher_format_tag($articleType);
    }

    foreach ($tagPool as $tag) {
        if ($tag === '') {
            continue;
        }
        $researchers[$key]['tag_counts'][$tag] = ($researchers[$key]['tag_counts'][$tag] ?? 0) + 1;
    }

    $publication = [
        'article_id' => $articleId,
        'manuscript_id' => (int) ($row['manuscript_id'] ?? 0),
        'title' => trim((string) ($row['title'] ?? '')),
        'abstract' => trim((string) ($row['abstract'] ?? '')),
        'article_type' => $articleType,
        'publication_date' => trim((string) ($row['publication_date'] ?? '')),
        'journal_name' => trim((string) ($row['journal_name'] ?? '')),
        'keywords' => $keywords,
        'views' => (int) ($row['views'] ?? 0),
        'downloads' => (int) ($row['downloads'] ?? 0),
        'citations' => (int) ($row['citations'] ?? 0),
    ];

    $researchers[$key]['publication_index'][$articleId] = true;
    $researchers[$key]['publications'][] = $publication;
    $researchers[$key]['views'] += $publication['views'];
    $researchers[$key]['downloads'] += $publication['downloads'];
    $researchers[$key]['citations'] += $publication['citations'];
}

$payload = [];

foreach ($researchers as $key => $researcher) {
    $publications = $researcher['publications'];
    if ($publications === []) {
        continue;
    }

    usort(
        $publications,
        static fn (array $left, array $right): int =>
            strcmp((string) ($right['publication_date'] ?? ''), (string) ($left['publication_date'] ?? ''))
            ?: ((int) ($right['article_id'] ?? 0) <=> (int) ($left['article_id'] ?? 0))
    );

    $publicationCount = count($publications);
    $hIndex = researcher_h_index(array_map(static fn (array $publication): int => (int) ($publication['citations'] ?? 0), $publications));
    $slugSuffix = substr(md5($key), 0, 6);
    $expertiseTags = researcher_top_labels($researcher['tag_counts'], 6);

    $payload[] = [
        'researcher_key' => substr(md5($key), 0, 12),
        'slug' => researcher_slugify((string) $researcher['name']) . '-' . $slugSuffix,
        'name' => (string) $researcher['name'],
        'profile_label' => researcher_profile_label($publicationCount, $hIndex),
        'institution' => researcher_top_label($researcher['institution_counts'], 'Independent Researcher'),
        'country' => researcher_top_label($researcher['country_counts'], ''),
        'orcid_id' => $researcher['orcid_id'] !== '' ? $researcher['orcid_id'] : null,
        'avatar_path' => $researcher['avatar_path'] !== '' ? $researcher['avatar_path'] : null,
        'primary_field' => $expertiseTags[0] ?? 'Interdisciplinary Research',
        'expertise_tags' => $expertiseTags,
        'publication_count' => $publicationCount,
        'views' => (int) $researcher['views'],
        'downloads' => (int) $researcher['downloads'],
        'citations' => (int) $researcher['citations'],
        'h_index' => $hIndex,
        'latest_publication_date' => (string) ($publications[0]['publication_date'] ?? ''),
        'publications' => $publications,
    ];
}

usort(
    $payload,
    static fn (array $left, array $right): int =>
        strcasecmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''))
);

jasti_json([
    'researchers' => $payload,
]);
