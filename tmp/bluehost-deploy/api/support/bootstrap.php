<?php
declare(strict_types=1);

date_default_timezone_set('Africa/Lagos');

function ajasti_is_local_environment(): bool
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return str_contains($host, 'localhost') || str_contains($host, '127.0.0.1');
}

function ajasti_config(): array
{
    static $config = null;
    if ($config === null) {
        $configPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
        $config = is_file($configPath) ? require $configPath : [];
        if (!is_array($config)) {
            $config = [];
        }
        
        // Override for local development
        if (ajasti_is_local_environment()) {
            $config['DB_HOST'] = 'localhost';
            $config['DB_NAME'] = 'ajasti_jms';
            $config['DB_USER'] = 'root';
            $config['DB_PASS'] = '';
            $config['APP_DEBUG'] = true;
        }
    }
    return $config;
}

function ajasti_root_path(string $path = ''): string
{
    $root = dirname(__DIR__, 2);
    return $path === '' ? $root : $root . DIRECTORY_SEPARATOR . ltrim($path, DIRECTORY_SEPARATOR);
}

function ajasti_env(string $key, ?string $default = null): ?string
{
    $config = ajasti_config();
    if (array_key_exists($key, $config) && $config[$key] !== '' && $config[$key] !== null) {
        return is_bool($config[$key]) ? ($config[$key] ? '1' : '0') : (string) $config[$key];
    }
    return $default;
}

function ajasti_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) === '443');
}

function ajasti_debug_enabled(): bool
{
    $value = strtolower((string) ajasti_env('APP_DEBUG', '0'));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function ajasti_handle_throwable(Throwable $exception): void
{
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }

    $payload = ['message' => 'Server error.'];
    if (ajasti_debug_enabled()) {
        $payload['error'] = $exception->getMessage();
        $payload['file'] = $exception->getFile();
        $payload['line'] = $exception->getLine();
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ajasti_handle_shutdown(): void
{
    $error = error_get_last();
    if ($error === null) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($error['type'] ?? 0, $fatalTypes, true)) {
        return;
    }

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }

    $payload = ['message' => 'Fatal server error.'];
    if (ajasti_debug_enabled()) {
        $payload['error'] = $error['message'] ?? 'Unknown fatal error';
        $payload['file'] = $error['file'] ?? null;
        $payload['line'] = $error['line'] ?? null;
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function ajasti_allowed_origins(): array
{
    $config = ajasti_config();
    $configuredOrigins = $config['ALLOWED_ORIGINS'] ?? '';
    
    $origins = [];
    if (is_array($configuredOrigins)) {
        // If ALLOWED_ORIGINS is already an array in config.php
        $origins = array_filter(array_map(
            static fn ($origin): string => rtrim(trim((string) $origin), '/'),
            $configuredOrigins
        ));
    } elseif (is_string($configuredOrigins)) {
        // If ALLOWED_ORIGINS is a comma-separated string
        $origins = array_filter(array_map(
            static fn (string $origin): string => rtrim(trim($origin), '/'),
            explode(',', $configuredOrigins)
        ));
    }

    $defaults = [];
    
    // Always allow development origins
    if (ajasti_is_local_environment()) {
        $defaults = [
            'http://localhost',
            'http://127.0.0.1',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ];
    }
    
    // Add configured production origins
    if ($origins !== []) {
        $defaults = array_merge($defaults, $origins);
    }

    // Add frontend URL if configured
    $frontend = rtrim((string) ajasti_env('FRONTEND_APP_URL', ''), '/');
    if ($frontend !== '') {
        $defaults[] = $frontend;
    }

    return array_values(array_unique($defaults));
}

function ajasti_origin_allowed(string $origin): bool
{
    $origin = rtrim(trim($origin), '/');
    if ($origin === '') {
        return false;
    }

    $allowedOrigins = ajasti_allowed_origins();
    return in_array('*', $allowedOrigins, true) || in_array($origin, $allowedOrigins, true);
}

function ajasti_bootstrap(): void
{
    set_exception_handler('ajasti_handle_throwable');
    register_shutdown_function('ajasti_handle_shutdown');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (ajasti_origin_allowed($origin)) {
        header('Access-Control-Allow-Origin: ' . rtrim($origin, '/'));
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: SAMEORIGIN');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    session_name('JASTISESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => ajasti_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    session_start();
}

function ajasti_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = ajasti_env('DB_HOST', 'localhost');
    $port = ajasti_env('DB_PORT', '3306');
    $socket = ajasti_env('DB_SOCKET', '');
    $name = ajasti_env('DB_NAME', 'ajasti_jms');
    $user = ajasti_env('DB_USER', 'root');
    $pass = ajasti_env('DB_PASS', '');

    if ($name === '' || $user === '') {
        ajasti_json([
            'message' => 'Database configuration is incomplete. Set DB_NAME, DB_USER, and DB_PASS in api/support/config.php.',
        ], 500);
    }

    $dsn = $socket !== ''
        ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $socket, $name)
        : sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        $payload = [
            'message' => 'Database connection failed.',
            'database' => $name,
            'host' => $socket !== '' ? 'unix_socket' : $host,
        ];
        if (ajasti_debug_enabled()) {
            $payload['error'] = $exception->getMessage();
            $payload['dsn'] = $dsn;
        }
        ajasti_json($payload, 500);
    }

    return $pdo;
}

function ajasti_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ajasti_request_data(): array
{
    if (str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data')) {
        return $_POST;
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        ajasti_json(['message' => 'Invalid JSON payload.'], 422);
    }

    return $decoded;
}

function ajasti_require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        ajasti_json(['message' => 'Method not allowed.'], 405);
    }
}

function ajasti_normalize_role(string $role): string
{
    return strtolower(trim($role));
}

function ajasti_ensure_role(PDO $pdo, string $roleName, string $description): int
{
    $roleName = ajasti_normalize_role($roleName);
    $select = $pdo->prepare('SELECT role_id FROM roles WHERE LOWER(role_name) = :role_name LIMIT 1');
    $select->execute(['role_name' => $roleName]);
    $existing = $select->fetchColumn();
    if ($existing !== false) {
        return (int) $existing;
    }

    $insert = $pdo->prepare('INSERT INTO roles (role_name, description) VALUES (:role_name, :description)');
    $insert->execute([
        'role_name' => $roleName,
        'description' => $description,
    ]);

    return (int) $pdo->lastInsertId();
}

function ajasti_user_roles(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT r.role_name
         FROM user_roles ur
         INNER JOIN roles r ON r.role_id = ur.role_id
         WHERE ur.user_id = :user_id
         ORDER BY r.role_name ASC'
    );
    $stmt->execute(['user_id' => $userId]);
    return array_values(array_map(static fn ($role) => strtolower((string) $role['role_name']), $stmt->fetchAll()));
}

