<?php
declare(strict_types=1);

date_default_timezone_set('Africa/Lagos');

function jasti_read_env_file(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $values = [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return [];
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);
        $value = trim($value, "\"'");

        if ($key !== '') {
            $values[$key] = $value;
        }
    }

    return $values;
}

function jasti_runtime_env_values(): array
{
    static $values = null;
    if (is_array($values)) {
        return $values;
    }

    $values = array_merge(
        jasti_read_env_file(jasti_root_path('.env')),
        jasti_read_env_file(jasti_root_path('public/.env'))
    );

    foreach ($_ENV as $key => $value) {
        if (!is_string($key) || $key === '') {
            continue;
        }

        if (is_scalar($value)) {
            $values[$key] = (string) $value;
        }
    }

    return $values;
}

function jasti_is_local_environment(): bool
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return str_contains($host, 'localhost') || str_contains($host, '127.0.0.1');
}

function jasti_config(): array
{
    static $config = null;
    if ($config === null) {
        $configPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
        $config = is_file($configPath) ? require $configPath : [];
        if (!is_array($config)) {
            $config = [];
        }

        // Override for local development
        if (jasti_is_local_environment()) {
            $config['DB_HOST'] = 'localhost';
            $config['DB_NAME'] = 'ajasti_jms';
            $config['DB_USER'] = 'root';
            $config['DB_PASS'] = '';
            $config['APP_DEBUG'] = true;
        }

        foreach (jasti_runtime_env_values() as $key => $value) {
            if ($value === '') {
                continue;
            }

            $config[$key] = $value;
        }
    }
    return $config;
}

function jasti_root_path(string $path = ''): string
{
    $root = dirname(__DIR__, 2);
    return $path === '' ? $root : $root . DIRECTORY_SEPARATOR . ltrim($path, DIRECTORY_SEPARATOR);
}

function jasti_env(string $key, ?string $default = null): ?string
{
    $runtimeValues = jasti_runtime_env_values();
    if (array_key_exists($key, $runtimeValues) && $runtimeValues[$key] !== '' && $runtimeValues[$key] !== null) {
        return (string) $runtimeValues[$key];
    }

    $processValue = getenv($key);
    if ($processValue !== false && $processValue !== '') {
        return (string) $processValue;
    }

    $config = jasti_config();
    if (array_key_exists($key, $config) && $config[$key] !== '' && $config[$key] !== null) {
        return is_bool($config[$key]) ? ($config[$key] ? '1' : '0') : (string) $config[$key];
    }
    return $default;
}

function jasti_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) === '443');
}

function jasti_debug_enabled(): bool
{
    $value = strtolower((string) jasti_env('APP_DEBUG', '0'));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function jasti_handle_throwable(Throwable $exception): void
{
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }

    $payload = ['message' => 'Server error.'];
    if (jasti_debug_enabled()) {
        $payload['error'] = $exception->getMessage();
        $payload['file'] = $exception->getFile();
        $payload['line'] = $exception->getLine();
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function jasti_handle_shutdown(): void
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
    if (jasti_debug_enabled()) {
        $payload['error'] = $error['message'] ?? 'Unknown fatal error';
        $payload['file'] = $error['file'] ?? null;
        $payload['line'] = $error['line'] ?? null;
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function jasti_allowed_origins(): array
{
    $config = jasti_config();
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
    if (jasti_is_local_environment()) {
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
    $frontend = rtrim((string) jasti_env('FRONTEND_APP_URL', ''), '/');
    if ($frontend !== '') {
        $defaults[] = $frontend;
    }

    return array_values(array_unique($defaults));
}

function jasti_origin_allowed(string $origin): bool
{
    $origin = rtrim(trim($origin), '/');
    if ($origin === '') {
        return false;
    }

    $allowedOrigins = jasti_allowed_origins();
    return in_array('*', $allowedOrigins, true) || in_array($origin, $allowedOrigins, true);
}

function jasti_bootstrap(): void
{
    set_exception_handler('jasti_handle_throwable');
    register_shutdown_function('jasti_handle_shutdown');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (jasti_origin_allowed($origin)) {
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
        'secure' => jasti_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    session_start();

    $timeoutSeconds = (int) jasti_env('SESSION_TIMEOUT_SECONDS', '1800');
    if ($timeoutSeconds > 0 && isset($_SESSION['user_id'], $_SESSION['last_activity'])) {
        $lastActivity = (int) $_SESSION['last_activity'];
        if ($lastActivity > 0 && (time() - $lastActivity) > $timeoutSeconds) {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
            }
            session_destroy();
            session_start();
        }
    }
    if (isset($_SESSION['user_id'])) {
        $_SESSION['last_activity'] = time();
    }
}

function jasti_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = jasti_env('DB_HOST', 'localhost');
    $port = jasti_env('DB_PORT', '3306');
    $socket = jasti_env('DB_SOCKET', '');
    $name = jasti_env('DB_NAME', 'jasti_jms');
    $user = jasti_env('DB_USER', 'root');
    $pass = jasti_env('DB_PASS', '');

    if ($name === '' || $user === '') {
        jasti_json([
            'message' => 'Database configuration is incomplete. Set DB_NAME, DB_USER, and DB_PASS in api/support/config.php.',
        ], 500);
    }

    $dsn = $socket !== ''
        ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $socket, $name)
        : sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);

    try {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
            $options[PDO::MYSQL_ATTR_USE_BUFFERED_QUERY] = true;
        }

        $pdo = new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $exception) {
        $payload = [
            'message' => 'Database connection failed.',
            'database' => $name,
            'host' => $socket !== '' ? 'unix_socket' : $host,
        ];
        if (jasti_debug_enabled()) {
            $payload['error'] = $exception->getMessage();
            $payload['dsn'] = $dsn;
        }
        jasti_json($payload, 500);
    }

    return $pdo;
}

function jasti_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function jasti_request_data(): array
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
        jasti_json(['message' => 'Invalid JSON payload.'], 422);
    }

    return $decoded;
}

function jasti_require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        jasti_json(['message' => 'Method not allowed.'], 405);
    }
}

function jasti_password_verify_legacy(string $password, string $storedHash): bool
{
    $normalizedHash = trim($storedHash);
    if ($normalizedHash === '') {
        return false;
    }

    if (password_verify($password, $normalizedHash)) {
        return true;
    }

    $md5Hash = md5($password);
    $sha1Hash = sha1($password);

    return hash_equals($normalizedHash, $password)
        || hash_equals($normalizedHash, $md5Hash)
        || hash_equals($normalizedHash, $sha1Hash);
}

function jasti_password_needs_upgrade(string $storedHash): bool
{
    $normalizedHash = trim($storedHash);
    if ($normalizedHash === '') {
        return false;
    }

    $info = password_get_info($normalizedHash);
    if (($info['algo'] ?? null) !== null && ($info['algo'] ?? 0) !== 0) {
        return password_needs_rehash($normalizedHash, PASSWORD_DEFAULT);
    }

    return true;
}

function jasti_normalize_role(string $role): string
{
    return strtolower(trim($role));
}

function jasti_ensure_role(PDO $pdo, string $roleName, string $description): int
{
    $roleName = jasti_normalize_role($roleName);
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

function jasti_assign_role(PDO $pdo, int $userId, string $roleName, ?string $description = null): void
{
    $roleName = jasti_normalize_role($roleName);
    if ($userId <= 0 || $roleName === '') {
        return;
    }

    $roleId = jasti_ensure_role($pdo, $roleName, $description ?? ucfirst(str_replace('_', ' ', $roleName)) . ' role');
    $check = $pdo->prepare('SELECT user_role_id FROM user_roles WHERE user_id = :user_id AND role_id = :role_id LIMIT 1');
    $check->execute([
        'user_id' => $userId,
        'role_id' => $roleId,
    ]);

    if ($check->fetchColumn() === false) {
        $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)')->execute([
            'user_id' => $userId,
            'role_id' => $roleId,
        ]);
    }
}

function jasti_assign_account_role(PDO $pdo, int $userId, string $roleName, ?string $description = null): void
{
    $roleName = jasti_normalize_role($roleName);
    if ($roleName !== 'author') {
        jasti_assign_role($pdo, $userId, 'author', 'Author account for manuscript submission and revision workflow.');
    }

    jasti_assign_role($pdo, $userId, $roleName, $description);
}

function jasti_user_roles(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT r.role_name
         FROM user_roles ur
         INNER JOIN roles r ON r.role_id = ur.role_id
         WHERE ur.user_id = :user_id
         ORDER BY r.role_name ASC'
    );
    $stmt->execute(['user_id' => $userId]);
    $roles = array_values(array_map(static fn ($role) => strtolower((string) $role['role_name']), $stmt->fetchAll()));
    if ($roles !== [] && !in_array('author', $roles, true)) {
        jasti_assign_role($pdo, $userId, 'author', 'Author account for manuscript submission and revision workflow.');
        $roles[] = 'author';
        sort($roles);
    }

    return $roles;
}

