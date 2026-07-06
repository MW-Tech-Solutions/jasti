<?php
declare(strict_types=1);

return [
    'APP_DEBUG' => true,

    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_SOCKET' => '',
    'DB_NAME' => 'ajasti_jms',
    'DB_USER' => 'root',
    'DB_PASS' => '',

    'FRONTEND_APP_URL' => 'http://localhost:5173',
    'BACKEND_APP_URL' => 'http://localhost/ajasti',
    'ALLOWED_ORIGINS' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
],
    'MAIL_FROM_ADDRESS' => 'noreply.pasacouncil@gmail.com',
    'MAIL_FROM_NAME' => 'PASAC Support',
    'MAIL_BRAND_NAME' => 'JASTI',
    'SMTP_HOST' => 'smtp.gmail.com',
    'SMTP_PORT' => '465',
    'SMTP_SECURE' => 'ssl',
    'SMTP_TIMEOUT' => '20',
    'SMTP_USERNAME' => 'noreply.pasacouncil@gmail.com',
    'SMTP_PASSWORD' => 'qpgqyfgrxiwgzoko',

   'PAYSTACK_SECRET_KEY' => 'sk_test_4ad25704103aba4bcfbe2b39d6c89bed2ee59b95',
    'PAYSTACK_PUBLIC_KEY' => 'pk_test_f1543f74336d89f3e67ee441f296d715f3273552',
    'PAYSTACK_BASE_URL' => 'https://api.paystack.co',
    'MAX_UPLOAD_SIZE_BYTES' => 10485760,
];