function ajasti_is_editor_workspace_role(string $role): bool
{
    $normalizedRole = ajasti_normalize_role($role);
    return in_array($normalizedRole, ['editor', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board'], true);
}

function ajasti_has_editor_workspace_role(array $roles): bool
{
    foreach ($roles as $role) {
        if (ajasti_is_editor_workspace_role((string) $role)) {
            return true;
        }
    }

    return false;
}

function ajasti_is_editor_application_role(string $role): bool
{
    $normalizedRole = ajasti_normalize_role($role);
    return in_array($normalizedRole, ['editor_in_chief', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board'], true);
}

function ajasti_has_editor_application_role(array $roles): bool
{
    foreach ($roles as $role) {
        if (ajasti_is_editor_application_role((string) $role)) {
            return true;
        }
    }

    return false;
}

function ajasti_current_user(PDO $pdo): ?array
{
    $userId = $_SESSION['user_id'] ?? null;
    if (!is_int($userId) && !ctype_digit((string) $userId)) {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT user_id, first_name, last_name, email, orcid_id, institution, country, phone, avatar_path, status, date_registered, last_login
         FROM users
         WHERE user_id = :user_id
         LIMIT 1'
    );
    $stmt->execute(['user_id' => (int) $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }

    $user['roles'] = ajasti_user_roles($pdo, (int) $user['user_id']);
    return $user;
}

function ajasti_require_auth(PDO $pdo): array
{
    $user = ajasti_current_user($pdo);
    if ($user === null) {
        ajasti_json(['message' => 'Authentication required.'], 401);
    }
    return $user;
}

function ajasti_require_role(PDO $pdo, string $requiredRole): array
{
    $user = ajasti_require_auth($pdo);
    $requiredRole = ajasti_normalize_role($requiredRole);
    if (!in_array($requiredRole, $user['roles'], true)) {
        ajasti_json(['message' => 'Insufficient permissions.'], 403);
    }
    return $user;
}

function ajasti_settings_defaults(): array
{
    return [
        'journal_name' => 'Journal of Applied Science, Technology, and Innovation',
        'journal_acronym' => 'JASTI',
        'logo_path' => '',
        'homepage_tagline' => 'Building a rigorous African journal platform for applied research.',
        'homepage_intro' => 'Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.',
        'home_topbar_text' => 'Home for all research in applied science, technology, and innovation',
        'featured_articles_title' => 'Recently published research',
        'featured_articles_description' => 'Peer-reviewed articles and manuscripts published through the JASTI editorial workflow.',
        'research_pathways_title' => 'Research publishing pathways',
        'call_for_papers_title' => 'Submission deadlines and current opportunities',
        'call_for_papers_description' => 'Calls for papers are published here by the administrator and provide issue opportunities for authors across JASTI thematic areas.',
        'call_for_papers_cta_title' => 'Login and submit',
        'call_for_papers_cta_body' => 'Use the JASTI portal to log in, prepare your manuscript, and submit within the relevant deadline window.',
        'call_for_papers_notes_json' => json_encode([
            'Original research articles, reviews, case studies, and technical notes are welcome.',
            'Submissions should align with JASTI aims, thematic scope, and ethical standards.',
            'Authors should be prepared for screening, peer review, revision, and final editorial evaluation.',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'trending_research_title' => 'Current topics across applied scholarship',
        'trending_research_description' => 'Highlighted research areas help readers, authors, and editors identify emerging themes across applied science, technology, and innovation.',
        'publishing_overview_title' => 'Editorial quality and practical relevance',
        'publishing_overview_description' => 'JASTI prioritizes methodological soundness, publication ethics, applied relevance, and multidisciplinary integration across research contexts.',
        'workflow_snapshot_title' => 'From submission to publication',
        'workflow_snapshot_description' => 'The journal system is modeled around the full digital publishing sequence from submission to indexing and citation tracking.',
        'discover_open_access_title' => 'Discover Open Access',
        'discover_open_access_body' => 'Explore open and accessible research pathways, publication ethics, visibility strategies, and the role of open scholarship in applied knowledge exchange.',
        'discover_open_access_image' => '/images/discover-open-access.jpg',
        'discover_open_access_points_json' => json_encode([
            'Open access supports visibility, citation potential, and broader knowledge transfer across institutions and practice communities.',
            'JASTI aligns open dissemination with editorial rigor, publication ethics, and evidence-based evaluation rather than volume-driven publishing.',
            'The journal aims to improve access to trusted scholarship while preserving documented review, editorial governance, and research quality.',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'publish_with_us_title' => 'Publish with Us',
        'publish_with_us_body' => 'Learn how JASTI supports authors through submission, peer review, revision, production planning, and publication-ready editorial workflows.',
        'publish_with_us_image' => '/images/publish-with-us.jpg',
        'publish_with_us_points_json' => json_encode([
            'Multidisciplinary applied research focus',
            'Transparent editorial decisions and peer review',
            'Clear pathways for revisions, production, and publication',
            'Growing visibility strategy through DOI, indexing readiness, and metrics',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'track_research_title' => 'Track Your Research',
        'track_research_body' => 'Monitor submissions, revisions, editorial decisions, downloads, citations, DOI progress, and journal communication through the JASTI portal.',
        'track_research_image' => '/images/track-your-research.jpg',
        'call_for_papers_json' => json_encode([
            [
                'title' => 'Applied ICT for resilient institutions',
                'deadline' => '2026-06-30',
                'summary' => 'Original research, case studies, and review articles on digital systems that strengthen public and private sector performance.',
            ],
            [
                'title' => 'Technology-driven climate and sustainability solutions',
                'deadline' => '2026-07-15',
                'summary' => 'Submissions on environmental systems, climate adaptation, clean technology, and sustainability analytics.',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'trending_research_json' => json_encode([
            [
                'title' => 'AI-supported reviewer matching in multidisciplinary journals',
                'area' => 'Editorial technology',
                'summary' => 'Growing interest in workflow intelligence, reviewer discovery, and fair assignment logic.',
            ],
            [
                'title' => 'Open science and applied innovation ecosystems',
                'area' => 'Research policy',
                'summary' => 'Research visibility, practical implementation, and collaborative knowledge transfer remain key concerns.',
            ],
            [
                'title' => 'Digital learning systems for STEM capacity building',
                'area' => 'Educational technology',
                'summary' => 'Applied studies continue to focus on digital access, pedagogy, and measurable learning impact.',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'objectives_json' => json_encode([
            'Bridge the gap between theory and practice',
            'Promote interdisciplinary and cross-sector research',
            'Support innovation-driven development',
            'Encourage context-aware solutions relevant to both developed and developing economies',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'aims_json' => json_encode([
            'Provide a rigorous scholarly platform for applied, solution-oriented research',
            'Publish work with practical relevance, methodological soundness, and measurable impact',
            'Support science, technology, engineering, agriculture, management, and education research',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'scope_json' => json_encode([
            'Applied Information and Communication Technology (ICT)',
            'Engineering Systems, Design, and Optimization',
            'Applied Physical and Chemical Sciences',
            'Biological and Life Sciences Applications',
            'Agricultural Science, Agri-Technology, and Food Systems',
            'Environmental Science, Sustainability, and Climate Solutions',
            'Technology-Driven Innovation and Product Development',
            'STEM Education',
            'Educational Technology and Digital Learning Systems',
            'Management Science, Operations, and Organizational Innovation',
            'Entrepreneurship, Business Innovation, and Technology Transfer',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'review_specializations_json' => json_encode([
            'Applied Information and Communication Technology (ICT)',
            'Engineering Systems, Design, and Optimization',
            'Applied Physical and Chemical Sciences',
            'Biological and Life Sciences Applications',
            'Agricultural Science, Agri-Technology, and Food Systems',
            'Environmental Science, Sustainability, and Climate Solutions',
            'Technology-Driven Innovation and Product Development',
            'STEM Education',
            'Educational Technology and Digital Learning Systems',
            'Management Science, Operations, and Organizational Innovation',
            'Entrepreneurship, Business Innovation, and Technology Transfer',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'footer_summary' => 'Home for multidisciplinary research, applied scholarship, editorial quality, and publication visibility across science, technology, and innovation.',
        'footer_bottom_text' => 'Journal publishing, peer review, and research visibility.',
        'footer_bottom_tagline' => 'Applied science. Technology. Innovation.',
        'plagiarism_provider' => 'copyleaks',
        'plagiarism_enabled' => '0',
        'plagiarism_api_email' => '',
        'plagiarism_api_key' => '',
        'plagiarism_sandbox' => '1',
        'plagiarism_require_completion' => '1',
        'plagiarism_webhook_secret' => '',
    ];
}

function ajasti_apply_legacy_branding_aliases(PDO $pdo, array $settings): array
{
    $legacyReplacements = [
        'journal_acronym' => [
            'legacy' => 'JASTI',
            'current' => 'JASTI',
        ],
        'journal_name' => [
            'legacy' => 'Journal of Applied Science, Technology, and Innovation',
            'current' => 'Journal of Applied Science, Technology, and Innovation',
        ],
    ];

    foreach ($legacyReplacements as $key => $replacement) {
        $currentValue = trim((string) ($settings[$key] ?? ''));
        if ($currentValue === '' || strcasecmp($currentValue, $replacement['legacy']) !== 0) {
            continue;
        }

        $settings[$key] = $replacement['current'];
        ajasti_upsert_setting($pdo, $key, $replacement['current']);
    }

    return $settings;
}

function ajasti_settings(PDO $pdo): array
{
    $defaults = ajasti_settings_defaults();
    $settings = $defaults;

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value LONGTEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    $stmt = $pdo->query('SELECT setting_key, setting_value FROM system_settings');
    foreach ($stmt->fetchAll() as $row) {
        $settings[(string) $row['setting_key']] = (string) ($row['setting_value'] ?? '');
    }

    $settings = ajasti_apply_legacy_branding_aliases($pdo, $settings);

    return $settings;
}

function ajasti_upsert_setting(PDO $pdo, string $key, ?string $value): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO system_settings (setting_key, setting_value)
         VALUES (:setting_key, :setting_value)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute([
        'setting_key' => $key,
        'setting_value' => $value,
    ]);
}

function ajasti_log(PDO $pdo, ?int $userId, string $action, string $entityType, ?int $entityId = null): void
{
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO system_logs (user_id, action, entity_type, entity_id, ip_address)
             VALUES (:user_id, :action, :entity_type, :entity_id, :ip_address)'
        );
        $stmt->execute([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'ip_address' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 50),
        ]);
    } catch (Throwable $exception) {
        error_log(sprintf(
            'JASTI log write failed for %s/%s: %s',
            $entityType,
            $action,
            $exception->getMessage()
        ));
    }
}

function ajasti_send_mail(string $to, string $subject, string $message): bool
{
    if ($to === '') {
        return false;
    }

    $fromAddress = (string) ajasti_env('MAIL_FROM_ADDRESS', 'no-reply@ajasti.local');
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/plain; charset=UTF-8',
        'From: ' . $fromAddress,
    ];

    return @mail($to, $subject, $message, implode("\r\n", $headers));
}

function ajasti_paystack_secret_key(): string
{
    return (string) ajasti_env('PAYSTACK_SECRET_KEY', '');
}

function ajasti_paystack_public_key(): string
{
    return (string) ajasti_env('PAYSTACK_PUBLIC_KEY', '');
}

function ajasti_paystack_base_url(): string
{
    return rtrim((string) ajasti_env('PAYSTACK_BASE_URL', 'https://api.paystack.co'), '/');
}

function ajasti_http_json_request(string $method, string $url, array $headers = [], ?array $payload = null): array
{
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Unable to initialize HTTP client.');
    }

    $requestHeaders = array_merge(['Accept: application/json'], $headers);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $requestHeaders,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => true,
    ]);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge($requestHeaders, ['Content-Type: application/json']));
    }

    $response = curl_exec($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new RuntimeException($error !== '' ? $error : 'Unable to complete HTTP request.');
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON response from upstream service.');
    }

    return [
        'status_code' => $statusCode,
        'body' => $decoded,
    ];
}

function ajasti_first_journal_id(PDO $pdo): int
{
    $stmt = $pdo->query('SELECT journal_id FROM journals ORDER BY journal_id ASC LIMIT 1');
    $existing = $stmt->fetchColumn();
    if ($existing !== false) {
        return (int) $existing;
    }

    $settings = ajasti_settings($pdo);
    $insert = $pdo->prepare(
        'INSERT INTO journals (journal_name, publisher, website, description)
         VALUES (:journal_name, :publisher, :website, :description)'
    );
    $insert->execute([
        'journal_name' => $settings['journal_name'],
        'publisher' => $settings['journal_acronym'],
        'website' => ajasti_frontend_url(),
        'description' => $settings['homepage_tagline'],
    ]);

    return (int) $pdo->lastInsertId();
}

function ajasti_users_with_roles(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT u.user_id, u.first_name, u.last_name, u.email, u.institution, u.country, u.phone, u.orcid_id, u.avatar_path, u.status,
                u.email_verified_at, u.email_verification_sent_at, u.email_verification_expires_at,
                GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ",") AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.user_id
         LEFT JOIN roles r ON r.role_id = ur.role_id
         GROUP BY u.user_id
         ORDER BY u.user_id DESC'
    );

    return array_map(static function (array $row): array {
        $row['roles'] = $row['roles'] ? explode(',', (string) $row['roles']) : [];
        $row['email_verification_status'] = !empty($row['email_verified_at']) ? 'verified' : 'unverified';
        return $row;
    }, $stmt->fetchAll());
}

function ajasti_public_upload_path(string $relativeDirectory): array
{
    $relativeDirectory = trim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativeDirectory), DIRECTORY_SEPARATOR);
    $storageRelativePath = preg_match('#^api(?:' . preg_quote(DIRECTORY_SEPARATOR, '#') . '|$)#', $relativeDirectory) === 1
        ? $relativeDirectory
        : 'api' . DIRECTORY_SEPARATOR . $relativeDirectory;
    $absoluteDirectory = ajasti_root_path($storageRelativePath);
    if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0777, true) && !is_dir($absoluteDirectory)) {
        ajasti_json(['message' => 'Unable to prepare upload directory.'], 500);
    }
    if (!is_writable($absoluteDirectory)) {
        @chmod($absoluteDirectory, 0777);
    }
    if (!is_writable($absoluteDirectory)) {
        ajasti_json(['message' => 'Upload directory is not writable.'], 500);
    }
    $publicRelativePath = preg_replace('#^api' . preg_quote(DIRECTORY_SEPARATOR, '#') . '?#', '', $storageRelativePath);
    $publicBase = '/api/' . ltrim(str_replace(DIRECTORY_SEPARATOR, '/', (string) $publicRelativePath), '/');
    return [$absoluteDirectory, rtrim($publicBase, '/')];
}

function ajasti_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    if (array_key_exists($tableName, $cache)) {
        return $cache[$tableName];
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name'
    );
    $stmt->execute(['table_name' => $tableName]);
    $cache[$tableName] = ((int) $stmt->fetchColumn()) > 0;
    return $cache[$tableName];
}

function ajasti_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $key = $tableName . '.' . $columnName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);
    $cache[$key] = ((int) $stmt->fetchColumn()) > 0;
    return $cache[$key];
}

function ajasti_index_exists(PDO $pdo, string $tableName, string $indexName): bool
{
    static $cache = [];
    $key = $tableName . '.' . $indexName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND INDEX_NAME = :index_name'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'index_name' => $indexName,
    ]);

    $cache[$key] = ((int) $stmt->fetchColumn()) > 0;
    return $cache[$key];
}

function ajasti_generate_reference_number(PDO $pdo): string
{
    static $checkStmt = null;
    if ($checkStmt === null) {
        $checkStmt = $pdo->prepare('SELECT 1 FROM manuscripts WHERE reference_number = :reference_number LIMIT 1');
    }

    do {
        $candidate = 'JASTI-' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        $checkStmt->execute(['reference_number' => $candidate]);
    } while ($checkStmt->fetchColumn());

    return $candidate;
}

function ajasti_ensure_manuscript_reference_number(PDO $pdo): void
{
    if (!ajasti_column_exists($pdo, 'manuscripts', 'reference_number')) {
        $pdo->exec('ALTER TABLE manuscripts ADD COLUMN reference_number VARCHAR(32) NULL AFTER keywords');
    }

    if (!ajasti_index_exists($pdo, 'manuscripts', 'idx_manuscripts_reference_number')) {
        $pdo->exec('CREATE UNIQUE INDEX idx_manuscripts_reference_number ON manuscripts (reference_number)');
    }

    $stmt = $pdo->query('SELECT manuscript_id FROM manuscripts WHERE reference_number IS NULL OR reference_number = ""');
    $update = $pdo->prepare('UPDATE manuscripts SET reference_number = :reference_number WHERE manuscript_id = :manuscript_id');
    foreach ($stmt->fetchAll() as $row) {
        $update->execute([
            'reference_number' => ajasti_generate_reference_number($pdo),
            'manuscript_id' => (int) $row['manuscript_id'],
        ]);
    }
}

function ajasti_email_verification_schema_ready(PDO $pdo): bool
{
    return ajasti_column_exists($pdo, 'users', 'email_verified_at')
        && ajasti_column_exists($pdo, 'users', 'email_verification_token')
        && ajasti_column_exists($pdo, 'users', 'email_verification_sent_at')
        && ajasti_column_exists($pdo, 'users', 'email_verification_expires_at');
}

function ajasti_ensure_onboarding_review_columns(PDO $pdo, string $tableName): void
{
    $tableName = trim($tableName);
    if ($tableName === '' || !ajasti_table_exists($pdo, $tableName)) {
        return;
    }

    $columns = [
        'reviewed_at' => 'TIMESTAMP NULL',
        'reviewed_by' => 'INT NULL',
        'rejection_reason' => 'TEXT NULL',
        'acceptance_notes' => 'TEXT NULL',
    ];

    foreach ($columns as $column => $definition) {
        if (ajasti_column_exists($pdo, $tableName, $column)) {
            continue;
        }
        try {
            $pdo->exec(sprintf('ALTER TABLE %s ADD COLUMN %s %s', $tableName, $column, $definition));
        } catch (PDOException $exception) {
            // Ignore errors for existing columns or unsupported alterations.
            error_log(sprintf('Onboarding review column migration failed for %s.%s: %s', $tableName, $column, $exception->getMessage()));
        }
    }
}

function ajasti_frontend_url(string $path = ''): string
{
    $base = rtrim((string) ajasti_env('FRONTEND_APP_URL', ''), '/');
    if ($base === '') {
        $scheme = ajasti_is_https() ? 'https://' : 'http://';
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $base = $scheme . $host;
    }
    if ($path === '') {
        return $base;
    }
    return $base . '/' . ltrim($path, '/');
}

function ajasti_backend_url(string $path = ''): string
{
    $base = rtrim((string) ajasti_env('BACKEND_APP_URL', ''), '/');
    if ($base === '') {
        $scheme = ajasti_is_https() ? 'https://' : 'http://';
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
        $apiPos = strpos($scriptName, '/api/');
        $basePath = $apiPos !== false ? substr($scriptName, 0, $apiPos) : '';
        $base = $scheme . $host . $basePath;
    }
    if ($path === '') {
        return $base;
    }

    $normalizedPath = ltrim($path, '/');
    $basePath = trim((string) parse_url($base, PHP_URL_PATH), '/');

    if (
        $basePath !== ''
        && strtolower(basename($basePath)) === 'api'
        && str_starts_with(strtolower($normalizedPath), 'api/')
    ) {
        $normalizedPath = substr($normalizedPath, 4);
    }

    return $base . ($normalizedPath !== '' ? '/' . $normalizedPath : '');
}

function ajasti_increment_article_metrics(PDO $pdo, int $articleId, array $increments): void
{
    if ($articleId <= 0) {
        return;
    }

    $supportedColumns = ['downloads', 'views', 'citations'];
    $normalized = [];
    foreach ($increments as $column => $value) {
        if (!in_array($column, $supportedColumns, true)) {
            continue;
        }

        $amount = (int) $value;
        if ($amount === 0) {
            continue;
        }

        $normalized[$column] = $amount;
    }

    if ($normalized === []) {
        return;
    }

    $metricRowsStmt = $pdo->prepare(
        'SELECT metric_id,
                COALESCE(downloads, 0) AS downloads,
                COALESCE(views, 0) AS views,
                COALESCE(citations, 0) AS citations,
                altmetric_score
         FROM article_metrics
         WHERE article_id = :article_id
         ORDER BY metric_id ASC'
    );
    $metricRowsStmt->execute(['article_id' => $articleId]);
    $metricRows = $metricRowsStmt->fetchAll();

    if ($metricRows === []) {
        $insertStmt = $pdo->prepare(
            'INSERT INTO article_metrics (article_id, downloads, views, citations, altmetric_score, last_updated)
             VALUES (:article_id, :downloads, :views, :citations, 0, CURRENT_TIMESTAMP)'
        );
        $insertStmt->execute([
            'article_id' => $articleId,
            'downloads' => $normalized['downloads'] ?? 0,
            'views' => $normalized['views'] ?? 0,
            'citations' => $normalized['citations'] ?? 0,
        ]);
        return;
    }

    $primaryRow = array_shift($metricRows);
    $downloads = (int) ($primaryRow['downloads'] ?? 0);
    $views = (int) ($primaryRow['views'] ?? 0);
    $citations = (int) ($primaryRow['citations'] ?? 0);
    $altmetricScore = $primaryRow['altmetric_score'] !== null ? (int) $primaryRow['altmetric_score'] : null;
    $duplicateMetricIds = [];

    foreach ($metricRows as $row) {
        $downloads += (int) ($row['downloads'] ?? 0);
        $views += (int) ($row['views'] ?? 0);
        $citations += (int) ($row['citations'] ?? 0);
        if ($row['altmetric_score'] !== null) {
            $candidateScore = (int) $row['altmetric_score'];
            $altmetricScore = $altmetricScore === null ? $candidateScore : max($altmetricScore, $candidateScore);
        }
        $duplicateMetricIds[] = (int) ($row['metric_id'] ?? 0);
    }

    $downloads += $normalized['downloads'] ?? 0;
    $views += $normalized['views'] ?? 0;
    $citations += $normalized['citations'] ?? 0;

    $updateStmt = $pdo->prepare(
        'UPDATE article_metrics
         SET downloads = :downloads,
             views = :views,
             citations = :citations,
             altmetric_score = :altmetric_score,
             last_updated = CURRENT_TIMESTAMP
         WHERE metric_id = :metric_id'
    );
    $updateStmt->execute([
        'metric_id' => (int) $primaryRow['metric_id'],
        'downloads' => $downloads,
        'views' => $views,
        'citations' => $citations,
        'altmetric_score' => $altmetricScore,
    ]);

    if ($duplicateMetricIds !== []) {
        $placeholders = implode(', ', array_fill(0, count($duplicateMetricIds), '?'));
        $deleteStmt = $pdo->prepare('DELETE FROM article_metrics WHERE metric_id IN (' . $placeholders . ')');
        $deleteStmt->execute($duplicateMetricIds);
    }
}

function ajasti_public_asset_url(string $path): string
{
    $path = trim($path);
    if ($path === '') {
        return '';
    }

    if (preg_match('/^https?:\/\//i', $path) === 1) {
        return $path;
    }

    if (preg_match('/^javascript:/i', $path) === 1) {
        return '';
    }

    return ajasti_backend_url(ltrim($path, '/'));
}

function ajasti_issue_email_verification(PDO $pdo, int $userId, string $email): array
{
    if (!ajasti_email_verification_schema_ready($pdo)) {
        throw new RuntimeException('Email verification schema is not available yet.');
    }

    $verificationToken = bin2hex(random_bytes(32));
    $verificationTokenHash = hash('sha256', $verificationToken);
    $verificationExpiresAt = (new DateTimeImmutable('+24 hours'))->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'UPDATE users
         SET email_verified_at = NULL,
             email_verification_token = :email_verification_token,
             email_verification_sent_at = CURRENT_TIMESTAMP,
             email_verification_expires_at = :email_verification_expires_at
         WHERE user_id = :user_id'
    );
    $stmt->execute([
        'email_verification_token' => $verificationTokenHash,
        'email_verification_expires_at' => $verificationExpiresAt,
        'user_id' => $userId,
    ]);

    return [
        'link' => ajasti_backend_url('api/auth/verify_email.php?token=' . urlencode($verificationToken) . '&email=' . urlencode($email)),
        'sent_at' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'expires_at' => $verificationExpiresAt,
    ];
}

function ajasti_password_reset_schema_ready(PDO $pdo): bool
{
    return ajasti_column_exists($pdo, 'users', 'password_reset_token')
        && ajasti_column_exists($pdo, 'users', 'password_reset_sent_at')
        && ajasti_column_exists($pdo, 'users', 'password_reset_expires_at');
}

function ajasti_issue_password_reset(PDO $pdo, int $userId, string $email): array
{
    if (!ajasti_password_reset_schema_ready($pdo)) {
        throw new RuntimeException('Password reset schema is not available yet.');
    }

    $resetToken = bin2hex(random_bytes(32));
    $resetTokenHash = hash('sha256', $resetToken);
    $resetExpiresAt = (new DateTimeImmutable('+1 hour'))->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'UPDATE users
         SET password_reset_token = :password_reset_token,
             password_reset_sent_at = CURRENT_TIMESTAMP,
             password_reset_expires_at = :password_reset_expires_at
         WHERE user_id = :user_id'
    );
    $stmt->execute([
        'password_reset_token' => $resetTokenHash,
        'password_reset_expires_at' => $resetExpiresAt,
        'user_id' => $userId,
    ]);

    return [
        'link' => ajasti_frontend_url('portal?reset_password=1&token=' . urlencode($resetToken) . '&email=' . urlencode($email)),
        'sent_at' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'expires_at' => $resetExpiresAt,
    ];
}

function ajasti_send_html_email(string $userEmail, string $subject, string $htmlBody, string $altBody): void
{
    $composerAutoload = ajasti_root_path('vendor/autoload.php');
    if (is_file($composerAutoload)) {
        require_once $composerAutoload;
    } else {
        $candidateRoots = [
            ajasti_root_path('PHPMailer/src'),
            ajasti_root_path('api/PHPMailer/src'),
        ];

        $phpMailerSrc = null;
        foreach ($candidateRoots as $candidate) {
            if (is_dir($candidate)) {
                $phpMailerSrc = $candidate;
                break;
            }
        }

        if ($phpMailerSrc === null) {
            throw new RuntimeException('PHPMailer library is not installed. Install with Composer or place PHPMailer/src in the project root or api directory.');
        }

        require_once $phpMailerSrc . DIRECTORY_SEPARATOR . 'Exception.php';
        require_once $phpMailerSrc . DIRECTORY_SEPARATOR . 'PHPMailer.php';
        require_once $phpMailerSrc . DIRECTORY_SEPARATOR . 'SMTP.php';
    }

    $host = trim((string) ajasti_env('SMTP_HOST', ''));
    if ($host === '') {
        throw new RuntimeException('SMTP host is not configured.');
    }

    $secure = strtolower(trim((string) ajasti_env('SMTP_SECURE', 'ssl')));
    $port = (int) ajasti_env('SMTP_PORT', '465');
    $timeout = max(5, (int) ajasti_env('SMTP_TIMEOUT', '20'));
    $username = trim((string) ajasti_env('SMTP_USERNAME', ''));
    if ($username === '' || !str_contains($username, '@')) {
        throw new RuntimeException('Gmail SMTP requires SMTP_USERNAME to be the full Gmail address.');
    }
    $attempts = [];
    $authModes = ['', 'LOGIN', 'PLAIN'];

    foreach ($authModes as $authMode) {
        try {
            $smtpDebug = [];
            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->SMTPAuth = true;
            if ($authMode !== '') {
                $mail->AuthType = $authMode;
            }
            $mail->Username = $username;
            $mail->Password = (string) ajasti_env('SMTP_PASSWORD', '');
            $mail->Port = $port;
            $mail->Timeout = $timeout;
            $mail->SMTPAutoTLS = true;
            $mail->SMTPDebug = 2;
            $mail->Debugoutput = static function (string $message, int $level) use (&$smtpDebug): void {
                $smtpDebug[] = trim($message);
            };
            $mail->SMTPOptions = [
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true,
                ],
            ];
            if ($secure !== '') {
                $mail->SMTPSecure = $secure;
            }
            $mail->setFrom(
                (string) ajasti_env('MAIL_FROM_ADDRESS', 'support@pasacouncil.org'),
                (string) ajasti_env('MAIL_FROM_NAME', 'PASAC Support')
            );
            $mail->addAddress($userEmail);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            $mail->AltBody = $altBody;
            $mail->send();
            return;
        } catch (Throwable $exception) {
            $debugTail = '';
            if ($smtpDebug !== []) {
                $debugTail = ' | debug: ' . implode(' || ', array_slice($smtpDebug, -4));
            }
            $attempts[] = sprintf(
                '%s:%d%s%s => %s%s',
                $host,
                $port,
                $secure !== '' ? ' (' . $secure . ')' : '',
                $authMode !== '' ? ' [' . $authMode . ']' : '',
                $exception->getMessage(),
                $debugTail
            );
        }
    }

    throw new RuntimeException('Gmail SMTP delivery failed. Attempts: ' . implode(' | ', $attempts));
}

function ajasti_send_verification_email(string $userEmail, string $verificationLink): void
{
    $journalName = (string) ajasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) ajasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeLink = htmlspecialchars($verificationLink, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($userEmail, ENT_QUOTES, 'UTF-8');
    $subject = $journalName . ' Email Verification';
    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$journalName} Email Verification</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 38%,#f7fafc 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0b6fa4 0%,#0a628f 52%,#083b5c 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;">Verify your email address</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;opacity:0.95;">Complete your account setup to access the JASTI journal publishing workflow.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff6fb;color:#0b6fa4;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">JASTI Account Security</div>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">An account was created for <strong>{$safeEmail}</strong>. Confirm this email address to activate sign-in for manuscript submission, review, and editorial workspace access.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#0b6fa4;">Verification window</p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">This secure verification link remains valid for 24 hours from the time this message was sent.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#0b6fa4" style="border-radius:10px;box-shadow:0 10px 24px rgba(11,111,164,0.2);">
                    <a href="{$safeLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Verify account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">If the button does not open, copy and paste this URL into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;color:#0b6fa4;"><a href="{$safeLink}" style="color:#0b6fa4;text-decoration:underline;">{$safeLink}</a></p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">If you did not request this account, you can ignore this message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#64748b;">
              Sent by {$supportName} for {$journalName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    $altBody = $journalName . ' verification: open this link within 24 hours to verify your account: ' . $verificationLink;

    ajasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function ajasti_send_password_reset_email(string $userEmail, string $resetLink): void
{
    $journalName = (string) ajasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) ajasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeLink = htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($userEmail, ENT_QUOTES, 'UTF-8');
    $subject = $journalName . ' Password Reset';
    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$journalName} Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 38%,#f7fafc 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#184d44 0%,#1f6b5c 52%,#0b6fa4 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;">Reset your password</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;opacity:0.95;">A secure password reset request was received for your JASTI account.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff8f4;color:#184d44;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Account Recovery</div>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">Use the button below to create a new password for <strong>{$safeEmail}</strong>.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#184d44;">Reset window</p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">This secure reset link remains valid for 1 hour from the time this message was sent.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#184d44" style="border-radius:10px;box-shadow:0 10px 24px rgba(24,77,68,0.2);">
                    <a href="{$safeLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">If the button does not open, copy and paste this URL into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;color:#184d44;"><a href="{$safeLink}" style="color:#184d44;text-decoration:underline;">{$safeLink}</a></p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">If you did not request a password reset, you can ignore this message and your current password will remain unchanged.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#64748b;">
              Sent by {$supportName} for {$journalName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    $altBody = $journalName . ' password reset: open this link within 1 hour to choose a new password: ' . $resetLink;

    ajasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function ajasti_upload_error_message(int $error): string
{
    return match ($error) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Uploaded file exceeds the server size limit.',
        UPLOAD_ERR_PARTIAL => 'Uploaded file was only partially received.',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Temporary upload directory is missing.',
        UPLOAD_ERR_CANT_WRITE => 'Server could not write the uploaded file.',
        UPLOAD_ERR_EXTENSION => 'A server extension stopped the upload.',
        default => 'File upload failed.',
    };
}

function ajasti_store_uploaded_image(array $file, string $relativeDirectory, string $prefix): string
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        ajasti_json(['message' => ajasti_upload_error_message($error)], 422);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $maxBytes = (int) ajasti_env('MAX_UPLOAD_SIZE_BYTES', (string) (5 * 1024 * 1024));
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        $maxMb = number_format($maxBytes / 1048576, 0);
        ajasti_json(['message' => "Image exceeds the {$maxMb}MB size limit."], 422);
    }
    $mime = mime_content_type((string) $file['tmp_name']);
    if (!isset($allowed[$mime])) {
        ajasti_json(['message' => 'Only JPG, PNG, and WEBP images are allowed.'], 422);
    }

    [$absoluteDirectory, $publicBase] = ajasti_public_upload_path($relativeDirectory);
    $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(8)), $allowed[$mime]);
    $absolutePath = $absoluteDirectory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
        ajasti_json(['message' => 'Unable to save uploaded image.'], 500);
    }

    return $publicBase . '/' . $filename;
}