function jasti_is_editor_workspace_role(string $role): bool
{
    $normalizedRole = jasti_normalize_role($role);
    return in_array($normalizedRole, ['editor', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board'], true);
}

function jasti_has_editor_workspace_role(array $roles): bool
{
    foreach ($roles as $role) {
        if (jasti_is_editor_workspace_role((string) $role)) {
            return true;
        }
    }

    return false;
}

function jasti_is_editor_application_role(string $role): bool
{
    $normalizedRole = jasti_normalize_role($role);
    return in_array($normalizedRole, ['editor_in_chief', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board'], true);
}

function jasti_has_editor_application_role(array $roles): bool
{
    foreach ($roles as $role) {
        if (jasti_is_editor_application_role((string) $role)) {
            return true;
        }
    }

    return false;
}

function jasti_login_path_for_roles(array $roles): string
{
    $normalizedRoles = array_values(array_unique(array_map(
        static fn ($role) => jasti_normalize_role((string) $role),
        $roles
    )));

    if (in_array('admin', $normalizedRoles, true)) {
        return '/login/admin';
    }

    if (
        in_array('editor_in_chief', $normalizedRoles, true)
        || jasti_has_editor_workspace_role($normalizedRoles)
        || jasti_has_editor_application_role($normalizedRoles)
    ) {
        return '/login/editor';
    }

    if (in_array('reviewer', $normalizedRoles, true)) {
        return '/login/reviewer';
    }

    if (in_array('author', $normalizedRoles, true)) {
        return '/login/author';
    }

    return '/login/author';
}

function jasti_current_user(PDO $pdo): ?array
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

    $user['roles'] = jasti_user_roles($pdo, (int) $user['user_id']);
    return $user;
}

function jasti_require_auth(PDO $pdo): array
{
    $user = jasti_current_user($pdo);
    if ($user === null) {
        jasti_json(['message' => 'Authentication required.'], 401);
    }
    return $user;
}

function jasti_require_role(PDO $pdo, string $requiredRole): array
{
    $user = jasti_require_auth($pdo);
    $requiredRole = jasti_normalize_role($requiredRole);
    if (!in_array($requiredRole, $user['roles'], true)) {
        jasti_json(['message' => 'Insufficient permissions.'], 403);
    }
    return $user;
}

function jasti_settings_defaults(): array
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
        'whatsapp_number' => '',
        'default_gq_percent' => '0',
        'default_ai_score_percent' => '0',
        'default_similarity_percent' => '0',
        'submission_fee_ngn' => (string) jasti_env('MANUSCRIPT_SUBMISSION_SCREENING_AMOUNT_NGN', '10000'),
        'publication_fee_ngn' => (string) jasti_env('MANUSCRIPT_PAYMENT_BASE_AMOUNT_NGN', '50000'),
        'plagiarism_provider' => 'copyleaks',
        'plagiarism_enabled' => '0',
        'plagiarism_api_email' => '',
        'plagiarism_api_key' => '',
        'plagiarism_sandbox' => '1',
        'plagiarism_require_completion' => '1',
        'plagiarism_webhook_secret' => '',
    ];
}

function jasti_apply_legacy_branding_aliases(PDO $pdo, array $settings): array
{
    $legacyReplacements = [
        'journal_acronym' => [
            'legacy' => 'A' . 'JASTI',
            'current' => 'JASTI',
        ],
        'journal_name' => [
            'legacy' => 'African ' . 'Journal of Applied Science, Technology, and Innovation',
            'current' => 'Journal of Applied Science, Technology, and Innovation',
        ],
    ];

    foreach ($legacyReplacements as $key => $replacement) {
        $currentValue = trim((string) ($settings[$key] ?? ''));
        if ($currentValue === '' || strcasecmp($currentValue, $replacement['legacy']) !== 0) {
            continue;
        }

        $settings[$key] = $replacement['current'];
        jasti_upsert_setting($pdo, $key, $replacement['current']);
    }

    return $settings;
}

function jasti_settings(PDO $pdo): array
{
    $defaults = jasti_settings_defaults();
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

    $settings = jasti_apply_legacy_branding_aliases($pdo, $settings);

    foreach (['logo_path', 'discover_open_access_image', 'publish_with_us_image', 'track_research_image'] as $assetKey) {
        $assetPath = (string) ($settings[$assetKey] ?? '');
        if ($assetPath !== '' && !jasti_public_asset_exists($assetPath)) {
            $settings[$assetKey] = (string) ($defaults[$assetKey] ?? '');
        }
    }

    return $settings;
}

function jasti_upsert_setting(PDO $pdo, string $key, ?string $value): void
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

function jasti_log(PDO $pdo, ?int $userId, string $action, string $entityType, ?int $entityId = null): void
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

function jasti_send_mail(string $to, string $subject, string $message): bool
{
    if ($to === '') {
        return false;
    }

    $fromAddress = (string) jasti_env('MAIL_FROM_ADDRESS', 'no-reply@jasti.local');
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/plain; charset=UTF-8',
        'From: ' . $fromAddress,
    ];

    return @mail($to, $subject, $message, implode("\r\n", $headers));
}

function jasti_send_action_needed_email(string $to, string $subject, string $heading, string $message, string $actionLabel, string $actionUrl): void
{
    $to = trim($to);
    if ($to === '' || filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
        return;
    }

    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeSubject = htmlspecialchars($subject, ENT_QUOTES, 'UTF-8');
    $safeHeading = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    $safeActionLabel = htmlspecialchars($actionLabel, ENT_QUOTES, 'UTF-8');
    $safeActionUrl = htmlspecialchars($actionUrl, ENT_QUOTES, 'UTF-8');
    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#184d44 0%,#0b6fa4 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:26px;line-height:1.25;font-weight:700;">{$safeHeading}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff8f4;color:#184d44;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Action Needed</div>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#334155;">{$safeMessage}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#184d44" style="border-radius:10px;box-shadow:0 10px 24px rgba(24,77,68,0.2);">
                    <a href="{$safeActionUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">{$safeActionLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">If the button does not open, copy and paste this URL into your browser:</p>
              <p style="margin:0;font-size:13px;line-height:1.7;word-break:break-all;color:#184d44;"><a href="{$safeActionUrl}" style="color:#184d44;text-decoration:underline;">{$safeActionUrl}</a></p>
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
    $altBody = $heading . "\n\n" . $message . "\n\n" . $actionLabel . ': ' . $actionUrl;

    jasti_send_html_email($to, $subject, $htmlBody, $altBody);
}

function jasti_notify_role_users(PDO $pdo, array $roles, string $subject, string $heading, string $message, string $actionLabel, string $actionUrl): void
{
    $normalizedRoles = array_values(array_unique(array_filter(array_map(
        static fn ($role): string => jasti_normalize_role((string) $role),
        $roles
    ))));
    if ($normalizedRoles === []) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($normalizedRoles), '?'));
    $stmt = $pdo->prepare(
        "SELECT DISTINCT u.email
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.user_id
         INNER JOIN roles r ON r.role_id = ur.role_id
         WHERE LOWER(r.role_name) IN ({$placeholders})"
    );
    $stmt->execute($normalizedRoles);
    foreach ($stmt->fetchAll() as $recipient) {
        try {
            jasti_send_action_needed_email((string) ($recipient['email'] ?? ''), $subject, $heading, $message, $actionLabel, $actionUrl);
        } catch (Throwable $exception) {
            error_log(sprintf('Action email failed for %s: %s', (string) ($recipient['email'] ?? ''), $exception->getMessage()));
        }
    }
}

function jasti_paystack_secret_key(): string
{
    return (string) jasti_env('PAYSTACK_SECRET_KEY', '');
}

function jasti_paystack_public_key(): string
{
    return (string) jasti_env('PAYSTACK_PUBLIC_KEY', '');
}

function jasti_paystack_base_url(): string
{
    return rtrim((string) jasti_env('PAYSTACK_BASE_URL', 'https://api.paystack.co'), '/');
}

function jasti_system_amount_setting(string $key, int $fallback): int
{
    try {
        $pdo = jasti_db();
        $settings = jasti_settings($pdo);
        $value = trim((string) ($settings[$key] ?? ''));
        if ($value !== '' && is_numeric($value)) {
            return max(0, (int) round((float) $value));
        }
    } catch (Throwable $exception) {
        error_log(sprintf('JASTI setting lookup failed for %s: %s', $key, $exception->getMessage()));
    }

    return max(0, $fallback);
}

function jasti_manuscript_payment_base_amount(): int
{
    return jasti_system_amount_setting(
        'publication_fee_ngn',
        (int) jasti_env('MANUSCRIPT_PAYMENT_BASE_AMOUNT_NGN', '50000')
    );
}

function jasti_submission_screening_payment_amount(): int
{
    return jasti_system_amount_setting(
        'submission_fee_ngn',
        (int) jasti_env('MANUSCRIPT_SUBMISSION_SCREENING_AMOUNT_NGN', '10000')
    );
}

