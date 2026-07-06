<?php
declare(strict_types=1);

/**
 * SMTP Configuration Test
 * Tests both port 465 (SSL) and port 587 (TLS) to find which works on this server
 */

require_once __DIR__ . '/support/bootstrap.php';

$config = require_once __DIR__ . '/support/config.php';

echo "=== JASTI SMTP Configuration Test ===\n\n";

$testConfigs = [
    [
        'name' => 'Port 587 (TLS) - Recommended',
        'port' => 587,
        'secure' => 'tls',
    ],
    [
        'name' => 'Port 465 (SSL) - Current',
        'port' => 465,
        'secure' => 'ssl',
    ],
    [
        'name' => 'Port 587 (No Security)',
        'port' => 587,
        'secure' => '',
    ],
];

$host = trim((string) ($config['SMTP_HOST'] ?? 'smtp.gmail.com'));
$username = trim((string) ($config['SMTP_USERNAME'] ?? ''));
$password = trim((string) ($config['SMTP_PASSWORD'] ?? ''));
$testEmail = trim((string) ($config['MAIL_FROM_ADDRESS'] ?? 'noreply@example.com'));

echo "Host: $host\n";
echo "Username: $username\n";
echo "From Email: $testEmail\n";
echo "Password: " . (strlen($password) > 0 ? str_repeat('*', strlen($password)) : '(empty)') . "\n\n";

// Check Composer autoload
$composerAutoload = __DIR__ . '/../vendor/autoload.php';
if (is_file($composerAutoload)) {
    require_once $composerAutoload;
    echo "✓ Composer autoload found\n\n";
} else {
    echo "✗ Composer autoload NOT found\n";
    exit(1);
}

foreach ($testConfigs as $index => $testConfig) {
    echo "--- Test " . ($index + 1) . ": {$testConfig['name']} ---\n";
    
    try {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $username;
        $mail->Password = $password;
        $mail->Port = $testConfig['port'];
        $mail->Timeout = 10;
        $mail->SMTPAutoTLS = true;
        
        if ($testConfig['secure'] !== '') {
            $mail->SMTPSecure = $testConfig['secure'];
        }
        
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ];
        
        // Enable debug output
        $debug = [];
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = static function (string $message) use (&$debug): void {
            $debug[] = trim($message);
        };
        
        // Try to connect (don't send)
        $mail->setFrom($testEmail, 'JASTI Test');
        $mail->addAddress('test@example.com');
        $mail->Subject = 'SMTP Test';
        $mail->Body = 'This is a test.';
        
        echo "Attempting connection...\n";
        $mail->send();
        echo "✓ SUCCESS! This configuration works!\n\n";
        
    } catch (Throwable $e) {
        echo "✗ Failed: {$e->getMessage()}\n";
        if (!empty($debug)) {
            echo "Debug Info (last 3):\n";
            foreach (array_slice($debug, -3) as $line) {
                echo "  " . substr($line, 0, 100) . "\n";
            }
        }
        echo "\n";
    }
}

echo "=== Recommendations ===\n";
echo "1. If 'Port 587 (TLS)' works: Update config.php:\n";
echo "   'SMTP_PORT' => '587',\n";
echo "   'SMTP_SECURE' => 'tls',\n\n";
echo "2. If 'Port 465 (SSL)' works: Keep current settings\n\n";
echo "3. If neither works:\n";
echo "   - Verify Gmail app password is correct\n";
echo "   - Check if hosting provider blocks these ports\n";
echo "   - Contact hosting support for SMTP access\n";