function ajasti_store_uploaded_file(array $file, string $relativeDirectory, string $prefix, array $allowedMimeMap, ?int $maxBytes = null): string
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        ajasti_json(['message' => ajasti_upload_error_message($error)], 422);
    }

    $maxBytes ??= (int) ajasti_env('MAX_UPLOAD_SIZE_BYTES', (string) (10 * 1024 * 1024));
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        $maxMb = number_format($maxBytes / 1048576, 0);
        ajasti_json(['message' => "Uploaded file exceeds the {$maxMb}MB size limit."], 422);
    }

    $mime = mime_content_type((string) $file['tmp_name']);
    if (!isset($allowedMimeMap[$mime])) {
        ajasti_json(['message' => 'Unsupported file format uploaded for this field.'], 422);
    }

    [$absoluteDirectory, $publicBase] = ajasti_public_upload_path($relativeDirectory);
    $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(8)), $allowedMimeMap[$mime]);
    $absolutePath = $absoluteDirectory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
        ajasti_json(['message' => 'Unable to save uploaded file.'], 500);
    }

    return $publicBase . '/' . $filename;
}
function ajasti_ensure_editor_types(PDO $pdo): void
{
    $sql = file_get_contents(ajasti_root_path('database/editor_types_migration.sql'));
    if ($sql !== false) {
        $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
        // Split on ; and execute each statement
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $statement) {
            if ($statement !== '') {
                try {
                    $pdo->exec($statement);
                } catch (PDOException $e) {
                    // Ignore duplicate table/key errors
                    if (!str_contains($e->getMessage(), 'already exists') && 
                        !str_contains($e->getMessage(), 'Duplicate')) {
                        error_log('Migration error: ' . $e->getMessage());
                    }
                }
            }
        }
    }
}