function jasti_manuscript_payment_included_pages(): int
{
    return (int) jasti_env('MANUSCRIPT_PAYMENT_INCLUDED_PAGES', '10');
}

function jasti_manuscript_payment_extra_page_amount(): int
{
    return (int) jasti_env('MANUSCRIPT_PAYMENT_EXTRA_PAGE_AMOUNT_NGN', '1000');
}

function jasti_calculate_manuscript_payment_amount(int $totalPages): int
{
    $baseAmount = max(0, jasti_manuscript_payment_base_amount());
    $includedPages = max(0, jasti_manuscript_payment_included_pages());
    $extraPageAmount = max(0, jasti_manuscript_payment_extra_page_amount());
    $chargeableExtraPages = max(0, $totalPages - $includedPages);

    return $baseAmount + ($chargeableExtraPages * $extraPageAmount);
}

function jasti_format_naira_amount(float|int $amount): string
{
    return 'NGN ' . number_format((float) $amount, 0);
}

function jasti_resolve_public_file_path(string $path): ?string
{
    $normalized = trim($path);
    if ($normalized === '') {
        return null;
    }

    $parsedPath = parse_url($normalized, PHP_URL_PATH);
    $relativePath = is_string($parsedPath) && $parsedPath !== '' ? ltrim($parsedPath, '/') : ltrim($normalized, '/');
    if ($relativePath === '') {
        return null;
    }

    foreach (['api/', 'uploads/'] as $needle) {
        $position = strpos($relativePath, $needle);
        if ($position !== false) {
            $relativePath = substr($relativePath, $position);
            break;
        }
    }

    if (preg_match('#^uploads/#', $relativePath) === 1) {
        $relativePath = 'api/' . $relativePath;
    }

    if (preg_match('#^api/#', $relativePath) !== 1) {
        return null;
    }

    $candidatePath = jasti_root_path($relativePath);
    return is_file($candidatePath) ? $candidatePath : null;
}

function jasti_count_pdf_pages_from_file(string $path): int
{
    $absolutePath = jasti_resolve_public_file_path($path);
    if ($absolutePath === null || strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION)) !== 'pdf') {
        return 0;
    }

    $contents = file_get_contents($absolutePath);
    if ($contents === false || $contents === '') {
        return 0;
    }

    $pageMatches = [];
    preg_match_all('/\/Type\s*\/Page\b(?!s)/', $contents, $pageMatches);
    return count($pageMatches[0] ?? []);
}

function jasti_http_json_request(string $method, string $url, array $headers = [], ?array $payload = null): array
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

function jasti_first_journal_id(PDO $pdo): int
{
    $stmt = $pdo->query('SELECT journal_id FROM journals ORDER BY journal_id ASC LIMIT 1');
    $existing = $stmt->fetchColumn();
    if ($existing !== false) {
        return (int) $existing;
    }

    $settings = jasti_settings($pdo);
    $insert = $pdo->prepare(
        'INSERT INTO journals (journal_name, publisher, website, description)
         VALUES (:journal_name, :publisher, :website, :description)'
    );
    $insert->execute([
        'journal_name' => $settings['journal_name'],
        'publisher' => $settings['journal_acronym'],
        'website' => jasti_frontend_url(),
        'description' => $settings['homepage_tagline'],
    ]);

    return (int) $pdo->lastInsertId();
}

function jasti_users_with_roles(PDO $pdo): array
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

function jasti_public_upload_path(string $relativeDirectory): array
{
    $relativeDirectory = trim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativeDirectory), DIRECTORY_SEPARATOR);
    $storageRelativePath = preg_match('#^api(?:' . preg_quote(DIRECTORY_SEPARATOR, '#') . '|$)#', $relativeDirectory) === 1
        ? $relativeDirectory
        : 'api' . DIRECTORY_SEPARATOR . $relativeDirectory;
    $absoluteDirectory = jasti_root_path($storageRelativePath);
    if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0777, true) && !is_dir($absoluteDirectory)) {
        jasti_json(['message' => 'Unable to prepare upload directory.'], 500);
    }
    if (!is_writable($absoluteDirectory)) {
        @chmod($absoluteDirectory, 0777);
    }
    if (!is_writable($absoluteDirectory)) {
        jasti_json(['message' => 'Upload directory is not writable.'], 500);
    }
    $publicRelativePath = preg_replace('#^api' . preg_quote(DIRECTORY_SEPARATOR, '#') . '?#', '', $storageRelativePath);
    $publicBase = '/api/' . ltrim(str_replace(DIRECTORY_SEPARATOR, '/', (string) $publicRelativePath), '/');
    return [$absoluteDirectory, rtrim($publicBase, '/')];
}

function jasti_public_asset_exists(string $path): bool
{
    $normalized = trim($path);
    if ($normalized === '') {
        return false;
    }

    $parsedPath = parse_url($normalized, PHP_URL_PATH);
    $relativePath = is_string($parsedPath) && $parsedPath !== '' ? ltrim($parsedPath, '/') : ltrim($normalized, '/');
    if ($relativePath === '') {
        return false;
    }

    foreach (['api/', 'images/'] as $needle) {
        $position = strpos($relativePath, $needle);
        if ($position !== false) {
            $relativePath = substr($relativePath, $position);
            break;
        }
    }

    if (preg_match('#^uploads/#', $relativePath) === 1) {
        $relativePath = 'api/' . $relativePath;
    }

    if (preg_match('#^(?:api/|images/)#', $relativePath) !== 1) {
        return preg_match('/^https?:\/\//i', $normalized) === 1;
    }

    $candidatePaths = [jasti_root_path($relativePath)];
    if (preg_match('#^images/#', $relativePath) === 1) {
        $candidatePaths[] = jasti_root_path('public/' . $relativePath);
    }

    foreach ($candidatePaths as $candidatePath) {
        if (is_file($candidatePath)) {
            return true;
        }
    }

    return false;
}

function jasti_table_exists(PDO $pdo, string $tableName): bool
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
    $stmt->closeCursor();
    return $cache[$tableName];
}

function jasti_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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
    $stmt->closeCursor();
    return $cache[$key];
}

function jasti_index_exists(PDO $pdo, string $tableName, string $indexName): bool
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
    $stmt->closeCursor();
    return $cache[$key];
}

function jasti_constraint_exists(PDO $pdo, string $tableName, string $constraintName): bool
{
    static $cache = [];
    $key = $tableName . '.' . $constraintName;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND CONSTRAINT_NAME = :constraint_name'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'constraint_name' => $constraintName,
    ]);

    $cache[$key] = ((int) $stmt->fetchColumn()) > 0;
    $stmt->closeCursor();
    return $cache[$key];
}

function jasti_generate_reference_number(PDO $pdo): string
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

function jasti_ensure_manuscript_reference_number(PDO $pdo): void
{
    if (!jasti_column_exists($pdo, 'manuscripts', 'reference_number')) {
        $pdo->exec('ALTER TABLE manuscripts ADD COLUMN reference_number VARCHAR(32) NULL AFTER keywords');
    }

    if (!jasti_index_exists($pdo, 'manuscripts', 'idx_manuscripts_reference_number')) {
        $pdo->exec('CREATE UNIQUE INDEX idx_manuscripts_reference_number ON manuscripts (reference_number)');
    }

    $stmt = $pdo->query('SELECT manuscript_id FROM manuscripts WHERE reference_number IS NULL OR reference_number = ""');
    $update = $pdo->prepare('UPDATE manuscripts SET reference_number = :reference_number WHERE manuscript_id = :manuscript_id');
    foreach ($stmt->fetchAll() as $row) {
        $update->execute([
            'reference_number' => jasti_generate_reference_number($pdo),
            'manuscript_id' => (int) $row['manuscript_id'],
        ]);
    }
}

function jasti_ensure_manuscript_scope_schema(PDO $pdo): void
{
    if (!jasti_column_exists($pdo, 'manuscripts', 'scope_area')) {
        $pdo->exec('ALTER TABLE manuscripts ADD COLUMN scope_area VARCHAR(255) NULL AFTER title');
    }
}

