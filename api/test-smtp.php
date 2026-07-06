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
$testEmail = trim((string) ($config['MAIL_FROM_ADDRESS'] ?? 'teckexpert4solutions.me@gmail.com'));
$recipientEmail = trim((string) ($argv[1] ?? ($_GET['to'] ?? $testEmail)));
if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
    echo "Invalid recipient email: {$recipientEmail}\n";
    exit(1);
}

echo "Host: $host\n";
echo "Username: $username\n";
echo "From Email: $testEmail\n";
echo "Recipient: $recipientEmail\n";
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
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->setFrom($testEmail, 'JASTI Test');
        $mail->addReplyTo($testEmail, 'JASTI Test');
        $mail->Sender = $testEmail;
        $mail->addAddress($recipientEmail);
        $mail->isHTML(true);
        $mail->Subject = 'JASTI SMTP Delivery Test';
        $mail->Body = '<p>This is a JASTI SMTP delivery test. If you received this email, SMTP delivery to this mailbox is working.</p>';
        $mail->AltBody = 'This is a JASTI SMTP delivery test. If you received this email, SMTP delivery to this mailbox is working.';
        
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
echo "   - For Bluehost, SMTP_USERNAME must usually be the full mailbox address, for example support@yourdomain.com\n";
echo "   - Use the mailbox password from Bluehost Email Accounts, not the cPanel/hosting login password\n";
echo "   - MAIL_FROM_ADDRESS should normally match SMTP_USERNAME or be an allowed sender for that mailbox\n";
echo "   - Confirm the outgoing server in Bluehost/cPanel; it may be mail.yourdomain.com instead of the temporary hosting hostname\n";
echo "   - Contact Bluehost support if the server keeps returning 'Could not authenticate'\n";