function ajasti_editor_types(PDO $pdo): array
{
    ajasti_ensure_editor_types($pdo);
    $stmt = $pdo->query('SELECT * FROM editor_types ORDER BY access_level DESC');
    return $stmt->fetchAll();
}

function ajasti_editor_type_by_id(PDO $pdo, int $typeId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM editor_types WHERE editor_type_id = :id');
    $stmt->execute(['id' => $typeId]);
    return $stmt->fetch() ?: null;
}

function ajasti_editor_type_by_name(PDO $pdo, string $typeName): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM editor_types WHERE type_name = :name');
    $stmt->execute(['name' => $typeName]);
    return $stmt->fetch() ?: null;
}

function ajasti_user_editor_profile(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT ep.*, et.type_name, et.description FROM editor_profiles ep
         LEFT JOIN editor_types et ON et.editor_type_id = ep.editor_type_id
         WHERE ep.user_id = :user_id'
    );
    $stmt->execute(['user_id' => $userId]);
    return $stmt->fetch() ?: null;
}

function ajasti_create_editor_profile(PDO $pdo, int $userId, int $editorTypeId, ?array $data = null): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO editor_profiles (user_id, editor_type_id, subject_areas, bio, expertise_description, appointment_date, status)
         VALUES (:user_id, :editor_type_id, :subject_areas, :bio, :expertise_description, :appointment_date, :status)'
    );
    
    $stmt->execute([
        'user_id' => $userId,
        'editor_type_id' => $editorTypeId,
        'subject_areas' => $data['subject_areas'] ?? null,
        'bio' => $data['bio'] ?? null,
        'expertise_description' => $data['expertise_description'] ?? null,
        'appointment_date' => $data['appointment_date'] ?? date('Y-m-d'),
        'status' => 'active',
    ]);
    
    return (int) $pdo->lastInsertId();
}