function jasti_ensure_technical_screening_schema(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'technical_screenings')) {
        $pdo->exec(
            'CREATE TABLE technical_screenings (
                screening_id INT AUTO_INCREMENT PRIMARY KEY,
                manuscript_id INT NOT NULL,
                technical_editor_id INT NULL,
                status VARCHAR(32) NOT NULL DEFAULT "pending",
                anonymized_file_path VARCHAR(255) NULL,
                grammar_quality DECIMAL(5,2) NULL,
                ai_score DECIMAL(5,2) NULL,
                similarity_score DECIMAL(5,2) NULL,
                editor_decision VARCHAR(32) NULL,
                editor_rejection_reason TEXT NULL,
                attended_at DATETIME NULL,
                editor_decided_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_technical_screenings_manuscript (manuscript_id),
                KEY idx_technical_screenings_status (status),
                CONSTRAINT fk_technical_screenings_manuscript FOREIGN KEY (manuscript_id) REFERENCES manuscripts (manuscript_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    foreach ([
        'technical_editor_id' => 'INT NULL AFTER manuscript_id',
        'status' => 'VARCHAR(32) NOT NULL DEFAULT "pending" AFTER technical_editor_id',
        'anonymized_file_path' => 'VARCHAR(255) NULL AFTER status',
        'grammar_quality' => 'DECIMAL(5,2) NULL AFTER anonymized_file_path',
        'ai_score' => 'DECIMAL(5,2) NULL AFTER grammar_quality',
        'similarity_score' => 'DECIMAL(5,2) NULL AFTER ai_score',
        'editor_decision' => 'VARCHAR(32) NULL AFTER similarity_score',
        'editor_rejection_reason' => 'TEXT NULL AFTER editor_decision',
        'attended_at' => 'DATETIME NULL AFTER editor_rejection_reason',
        'editor_decided_at' => 'DATETIME NULL AFTER attended_at',
    ] as $column => $definition) {
        if (!jasti_column_exists($pdo, 'technical_screenings', $column)) {
            $pdo->exec(sprintf('ALTER TABLE technical_screenings ADD COLUMN %s %s', $column, $definition));
        }
    }

    try {
        $pdo->exec(
            "ALTER TABLE manuscripts MODIFY status ENUM('submitted','editor_screening','under_review','revision_required','accepted','rejected','production','published') DEFAULT 'submitted'"
        );
    } catch (Throwable $exception) {
        error_log('JASTI manuscript status enum update skipped: ' . $exception->getMessage());
    }
}

function jasti_ensure_peer_review_schema(PDO $pdo): void
{
    if (jasti_table_exists($pdo, 'review_invitations')) {
        $invitationColumns = [
        'review_deadline' => 'DATETIME NULL AFTER response_date',
        'review_model' => 'VARCHAR(32) NOT NULL DEFAULT "single_blind" AFTER review_deadline',
        'extension_requested' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER review_model',
        'extension_reason' => 'TEXT NULL AFTER extension_requested',
        'extension_requested_at' => 'DATETIME NULL AFTER extension_reason',
        'deadline_reminder_3d_at' => 'DATETIME NULL AFTER extension_requested_at',
        'deadline_reminder_2d_at' => 'DATETIME NULL AFTER deadline_reminder_3d_at',
        'deadline_reminder_1d_at' => 'DATETIME NULL AFTER deadline_reminder_2d_at',
        ];

        foreach ($invitationColumns as $column => $definition) {
            if (!jasti_column_exists($pdo, 'review_invitations', $column)) {
                $pdo->exec(sprintf('ALTER TABLE review_invitations ADD COLUMN %s %s', $column, $definition));
            }
        }
    }

    if (!jasti_table_exists($pdo, 'reviews')) {
        return;
    }

    $reviewColumns = [
        'no_personal_conflict' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER comments_to_author',
        'no_institutional_conflict' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER no_personal_conflict',
        'no_financial_conflict' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER no_institutional_conflict',
        'conflict_confirmed' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER no_financial_conflict',
        'confidentiality_agreed' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER conflict_confirmed',
        'comments_strengths' => 'TEXT NULL AFTER confidentiality_agreed',
        'comments_weaknesses' => 'TEXT NULL AFTER comments_strengths',
        'comments_required_corrections' => 'TEXT NULL AFTER comments_weaknesses',
        'comments_suggestions' => 'TEXT NULL AFTER comments_required_corrections',
        'ethical_concerns' => 'TEXT NULL AFTER comments_suggestions',
        'suspected_plagiarism' => 'TEXT NULL AFTER ethical_concerns',
        'recommendation_justification' => 'TEXT NULL AFTER suspected_plagiarism',
        'publication_risk_concerns' => 'TEXT NULL AFTER recommendation_justification',
        'score_relevance' => 'INT NULL AFTER score_novelty',
        'score_technical_quality' => 'INT NULL AFTER score_relevance',
        'score_literature_review' => 'INT NULL AFTER score_methodology',
        'score_data_analysis' => 'INT NULL AFTER score_literature_review',
        'score_grammar_language' => 'INT NULL AFTER score_clarity',
        'score_references_quality' => 'INT NULL AFTER score_grammar_language',
        'score_ethical_compliance' => 'INT NULL AFTER score_references_quality',
        'score_contribution' => 'INT NULL AFTER score_significance',
        'total_score' => 'INT NULL AFTER score_contribution',
        'score_percent' => 'DECIMAL(5,2) NULL AFTER total_score',
        'possible_plagiarism_detected' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER score_percent',
        'ai_generated_content_suspected' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER possible_plagiarism_detected',
        'fabricated_data_concerns' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER ai_generated_content_suspected',
        'ethical_approval_missing' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER fabricated_data_concerns',
        'citation_manipulation' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER ethical_approval_missing',
        'duplicate_publication_suspicion' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER citation_manipulation',
        'screenshot_attachment' => 'VARCHAR(255) NULL AFTER duplicate_publication_suspicion',
        'editor_quality_rating' => 'INT NULL AFTER screenshot_attachment',
    ];

    foreach ($reviewColumns as $column => $definition) {
        if (!jasti_column_exists($pdo, 'reviews', $column)) {
            $pdo->exec(sprintf('ALTER TABLE reviews ADD COLUMN %s %s', $column, $definition));
        }
    }

    try {
        $pdo->exec(
            "ALTER TABLE reviews MODIFY recommendation ENUM('accept','minor_revision','major_revision','reject','resubmit_new_review') DEFAULT NULL"
        );
    } catch (Throwable $exception) {
        error_log('JASTI review recommendation enum update skipped: ' . $exception->getMessage());
    }

    if (jasti_table_exists($pdo, 'editor_decisions')) {
        $decisionColumns = [
            'journal_suitability' => 'VARCHAR(32) NULL AFTER decision_letter',
            'scientific_merit' => 'VARCHAR(32) NULL AFTER journal_suitability',
            'innovation_level' => 'VARCHAR(32) NULL AFTER scientific_merit',
            'ethical_compliance' => 'VARCHAR(32) NULL AFTER innovation_level',
            'language_quality' => 'VARCHAR(32) NULL AFTER ethical_compliance',
            'editorial_notes' => 'TEXT NULL AFTER language_quality',
            'decision_justification' => 'TEXT NULL AFTER editorial_notes',
            'transfer_journal' => 'VARCHAR(255) NULL AFTER decision_justification',
            'send_additional_review' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER transfer_journal',
        ];

        foreach ($decisionColumns as $column => $definition) {
            if (!jasti_column_exists($pdo, 'editor_decisions', $column)) {
                $pdo->exec(sprintf('ALTER TABLE editor_decisions ADD COLUMN %s %s', $column, $definition));
            }
        }
    }
}

function jasti_ensure_article_archive_schema(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'articles')) {
        return;
    }

    $columns = [
        'archived' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER article_url',
        'archived_at' => 'DATETIME NULL AFTER archived',
        'archived_by' => 'INT NULL AFTER archived_at',
    ];

    foreach ($columns as $column => $definition) {
        if (!jasti_column_exists($pdo, 'articles', $column)) {
            $pdo->exec(sprintf('ALTER TABLE articles ADD COLUMN %s %s', $column, $definition));
        }
    }
}

function jasti_process_review_deadline_reminders(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'review_invitations')) {
        return;
    }
    jasti_ensure_peer_review_schema($pdo);

    $windows = [
        3 => 'deadline_reminder_3d_at',
        2 => 'deadline_reminder_2d_at',
        1 => 'deadline_reminder_1d_at',
    ];

    foreach ($windows as $days => $column) {
        $stmt = $pdo->prepare(
            "SELECT ri.invitation_id, ri.manuscript_id, ri.review_deadline, u.email, u.first_name, u.last_name,
                    m.title, m.reference_number
             FROM review_invitations ri
             INNER JOIN users u ON u.user_id = ri.reviewer_id
             INNER JOIN manuscripts m ON m.manuscript_id = ri.manuscript_id
             WHERE ri.response = \"accepted\"
               AND ri.review_deadline IS NOT NULL
               AND ri.{$column} IS NULL
               AND m.status <> \"published\"
               AND NOT EXISTS (
                   SELECT 1 FROM reviews rv
                   WHERE rv.manuscript_id = ri.manuscript_id
                     AND rv.reviewer_id = ri.reviewer_id
               )
               AND TIMESTAMPDIFF(HOUR, NOW(), ri.review_deadline) BETWEEN :min_hours AND :max_hours"
        );
        $stmt->execute([
            'min_hours' => ($days - 1) * 24,
            'max_hours' => $days * 24,
        ]);

        $markStmt = $pdo->prepare("UPDATE review_invitations SET {$column} = CURRENT_TIMESTAMP WHERE invitation_id = :invitation_id");
        foreach ($stmt->fetchAll() as $row) {
            $email = trim((string) ($row['email'] ?? ''));
            if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
                $deadline = (string) ($row['review_deadline'] ?? '');
                $reference = trim((string) ($row['reference_number'] ?? '')) ?: ('Manuscript #' . (int) $row['manuscript_id']);
                $title = trim((string) ($row['title'] ?? ''));
                $name = trim((string) (($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''))) ?: 'Reviewer';
                $message = "Dear {$name},\n\nThis is an automatic JASTI reminder that your review for {$reference}"
                    . ($title !== '' ? " ({$title})" : '')
                    . " is due in {$days} day" . ($days === 1 ? '' : 's') . ".\n\nDeadline: {$deadline}\n\nPlease sign in to the reviewer dashboard to submit, save a draft, request an extension, or decline if you can no longer complete the review.\n\nThank you.";
                try {
                    jasti_send_html_email(
                        $email,
                        "JASTI review deadline reminder: {$days} day" . ($days === 1 ? '' : 's') . " remaining",
                        nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')),
                        $message
                    );
                } catch (Throwable $exception) {
                    error_log(sprintf('Review deadline reminder failed for invitation %d: %s', (int) $row['invitation_id'], $exception->getMessage()));
                }
            }
            $markStmt->execute(['invitation_id' => (int) $row['invitation_id']]);
        }
    }
}

function jasti_ensure_message_thread_schema(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'messages')) {
        return;
    }

    $columns = [
        'parent_message_id' => 'INT NULL AFTER message_id',
        'email_sent' => 'TINYINT(1) NOT NULL DEFAULT 0 AFTER read_status',
        'email_status' => 'VARCHAR(255) NULL AFTER email_sent',
        'email_attempts' => 'INT NOT NULL DEFAULT 0 AFTER email_status',
        'next_email_retry_at' => 'DATETIME NULL AFTER email_attempts',
    ];

    foreach ($columns as $column => $definition) {
        if (!jasti_column_exists($pdo, 'messages', $column)) {
            $pdo->exec(sprintf('ALTER TABLE messages ADD COLUMN %s %s', $column, $definition));
        }
    }
}

function jasti_retry_failed_message_emails(PDO $pdo, int $limit = 10): void
{
    if (!jasti_table_exists($pdo, 'messages')) {
        return;
    }
    jasti_ensure_message_thread_schema($pdo);

    $stmt = $pdo->prepare(
        'SELECT m.message_id, m.subject, m.message_body, m.email_attempts,
                s.first_name AS sender_first_name, s.last_name AS sender_last_name,
                r.email AS receiver_email, r.first_name AS receiver_first_name, r.last_name AS receiver_last_name
         FROM messages m
         LEFT JOIN users s ON s.user_id = m.sender_id
         LEFT JOIN users r ON r.user_id = m.receiver_id
         WHERE COALESCE(m.email_sent, 0) = 0
           AND COALESCE(m.email_attempts, 0) < 5
           AND (m.next_email_retry_at IS NULL OR m.next_email_retry_at <= NOW())
         ORDER BY m.sent_date ASC
         LIMIT ' . max(1, min(50, $limit))
    );
    $stmt->execute();

    $update = $pdo->prepare(
        'UPDATE messages
         SET email_sent = :email_sent,
             email_status = :email_status,
             email_attempts = email_attempts + 1,
             next_email_retry_at = :next_email_retry_at
         WHERE message_id = :message_id'
    );

    foreach ($stmt->fetchAll() as $row) {
        $email = trim((string) ($row['receiver_email'] ?? ''));
        $attempts = (int) ($row['email_attempts'] ?? 0);
        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $update->execute([
                'email_sent' => 0,
                'email_status' => 'Retry skipped: receiver email is unavailable.',
                'next_email_retry_at' => null,
                'message_id' => (int) $row['message_id'],
            ]);
            continue;
        }

        $senderName = trim((string) (($row['sender_first_name'] ?? '') . ' ' . ($row['sender_last_name'] ?? ''))) ?: 'JASTI editorial office';
        $receiverName = trim((string) (($row['receiver_first_name'] ?? '') . ' ' . ($row['receiver_last_name'] ?? ''))) ?: $email;
        $subject = (string) ($row['subject'] ?? 'JASTI workspace message');
        $body = (string) ($row['message_body'] ?? '');
        $mailText = "Dear {$receiverName},\n\n{$senderName} sent you a JASTI workspace message.\n\nSubject: {$subject}\n\n{$body}\n\nPlease sign in to your dashboard to reply or view the full communication history.";

        try {
            jasti_send_html_email(
                $email,
                'JASTI message: ' . $subject,
                nl2br(htmlspecialchars($mailText, ENT_QUOTES, 'UTF-8')),
                $mailText
            );
            $update->execute([
                'email_sent' => 1,
                'email_status' => 'Email sent by retry worker.',
                'next_email_retry_at' => null,
                'message_id' => (int) $row['message_id'],
            ]);
        } catch (Throwable $exception) {
            $delayMinutes = min(1440, (int) pow(2, min(8, $attempts)) * 5);
            $update->execute([
                'email_sent' => 0,
                'email_status' => 'Email retry failed: ' . substr($exception->getMessage(), 0, 220),
                'next_email_retry_at' => date('Y-m-d H:i:s', time() + ($delayMinutes * 60)),
                'message_id' => (int) $row['message_id'],
            ]);
        }
    }
}