function ajasti_can_access_dashboard(PDO $pdo, int $userId, string $dashboardName): bool
{
    $profile = ajasti_user_editor_profile($pdo, $userId);
    if (!$profile) {
        return false;
    }
    
    $stmt = $pdo->prepare(
        'SELECT can_view FROM editor_dashboard_access 
         WHERE editor_type_id = :editor_type_id AND dashboard_name = :dashboard_name'
    );
    $stmt->execute([
        'editor_type_id' => $profile['editor_type_id'],
        'dashboard_name' => $dashboardName,
    ]);
    
    $result = $stmt->fetch();
    return $result && $result['can_view'];
}

function ajasti_can_edit_dashboard(PDO $pdo, int $userId, string $dashboardName): bool
{
    $profile = ajasti_user_editor_profile($pdo, $userId);
    if (!$profile) {
        return false;
    }
    
    $stmt = $pdo->prepare(
        'SELECT can_edit FROM editor_dashboard_access 
         WHERE editor_type_id = :editor_type_id AND dashboard_name = :dashboard_name'
    );
    $stmt->execute([
        'editor_type_id' => $profile['editor_type_id'],
        'dashboard_name' => $dashboardName,
    ]);
    
    $result = $stmt->fetch();
    return $result && $result['can_edit'];
}