function jasti_ensure_manuscript_author_schema(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'manuscript_authors')) {
        $pdo->exec(
            'CREATE TABLE manuscript_authors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                manuscript_id INT NOT NULL,
                author_id INT NULL,
                author_order INT NOT NULL DEFAULT 1,
                is_corresponding BOOLEAN DEFAULT FALSE,
                affiliation VARCHAR(255) NULL,
                author_name VARCHAR(255) NULL,
                author_email VARCHAR(255) NULL,
                CONSTRAINT fk_manuscript_authors_manuscript FOREIGN KEY (manuscript_id) REFERENCES manuscripts (manuscript_id) ON DELETE CASCADE,
                CONSTRAINT fk_manuscript_authors_user FOREIGN KEY (author_id) REFERENCES users (user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        return;
    }

    foreach ([
        'author_name' => 'VARCHAR(255) NULL AFTER affiliation',
        'author_email' => 'VARCHAR(255) NULL AFTER author_name',
    ] as $column => $definition) {
        if (jasti_column_exists($pdo, 'manuscript_authors', $column)) {
            continue;
        }

        try {
            $pdo->exec(sprintf('ALTER TABLE manuscript_authors ADD COLUMN %s %s', $column, $definition));
        } catch (Throwable $exception) {
            error_log(sprintf('Unable to add manuscript_authors.%s: %s', $column, $exception->getMessage()));
        }
    }

    try {
        $authorIdColumn = $pdo->query(
            'SELECT IS_NULLABLE
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = "manuscript_authors"
               AND COLUMN_NAME = "author_id"
             LIMIT 1'
        )->fetchColumn();

        if (strtoupper((string) $authorIdColumn) !== 'YES') {
            $pdo->exec('ALTER TABLE manuscript_authors MODIFY author_id INT NULL');
        }
    } catch (Throwable $exception) {
        error_log('Unable to relax manuscript_authors.author_id nullability: ' . $exception->getMessage());
    }
}

function jasti_email_verification_schema_ready(PDO $pdo): bool
{
    return jasti_column_exists($pdo, 'users', 'email_verified_at')
        && jasti_column_exists($pdo, 'users', 'email_verification_token')
        && jasti_column_exists($pdo, 'users', 'email_verification_sent_at')
        && jasti_column_exists($pdo, 'users', 'email_verification_expires_at');
}

function jasti_ensure_onboarding_review_columns(PDO $pdo, string $tableName): void
{
    $tableName = trim($tableName);
    if ($tableName === '' || !jasti_table_exists($pdo, $tableName)) {
        return;
    }

    $columns = [
        'reviewed_at' => 'TIMESTAMP NULL',
        'reviewed_by' => 'INT NULL',
        'rejection_reason' => 'TEXT NULL',
        'acceptance_notes' => 'TEXT NULL',
    ];

    foreach ($columns as $column => $definition) {
        if (jasti_column_exists($pdo, $tableName, $column)) {
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

function jasti_frontend_url(string $path = ''): string
{
    $base = rtrim((string) jasti_env('FRONTEND_APP_URL', ''), '/');
    if ($base === '') {
        $scheme = jasti_is_https() ? 'https://' : 'http://';
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $base = $scheme . $host;
    }
    if ($path === '') {
        return $base;
    }
    return $base . '/' . ltrim($path, '/');
}

function jasti_dashboard_action_url(string $role, string $section): string
{
    $role = jasti_normalize_role($role);
    $section = trim($section);
    if ($section === '') {
        $section = 'overview';
    }

    $loginPath = match ($role) {
        'reviewer' => 'login/reviewer',
        'admin' => 'login/admin',
        'editor', 'editor_in_chief', 'managing_editor', 'section_editor', 'technical_editor', 'advisory_board' => 'login/editor',
        default => 'login/author',
    };

    $redirect = '/dashboard?role=' . rawurlencode($role) . '&section=' . rawurlencode($section);
    return jasti_frontend_url($loginPath . '?redirect=' . rawurlencode($redirect));
}

function jasti_backend_url(string $path = ''): string
{
    $base = rtrim((string) jasti_env('BACKEND_APP_URL', ''), '/');
    if ($base === '') {
        $scheme = jasti_is_https() ? 'https://' : 'http://';
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

function jasti_increment_article_metrics(PDO $pdo, int $articleId, array $increments): void
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

function jasti_public_asset_url(string $path): string
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

    return jasti_backend_url(ltrim($path, '/'));
}

function jasti_issue_email_verification(PDO $pdo, int $userId, string $email): array
{
    if (!jasti_email_verification_schema_ready($pdo)) {
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
        'link' => jasti_backend_url('api/auth/verify_email.php?token=' . urlencode($verificationToken) . '&email=' . urlencode($email)),
        'sent_at' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'expires_at' => $verificationExpiresAt,
    ];
}

function jasti_password_reset_schema_ready(PDO $pdo): bool
{
    return jasti_column_exists($pdo, 'users', 'password_reset_token')
        && jasti_column_exists($pdo, 'users', 'password_reset_sent_at')
        && jasti_column_exists($pdo, 'users', 'password_reset_expires_at');
}

function jasti_issue_password_reset(PDO $pdo, int $userId, string $email): array
{
    if (!jasti_password_reset_schema_ready($pdo)) {
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
        'link' => jasti_frontend_url('portal?reset_password=1&token=' . urlencode($resetToken) . '&email=' . urlencode($email)),
        'sent_at' => (new DateTimeImmutable())->format('Y-m-d H:i:s'),
        'expires_at' => $resetExpiresAt,
    ];
}

function jasti_send_html_email(string $userEmail, string $subject, string $htmlBody, string $altBody): void
{
    $composerAutoload = jasti_root_path('vendor/autoload.php');
    if (is_file($composerAutoload)) {
        require_once $composerAutoload;
    } else {
        $candidateRoots = [
            jasti_root_path('PHPMailer/src'),
            jasti_root_path('api/PHPMailer/src'),
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

    $host = trim((string) jasti_env('SMTP_HOST', ''));
    if ($host === '') {
        throw new RuntimeException('SMTP host is not configured.');
    }

    $secure = strtolower(trim((string) jasti_env('SMTP_SECURE', 'ssl')));
    $port = (int) jasti_env('SMTP_PORT', '465');
    $timeout = max(5, (int) jasti_env('SMTP_TIMEOUT', '20'));
    $username = trim((string) jasti_env('SMTP_USERNAME', ''));
    if ($username === '' || !str_contains($username, '@')) {
        throw new RuntimeException('SMTP_USERNAME must be the full mailbox address.');
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
            $mail->Password = (string) jasti_env('SMTP_PASSWORD', '');
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
            $fromAddress = (string) jasti_env('MAIL_FROM_ADDRESS', 'support@pasacouncil.org');
            $fromName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
            $mail->CharSet = 'UTF-8';
            $mail->Encoding = 'base64';
            $mail->setFrom(
                $fromAddress,
                $fromName
            );
            $mail->addReplyTo($fromAddress, $fromName);
            $mail->Sender = $fromAddress;
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

    throw new RuntimeException('SMTP delivery failed. Attempts: ' . implode(' | ', $attempts));
}

function jasti_send_verification_email(string $userEmail, string $verificationLink): void
{
    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
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

    jasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function jasti_send_password_reset_email(string $userEmail, string $resetLink): void
{
    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
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

    jasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function jasti_send_manuscript_submission_email(string $userEmail, string $authorName, array $details): void
{
    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeAuthorName = htmlspecialchars(trim($authorName) !== '' ? $authorName : $userEmail, ENT_QUOTES, 'UTF-8');
    $safeTitle = htmlspecialchars((string) ($details['title'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeReferenceNumber = htmlspecialchars((string) ($details['reference_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeArticleType = htmlspecialchars((string) ($details['article_type'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeSubmissionDate = htmlspecialchars((string) ($details['submission_date'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeAuthorList = htmlspecialchars((string) ($details['author_list'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($userEmail, ENT_QUOTES, 'UTF-8');
    $submissionFee = (string) ($details['submission_fee'] ?? '');
    $submissionPaymentLink = trim((string) ($details['submission_payment_link'] ?? ''));
    $safeSubmissionFee = htmlspecialchars($submissionFee, ENT_QUOTES, 'UTF-8');
    $safeSubmissionPaymentLink = htmlspecialchars($submissionPaymentLink, ENT_QUOTES, 'UTF-8');
    $subject = $journalName . ' Manuscript Submission Received';
    $paymentNotice = '';
    if ($submissionPaymentLink !== '') {
        $paymentNotice = <<<HTML
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#184d44;">Action needed</p>
                    <p style="margin:0 0 14px;font-size:14px;line-height:1.8;color:#334155;">Please complete the submission screening fee{$safeSubmissionFee} before the Technical Editor can view or download your manuscript.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" bgcolor="#184d44" style="border-radius:10px;box-shadow:0 10px 24px rgba(24,77,68,0.2);">
                          <a href="{$safeSubmissionPaymentLink}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Pay submission fee</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
HTML;
    }
    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$journalName} Manuscript Submission Received</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 38%,#f7fafc 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#184d44 0%,#1f6b5c 52%,#0b6fa4 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;">Submission received successfully</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;opacity:0.95;">Your manuscript package has been recorded and is ready for editorial screening.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff8f4;color:#184d44;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Author Confirmation</div>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">Dear <strong>{$safeAuthorName}</strong>, your manuscript submission has been received for processing under the JASTI workflow.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#184d44;">Submission reference</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">{$safeReferenceNumber}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:separate;border-spacing:0 10px;">
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Title</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeTitle}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Article type</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeArticleType}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Submitted on</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeSubmissionDate}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Corresponding author email</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeEmail}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Author list</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeAuthorList}</td>
                </tr>
              </table>
{$paymentNotice}
              <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;">Please keep this reference number for any follow-up communication. The editorial team will contact you through the author workspace as your manuscript advances.</p>
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

    $altBody = implode("\n", [
        $journalName . ' submission confirmation',
        'Reference: ' . (string) ($details['reference_number'] ?? ''),
        'Title: ' . (string) ($details['title'] ?? ''),
        'Article type: ' . (string) ($details['article_type'] ?? ''),
        'Submitted on: ' . (string) ($details['submission_date'] ?? ''),
        'Author list: ' . (string) ($details['author_list'] ?? ''),
        $submissionPaymentLink !== '' ? 'Action needed: Pay the submission screening fee' . $submissionFee . ' at ' . $submissionPaymentLink : '',
    ]);

    jasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function jasti_send_manuscript_published_email(string $userEmail, string $authorName, array $details): void
{
    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeAuthorName = htmlspecialchars(trim($authorName) !== '' ? $authorName : $userEmail, ENT_QUOTES, 'UTF-8');
    $safeTitle = htmlspecialchars((string) ($details['title'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeReferenceNumber = htmlspecialchars((string) ($details['reference_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeJournalName = htmlspecialchars((string) ($details['journal_name'] ?? $journalName), ENT_QUOTES, 'UTF-8');
    $safeIssueLabel = htmlspecialchars((string) ($details['issue_label'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safePublicationDate = htmlspecialchars((string) ($details['publication_date'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safePageNumbers = htmlspecialchars((string) ($details['page_numbers'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeDoi = htmlspecialchars((string) ($details['doi'] ?? ''), ENT_QUOTES, 'UTF-8');
    $articleLink = trim((string) ($details['article_link'] ?? ''));
    $pdfLink = trim((string) ($details['pdf_link'] ?? ''));
    $safeArticleLink = htmlspecialchars($articleLink, ENT_QUOTES, 'UTF-8');
    $safePdfLink = htmlspecialchars($pdfLink, ENT_QUOTES, 'UTF-8');
    $subject = $journalName . ' Manuscript Published';

    $issueRow = '';
    if ($safeIssueLabel !== '') {
        $issueRow = <<<HTML
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Issue</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeIssueLabel}</td>
                </tr>
HTML;
    }

    $pageRow = '';
    if ($safePageNumbers !== '') {
        $pageRow = <<<HTML
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Pages</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safePageNumbers}</td>
                </tr>
HTML;
    }

    $doiRow = '';
    if ($safeDoi !== '') {
        $doiRow = <<<HTML
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">DOI</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeDoi}</td>
                </tr>
HTML;
    }

    $articleButton = '';
    if ($safeArticleLink !== '') {
        $articleButton = <<<HTML
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 12px 12px 0;display:inline-table;">
                <tr>
                  <td align="center" bgcolor="#0b6fa4" style="border-radius:10px;box-shadow:0 10px 24px rgba(11,111,164,0.2);">
                    <a href="{$safeArticleLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">View published article</a>
                  </td>
                </tr>
              </table>
HTML;
    }

    $pdfButton = '';
    if ($safePdfLink !== '') {
        $pdfButton = <<<HTML
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 12px;display:inline-table;">
                <tr>
                  <td align="center" bgcolor="#184d44" style="border-radius:10px;box-shadow:0 10px 24px rgba(24,77,68,0.2);">
                    <a href="{$safePdfLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Download PDF</a>
                  </td>
                </tr>
              </table>
HTML;
    }

    $linkSection = '';
    if ($articleButton !== '' || $pdfButton !== '') {
        $linkSection = <<<HTML
              {$articleButton}
              {$pdfButton}
HTML;
    }

    $linkCopy = '';
    if ($safeArticleLink !== '') {
        $linkCopy .= <<<HTML
              <p style="margin:12px 0 10px;font-size:13px;line-height:1.7;color:#475569;">Public article link:</p>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.7;word-break:break-all;color:#0b6fa4;"><a href="{$safeArticleLink}" style="color:#0b6fa4;text-decoration:underline;">{$safeArticleLink}</a></p>
HTML;
    }
    if ($safePdfLink !== '' && $safePdfLink !== $safeArticleLink) {
        $linkCopy .= <<<HTML
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">PDF download link:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;color:#184d44;"><a href="{$safePdfLink}" style="color:#184d44;text-decoration:underline;">{$safePdfLink}</a></p>
HTML;
    }

    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$journalName} Manuscript Published</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 38%,#f7fafc 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0b6fa4 0%,#184d44 52%,#083b5c 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;">Your manuscript has been published</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;opacity:0.95;">The editorial workflow is complete and your article is now available in the journal archive.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff6fb;color:#0b6fa4;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Publication Notice</div>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">Dear <strong>{$safeAuthorName}</strong>, we are pleased to let you know that your manuscript has now been published in <strong>{$safeJournalName}</strong>.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#0b6fa4;">Publication reference</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">{$safeReferenceNumber}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:separate;border-spacing:0 10px;">
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Title</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeTitle}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Published on</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safePublicationDate}</td>
                </tr>
{$issueRow}
{$pageRow}
{$doiRow}
              </table>
{$linkSection}
{$linkCopy}
              <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;">Thank you for publishing with {$safeJournalName}. You can share the published article link with colleagues, collaborators, and readers.</p>
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

    $altBody = implode("\n", array_values(array_filter([
        $journalName . ' publication notice',
        'Reference: ' . (string) ($details['reference_number'] ?? ''),
        'Title: ' . (string) ($details['title'] ?? ''),
        'Journal: ' . (string) ($details['journal_name'] ?? $journalName),
        'Published on: ' . (string) ($details['publication_date'] ?? ''),
        ($details['issue_label'] ?? '') !== '' ? 'Issue: ' . (string) $details['issue_label'] : '',
        ($details['page_numbers'] ?? '') !== '' ? 'Pages: ' . (string) $details['page_numbers'] : '',
        ($details['doi'] ?? '') !== '' ? 'DOI: ' . (string) $details['doi'] : '',
        ($details['article_link'] ?? '') !== '' ? 'Article link: ' . (string) $details['article_link'] : '',
        ($details['pdf_link'] ?? '') !== '' ? 'PDF link: ' . (string) $details['pdf_link'] : '',
    ])));

    jasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function jasti_send_manuscript_payment_request_email(string $userEmail, string $authorName, array $details, bool $isReminder = false): void
{
    $journalName = (string) jasti_env('MAIL_BRAND_NAME', 'JASTI');
    $supportName = (string) jasti_env('MAIL_FROM_NAME', 'PASAC Support');
    $safeAuthorName = htmlspecialchars(trim($authorName) !== '' ? $authorName : $userEmail, ENT_QUOTES, 'UTF-8');
    $safeTitle = htmlspecialchars((string) ($details['title'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeReferenceNumber = htmlspecialchars((string) ($details['reference_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeJournalName = htmlspecialchars((string) ($details['journal_name'] ?? $journalName), ENT_QUOTES, 'UTF-8');
    $safeDecisionDate = htmlspecialchars((string) ($details['decision_date'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeRemarks = htmlspecialchars((string) ($details['remarks'] ?? ''), ENT_QUOTES, 'UTF-8');
    $authorLoginLink = (string) ($details['author_login_link'] ?? jasti_dashboard_action_url('author', 'metrics'));
    $safeAuthorLoginLink = htmlspecialchars($authorLoginLink, ENT_QUOTES, 'UTF-8');
    $paymentBaseAmount = htmlspecialchars(jasti_format_naira_amount(jasti_manuscript_payment_base_amount()), ENT_QUOTES, 'UTF-8');
    $includedPages = jasti_manuscript_payment_included_pages();
    $extraPageAmount = htmlspecialchars(jasti_format_naira_amount(jasti_manuscript_payment_extra_page_amount()), ENT_QUOTES, 'UTF-8');
    $feePolicy = sprintf(
        '%s covers up to %d manuscript pages. Pages above %d cost %s per page.',
        $paymentBaseAmount,
        $includedPages,
        $includedPages,
        $extraPageAmount
    );
    $safeFeePolicy = htmlspecialchars($feePolicy, ENT_QUOTES, 'UTF-8');
    $subject = $isReminder
        ? $journalName . ' Payment Reminder for Accepted Manuscript'
        : $journalName . ' Manuscript Accepted - Payment Required';
    $headline = $isReminder ? 'Payment reminder for your accepted manuscript' : 'Your manuscript has been accepted';
    $badgeText = $isReminder ? 'Payment Reminder' : 'Acceptance Notice';
    $introText = $isReminder
        ? 'Your manuscript is still waiting for author payment before it can move into publication.'
        : 'Your manuscript has been accepted and is now waiting for author payment before publication can proceed.';
    $bodyText = $isReminder
        ? "Dear <strong>{$safeAuthorName}</strong>, this is a reminder to log in to your author account and complete the required payment for your accepted manuscript in <strong>{$safeJournalName}</strong>."
        : "Dear <strong>{$safeAuthorName}</strong>, we are pleased to let you know that your manuscript has been accepted in <strong>{$safeJournalName}</strong>. Please log in to your author account and complete the required payment so the article can move forward to publication.";

    $remarksBlock = '';
    if ($safeRemarks !== '') {
        $remarksBlock = <<<HTML
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#184d44;">Editorial remarks</p>
                    <p style="margin:0;font-size:14px;line-height:1.8;color:#334155;">{$safeRemarks}</p>
                  </td>
                </tr>
              </table>
HTML;
    }

    $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{$subject}</title>
</head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at top left,#dbeef8 0%,#eef4f8 38%,#f7fafc 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e3ec;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(8,59,92,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#184d44 0%,#0b6fa4 52%,#083b5c 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;opacity:0.9;">{$journalName}</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;">{$headline}</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.7;opacity:0.95;">{$introText}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;margin-bottom:18px;padding:6px 10px;border-radius:999px;background:#eff8f4;color:#184d44;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">{$badgeText}</div>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">{$bodyText}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #d7e4ed;border-radius:12px;background:#f8fbfd;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#184d44;">Manuscript reference</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">{$safeReferenceNumber}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:separate;border-spacing:0 10px;">
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Title</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeTitle}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Decision date</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeDecisionDate}</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Next step</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">Log in as an author and complete your manuscript payment.</td>
                </tr>
                <tr>
                  <td style="width:180px;font-size:13px;font-weight:700;color:#475569;vertical-align:top;">Payment fee</td>
                  <td style="font-size:14px;line-height:1.7;color:#0f172a;">{$safeFeePolicy}</td>
                </tr>
              </table>
{$remarksBlock}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#184d44" style="border-radius:10px;box-shadow:0 10px 24px rgba(24,77,68,0.2);">
                    <a href="{$safeAuthorLoginLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Pay publication fee</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">If the button does not open, copy and paste this URL into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;color:#184d44;"><a href="{$safeAuthorLoginLink}" style="color:#184d44;text-decoration:underline;">{$safeAuthorLoginLink}</a></p>
              <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;">If you have already completed the payment, you can ignore this message.</p>
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

    $altBody = implode("\n", array_values(array_filter([
        $subject,
        'Reference: ' . (string) ($details['reference_number'] ?? ''),
        'Title: ' . (string) ($details['title'] ?? ''),
        'Decision date: ' . (string) ($details['decision_date'] ?? ''),
        'Payment fee: ' . $feePolicy,
        'Next step: Log in as an author and complete payment.',
        ($details['remarks'] ?? '') !== '' ? 'Remarks: ' . (string) $details['remarks'] : '',
        'Payment link: ' . $authorLoginLink,
    ])));

    jasti_send_html_email($userEmail, $subject, $htmlBody, $altBody);
}

function jasti_upload_error_message(int $error): string
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

function jasti_store_uploaded_image(array $file, string $relativeDirectory, string $prefix): string
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        jasti_json(['message' => jasti_upload_error_message($error)], 422);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $maxBytes = (int) jasti_env('MAX_UPLOAD_SIZE_BYTES', (string) (5 * 1024 * 1024));
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        $maxMb = number_format($maxBytes / 1048576, 0);
        jasti_json(['message' => "Image exceeds the {$maxMb}MB size limit."], 422);
    }
    $mime = mime_content_type((string) $file['tmp_name']);
    if (!isset($allowed[$mime])) {
        jasti_json(['message' => 'Only JPG, PNG, and WEBP images are allowed.'], 422);
    }

    [$absoluteDirectory, $publicBase] = jasti_public_upload_path($relativeDirectory);
    $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(8)), $allowed[$mime]);
    $absolutePath = $absoluteDirectory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
        jasti_json(['message' => 'Unable to save uploaded image.'], 500);
    }

    return $publicBase . '/' . $filename;
}

function jasti_store_uploaded_file(array $file, string $relativeDirectory, string $prefix, array $allowedMimeMap, ?int $maxBytes = null): string
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        jasti_json(['message' => jasti_upload_error_message($error)], 422);
    }

    $maxBytes ??= (int) jasti_env('MAX_UPLOAD_SIZE_BYTES', (string) (10 * 1024 * 1024));
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        $maxMb = number_format($maxBytes / 1048576, 0);
        jasti_json(['message' => "Uploaded file exceeds the {$maxMb}MB size limit."], 422);
    }

    $mime = mime_content_type((string) $file['tmp_name']);
    if (!isset($allowedMimeMap[$mime])) {
        jasti_json(['message' => 'Unsupported file format uploaded for this field.'], 422);
    }

    [$absoluteDirectory, $publicBase] = jasti_public_upload_path($relativeDirectory);
    $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(8)), $allowedMimeMap[$mime]);
    $absolutePath = $absoluteDirectory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
        jasti_json(['message' => 'Unable to save uploaded file.'], 500);
    }

    return $publicBase . '/' . $filename;
}
function jasti_ensure_editor_types(PDO $pdo): void
{
    $sql = file_get_contents(jasti_root_path('database/editor_types_migration.sql'));
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

function jasti_editor_types(PDO $pdo): array
{
    jasti_ensure_editor_types($pdo);
    $stmt = $pdo->query('SELECT * FROM editor_types ORDER BY access_level DESC');
    return $stmt->fetchAll();
}

function jasti_editor_type_by_id(PDO $pdo, int $typeId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM editor_types WHERE editor_type_id = :id');
    $stmt->execute(['id' => $typeId]);
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_editor_type_by_name(PDO $pdo, string $typeName): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM editor_types WHERE type_name = :name');
    $stmt->execute(['name' => $typeName]);
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_user_editor_profile(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT ep.*, et.type_name, et.description FROM editor_profiles ep
         LEFT JOIN editor_types et ON et.editor_type_id = ep.editor_type_id
         WHERE ep.user_id = :user_id'
    );
    $stmt->execute(['user_id' => $userId]);
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_create_editor_profile(PDO $pdo, int $userId, int $editorTypeId, ?array $data = null): int
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

function jasti_can_access_dashboard(PDO $pdo, int $userId, string $dashboardName): bool
{
    $profile = jasti_user_editor_profile($pdo, $userId);
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
    $stmt->closeCursor();
    return $result && $result['can_view'];
}

function jasti_can_edit_dashboard(PDO $pdo, int $userId, string $dashboardName): bool
{
    $profile = jasti_user_editor_profile($pdo, $userId);
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
    $stmt->closeCursor();
    return $result && $result['can_edit'];
}

function jasti_get_dashboard_url(string $editorTypeName): string
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

function jasti_ensure_editor_applications(PDO $pdo): void
{
    if (!jasti_table_exists($pdo, 'editor_applications')) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS editor_applications (
                application_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                editor_type_id INT NOT NULL,
                cv_file_path VARCHAR(255),
                cv_original_filename VARCHAR(255),
                subject_areas TEXT,
                expertise_description TEXT,
                bio TEXT,
                status ENUM("pending", "accepted", "rejected") DEFAULT "pending",
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP NULL,
                reviewed_by INT NULL,
                rejection_reason TEXT,
                acceptance_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (editor_type_id) REFERENCES editor_types(editor_type_id),
                FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
                UNIQUE KEY unique_pending_application (user_id, editor_type_id, status)
            ) ENGINE=InnoDB'
        );
    }

    $indexes = [
        'idx_status' => 'CREATE INDEX idx_status ON editor_applications(status)',
        'idx_user_id' => 'CREATE INDEX idx_user_id ON editor_applications(user_id)',
        'idx_editor_type_id' => 'CREATE INDEX idx_editor_type_id ON editor_applications(editor_type_id)',
    ];

    foreach ($indexes as $indexName => $sql) {
        if (jasti_index_exists($pdo, 'editor_applications', $indexName)) {
            continue;
        }
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'Duplicate')) {
                error_log('Editor applications index migration error: ' . $e->getMessage());
            }
        }
    }

    if (jasti_table_exists($pdo, 'editor_profiles') && !jasti_column_exists($pdo, 'editor_profiles', 'application_id')) {
        try {
            $pdo->exec('ALTER TABLE editor_profiles ADD COLUMN application_id INT NULL');
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'Duplicate')) {
                error_log('Editor profile application_id migration error: ' . $e->getMessage());
            }
        }
    }

    if (
        jasti_table_exists($pdo, 'editor_profiles')
        && jasti_column_exists($pdo, 'editor_profiles', 'application_id')
        && !jasti_constraint_exists($pdo, 'editor_profiles', 'fk_editor_profiles_application')
    ) {
        try {
            $invalidStmt = $pdo->query(
                'SELECT COUNT(*)
                 FROM editor_profiles ep
                 LEFT JOIN editor_applications ea ON ea.application_id = ep.application_id
                 WHERE ep.application_id IS NOT NULL
                   AND ea.application_id IS NULL'
            );
            $invalidReferences = (int) $invalidStmt->fetchColumn();
            $invalidStmt->closeCursor();

            if ($invalidReferences === 0) {
                $pdo->exec('ALTER TABLE editor_profiles ADD CONSTRAINT fk_editor_profiles_application FOREIGN KEY (application_id) REFERENCES editor_applications(application_id) ON DELETE SET NULL');
            }
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'Duplicate') && !str_contains($e->getMessage(), 'already exists')) {
                error_log('Editor profile application constraint migration error: ' . $e->getMessage());
            }
        }
    }
}

function jasti_ensure_editor_workspace_schema(PDO $pdo): void
{
    $sql = file_get_contents(jasti_root_path('database/editor_application_migration.sql'));
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

function jasti_create_editor_application(PDO $pdo, int $userId, int $editorTypeId, array $data): int
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

function jasti_get_editor_application(PDO $pdo, int $applicationId): ?array
{
    jasti_ensure_editor_applications($pdo);

    $stmt = $pdo->prepare(
        'SELECT ea.*, u.first_name, u.last_name, u.email, et.type_name,
                et.description AS title, et.responsibilities AS description
         FROM editor_applications ea
         JOIN users u ON u.user_id = ea.user_id
         JOIN editor_types et ON et.editor_type_id = ea.editor_type_id
         WHERE ea.application_id = :id'
    );
    
    $stmt->execute(['id' => $applicationId]);
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_get_user_editor_application(PDO $pdo, int $userId): ?array
{
    jasti_ensure_editor_applications($pdo);

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
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_get_latest_editor_application(PDO $pdo, int $userId): ?array
{
    jasti_ensure_editor_applications($pdo);

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
    $row = $stmt->fetch() ?: null;
    $stmt->closeCursor();
    return $row;
}

function jasti_get_pending_applications(PDO $pdo, int $limit = 50, int $offset = 0): array
{
    jasti_ensure_editor_applications($pdo);

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

function jasti_accept_editor_application(PDO $pdo, int $applicationId, int $reviewerId, ?string $notes = null): bool
{
    jasti_ensure_editor_applications($pdo);

    $application = jasti_get_editor_application($pdo, $applicationId);
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
        $existingProfile = jasti_user_editor_profile($pdo, (int) $application['user_id']);
        if ($existingProfile === null) {
            jasti_create_editor_profile($pdo, (int) $application['user_id'], (int) $application['editor_type_id'], [
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

function jasti_reject_editor_application(PDO $pdo, int $applicationId, int $reviewerId, string $reason): bool
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

function jasti_dashboard_payload(PDO $pdo, array $user): array
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

    if (jasti_has_editor_workspace_role($roles)) {
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