function ajasti_get_dashboard_url(string $editorTypeName): string
{
    $dashboards = [
        'editor_in_chief' => '/editor/dashboard',
        'managing_editor' => '/editor/submissions',
        'section_editor' => '/editor/assignments',
        'technical_editor' => '/editor/formatting',
        'advisory_board' => '/editor/advisory',
        'reviewer' => '/reviewer/dashboard',
    ];
    
    return $dashboards[$editorTypeName] ?? '/editor/dashboard';
}

function ajasti_ensure_editor_applications(PDO $pdo): void
{
    $sql = file_get_contents(ajasti_root_path('database/editor_applications_migration.sql'));
    if ($sql !== false) {
        $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $statement) {
            if ($statement !== '') {
                try {
                    $pdo->exec($statement);
                } catch (PDOException $e) {
                    if (!str_contains($e->getMessage(), 'already exists') && 
                        !str_contains($e->getMessage(), 'Duplicate')) {
                        error_log('Editor applications migration error: ' . $e->getMessage());
                    }
                }
            }
        }
    }
}

function ajasti_ensure_editor_workspace_schema(PDO $pdo): void
{
    $sql = file_get_contents(ajasti_root_path('database/editor_application_migration.sql'));
    if ($sql === false) {
        return;
    }

    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $statements = array_filter(array_map('trim', explode(';', $sql)));

    foreach ($statements as $statement) {
        if ($statement === '' || preg_match('/^USE\s+/i', $statement) === 1) {
            continue;
        }

        try {
            $pdo->exec($statement);
        } catch (PDOException $e) {
            $message = $e->getMessage();
            if (
                !str_contains($message, 'already exists')
                && !str_contains($message, 'Duplicate')
                && !str_contains($message, 'Duplicate entry')
            ) {
                error_log('Editor workspace migration error: ' . $message);
            }
        }
    }
}

function ajasti_create_editor_application(PDO $pdo, int $userId, int $editorTypeId, array $data): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO editor_applications 
         (user_id, editor_type_id, cv_file_path, cv_original_filename, subject_areas, expertise_description, bio, status)
         VALUES (:user_id, :editor_type_id, :cv_file_path, :cv_original_filename, :subject_areas, :expertise_description, :bio, :status)'
    );
    
    $stmt->execute([
        'user_id' => $userId,
        'editor_type_id' => $editorTypeId,
        'cv_file_path' => $data['cv_file_path'] ?? null,
        'cv_original_filename' => $data['cv_original_filename'] ?? null,
        'subject_areas' => $data['subject_areas'] ?? null,
        'expertise_description' => $data['expertise_description'] ?? null,
        'bio' => $data['bio'] ?? null,
        'status' => 'pending',
    ]);
    
    return (int) $pdo->lastInsertId();
}

function ajasti_get_editor_application(PDO $pdo, int $applicationId): ?array
{
    ajasti_ensure_editor_applications($pdo);

    $stmt = $pdo->prepare(
        'SELECT ea.*, u.first_name, u.last_name, u.email, et.type_name,
                et.description AS title, et.responsibilities AS description
         FROM editor_applications ea
         JOIN users u ON u.user_id = ea.user_id
         JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
         WHERE ea.application_id = :id'
    );
    
    $stmt->execute(['id' => $applicationId]);
    return $stmt->fetch() ?: null;
}

function ajasti_get_user_editor_application(PDO $pdo, int $userId): ?array
{
    ajasti_ensure_editor_applications($pdo);

    $stmt = $pdo->prepare(
        'SELECT ea.*, u.first_name, u.last_name, u.email, et.type_name,
                et.description AS title, et.responsibilities AS description
         FROM editor_applications ea
         JOIN users u ON u.user_id = ea.user_id
         JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
         WHERE ea.user_id = :user_id AND ea.status IN ("pending", "accepted")
         ORDER BY ea.applied_at DESC
         LIMIT 1'
    );
    
    $stmt->execute(['user_id' => $userId]);
    return $stmt->fetch() ?: null;
}

function ajasti_get_latest_editor_application(PDO $pdo, int $userId): ?array
{
    ajasti_ensure_editor_applications($pdo);

    $stmt = $pdo->prepare(
        'SELECT ea.*, et.type_name,
                et.description AS title, et.responsibilities AS description
         FROM editor_applications ea
         JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
         WHERE ea.user_id = :user_id
         ORDER BY ea.applied_at DESC
         LIMIT 1'
    );

    $stmt->execute(['user_id' => $userId]);
    return $stmt->fetch() ?: null;
}

function ajasti_get_pending_applications(PDO $pdo, int $limit = 50, int $offset = 0): array
{
    ajasti_ensure_editor_applications($pdo);

    $stmt = $pdo->prepare(
        'SELECT ea.*, u.first_name, u.last_name, u.email, et.type_name,
                et.description AS title, et.responsibilities AS description,
                ru.first_name as reviewer_first_name, ru.last_name as reviewer_last_name
         FROM editor_applications ea
         JOIN users u ON u.user_id = ea.user_id
         JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
         LEFT JOIN users ru ON ru.user_id = ea.reviewed_by
         WHERE ea.status = "pending"
         ORDER BY ea.applied_at ASC
         LIMIT :limit OFFSET :offset'
    );
    
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    return $stmt->fetchAll();
}

function ajasti_accept_editor_application(PDO $pdo, int $applicationId, int $reviewerId, ?string $notes = null): bool
{
    ajasti_ensure_editor_applications($pdo);

    $application = ajasti_get_editor_application($pdo, $applicationId);
    if (!$application) {
        return false;
    }

    $pdo->beginTransaction();
    try {
        // Update application status
        $stmt = $pdo->prepare(
            'UPDATE editor_applications 
             SET status = "accepted", reviewed_at = NOW(), reviewed_by = :reviewed_by, acceptance_notes = :notes
             WHERE application_id = :id'
        );
        
        $stmt->execute([
            'id' => $applicationId,
            'reviewed_by' => $reviewerId,
            'notes' => $notes,
        ]);

        $activateUser = $pdo->prepare('UPDATE users SET status = "active" WHERE user_id = :user_id');
        $activateUser->execute(['user_id' => (int) $application['user_id']]);
        
        // Create editor profile from accepted application
        $existingProfile = ajasti_user_editor_profile($pdo, (int) $application['user_id']);
        if ($existingProfile === null) {
            ajasti_create_editor_profile($pdo, (int) $application['user_id'], (int) $application['editor_type_id'], [
                'subject_areas' => $application['subject_areas'],
                'expertise_description' => $application['expertise_description'],
                'bio' => $application['bio'],
                'appointment_date' => date('Y-m-d'),
            ]);
        }
        
        $pdo->commit();
        return true;
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Error accepting application: ' . $e->getMessage());
        return false;
    }
}

function ajasti_reject_editor_application(PDO $pdo, int $applicationId, int $reviewerId, string $reason): bool
{
    $stmt = $pdo->prepare(
        'UPDATE editor_applications 
         SET status = "rejected", reviewed_at = NOW(), reviewed_by = :reviewed_by, rejection_reason = :reason
         WHERE application_id = :id'
    );
    
    return $stmt->execute([
        'id' => $applicationId,
        'reviewed_by' => $reviewerId,
        'reason' => $reason,
    ]);
}

function ajasti_dashboard_payload(PDO $pdo, array $user): array
{
    $userId = (int) $user['user_id'];
    $roles = $user['roles'];
    $dashboards = [];

    if (in_array('author', $roles, true)) {
        $stmt = $pdo->prepare(
            "SELECT status, COUNT(*) AS total
             FROM manuscripts
             WHERE corresponding_author_id = :user_id
             GROUP BY status"
        );
        $stmt->execute(['user_id' => $userId]);
        $statusCounts = $stmt->fetchAll();

        $dashboards['author'] = [
            'title' => 'Author Dashboard',
            'stats' => $statusCounts,
            'actions' => [
                'Submit new manuscript',
                'Upload revised manuscript and response-to-reviewers',
                'Track editorial status and publication metrics',
                'Manage ORCID, institution, and contact profile',
            ],
        ];
    }

    if (in_array('reviewer', $roles, true)) {
        $invitationStmt = $pdo->prepare(
            "SELECT response, COUNT(*) AS total
             FROM review_invitations
             WHERE reviewer_id = :user_id
             GROUP BY response"
        );
        $invitationStmt->execute(['user_id' => $userId]);

        $reviewCountStmt = $pdo->prepare('SELECT COUNT(*) FROM reviews WHERE reviewer_id = :user_id');
        $reviewCountStmt->execute(['user_id' => $userId]);

        $dashboards['reviewer'] = [
            'title' => 'Reviewer Dashboard',
            'stats' => [
                'invitations' => $invitationStmt->fetchAll(),
                'completed_reviews' => (int) $reviewCountStmt->fetchColumn(),
            ],
            'actions' => [
                'Accept or decline review invitations',
                'Declare conflicts of interest before review',
                'Score originality, methodology, clarity, and ethics',
                'Submit confidential comments to editor and feedback to authors',
            ],
        ];
    }

    if (ajasti_has_editor_workspace_role($roles)) {
        $assignmentStmt = $pdo->prepare(
            "SELECT status, COUNT(*) AS total
             FROM editor_assignments
             WHERE editor_id = :user_id
             GROUP BY status"
        );
        $assignmentStmt->execute(['user_id' => $userId]);

        $dashboards['editor'] = [
            'title' => 'Editor Dashboard',
            'stats' => $assignmentStmt->fetchAll(),
            'actions' => [
                'Run initial screening for scope, formatting, and ethics',
                'Assign and monitor peer reviewers',
                'Compare revisions and evaluate author responses',
                'Recommend accept, revise, or reject decisions',
            ],
        ];
    }

    if (in_array('editor_in_chief', $roles, true)) {
        $overviewStmt = $pdo->query(
            "SELECT
                (SELECT COUNT(*) FROM manuscripts) AS total_submissions,
                (SELECT COUNT(*) FROM manuscripts WHERE status = 'accepted') AS accepted_manuscripts,
                (SELECT COUNT(*) FROM manuscripts WHERE status = 'published') AS published_manuscripts,
                (SELECT COUNT(*) FROM final_decisions) AS final_decisions"
        );

        $dashboards['editor_in_chief'] = [
            'title' => 'Editor-in-Chief Dashboard',
            'stats' => $overviewStmt->fetch() ?: [],
            'actions' => [
                'Approve or override editorial recommendations',
                'Resolve disputes and ethical investigations',
                'Plan issues and publication schedules',
                'Monitor citation, indexing, and board performance',
            ],
        ];
    }

    if (in_array('admin', $roles, true)) {
        $adminStmt = $pdo->query(
            "SELECT
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM manuscripts) AS total_manuscripts,
                (SELECT COUNT(*) FROM messages) AS total_messages,
                (SELECT COUNT(*) FROM system_logs) AS total_logs"
        );

        $dashboards['admin'] = [
            'title' => 'Admin Control Panel',
            'stats' => $adminStmt->fetch() ?: [],
            'actions' => [
                'Manage users and role assignments',
                'Oversee journal, issue, and article metadata',
                'Audit system logs and operational messaging',
                'Configure infrastructure integrations and workflow settings',
            ],
        ];
    }

    return $dashboards;
}
