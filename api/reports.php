<?php
declare(strict_types=1);

require_once __DIR__ . '/support/bootstrap.php';
jasti_bootstrap();
jasti_require_method('GET');

$pdo = jasti_db();
$user = jasti_require_auth($pdo);
$roles = $user['roles'] ?? [];
if (!in_array('admin', $roles, true) && !in_array('editor_in_chief', $roles, true)) {
    jasti_json(['message' => 'Only administrators and the Editor-in-Chief can generate reports.'], 403);
}

$type = strtolower(trim((string) ($_GET['type'] ?? 'submissions')));
$format = strtolower(trim((string) ($_GET['format'] ?? 'csv')));
$allowedTypes = ['submissions', 'reviews', 'payments', 'users', 'publications'];
$allowedFormats = ['csv', 'xlsx', 'docx', 'pdf'];
if (!in_array($type, $allowedTypes, true) || !in_array($format, $allowedFormats, true)) {
    jasti_json(['message' => 'Select a valid report type and format.'], 422);
}

function jasti_report_title(string $type): string
{
    return match ($type) {
        'reviews' => 'Reviewer Evaluation Report',
        'payments' => 'APC and Payment Report',
        'users' => 'User and Role Report',
        'publications' => 'Publication Archive Report',
        default => 'Submission Report',
    };
}

function jasti_report_rows(PDO $pdo, string $type): array
{
    return match ($type) {
        'reviews' => $pdo->query(
            'SELECT rv.review_id, rv.manuscript_id, m.reference_number, m.title, rv.reviewer_id,
                    CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS reviewer_name,
                    rv.recommendation, rv.total_score, rv.score_percent, rv.review_date
             FROM reviews rv
             INNER JOIN manuscripts m ON m.manuscript_id = rv.manuscript_id
             LEFT JOIN users u ON u.user_id = rv.reviewer_id
             ORDER BY rv.review_date DESC'
        )->fetchAll(),
        'payments' => $pdo->query(
            'SELECT mp.payment_id, mp.manuscript_id, m.reference_number, m.title, mp.amount,
                    mp.payment_reference, mp.payment_status, mp.submitted_at
             FROM manuscript_payments mp
             INNER JOIN manuscripts m ON m.manuscript_id = mp.manuscript_id
             ORDER BY mp.submitted_at DESC'
        )->fetchAll(),
        'users' => $pdo->query(
            'SELECT u.user_id, u.first_name, u.last_name, u.email, u.institution, u.country, u.status,
                    u.date_registered, GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ", ") AS roles
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.user_id
             LEFT JOIN roles r ON r.role_id = ur.role_id
             GROUP BY u.user_id
             ORDER BY u.date_registered DESC'
        )->fetchAll(),
        'publications' => $pdo->query(
            'SELECT a.article_id, a.manuscript_id, m.reference_number, m.title, a.doi, a.publication_date,
                    a.page_numbers, COALESCE(a.archived, 0) AS archived
             FROM articles a
             INNER JOIN manuscripts m ON m.manuscript_id = a.manuscript_id
             ORDER BY a.publication_date DESC, a.article_id DESC'
        )->fetchAll(),
        default => $pdo->query(
            'SELECT m.manuscript_id, m.reference_number, m.title, m.article_type, m.status,
                    m.submission_date, m.plagiarism_score,
                    CONCAT(COALESCE(u.first_name, ""), " ", COALESCE(u.last_name, "")) AS corresponding_author
             FROM manuscripts m
             LEFT JOIN users u ON u.user_id = m.corresponding_author_id
             ORDER BY m.submission_date DESC'
        )->fetchAll(),
    };
}

function jasti_report_columns(array $rows): array
{
    return $rows === [] ? ['message'] : array_keys($rows[0]);
}

function jasti_report_data_rows(array $rows): array
{
    return $rows === [] ? [['message' => 'No records available']] : $rows;
}

function jasti_report_label(string $column): string
{
    return ucwords(str_replace('_', ' ', $column));
}

function jasti_report_filename(string $type, string $format): string
{
    return 'jasti-' . $type . '-report-' . date('Ymd-His') . '.' . $format;
}

function jasti_download_headers(string $filename, string $contentType): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    header_remove('Content-Type');
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

function jasti_xml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function jasti_csv_text(string $value): string
{
    return preg_replace('/\s+/', ' ', trim($value)) ?? '';
}

function jasti_send_csv_report(array $rows, string $type): void
{
    jasti_download_headers(jasti_report_filename($type, 'csv'), 'text/csv; charset=utf-8');
    $out = fopen('php://output', 'wb');
    $columns = jasti_report_columns($rows);
    fputcsv($out, [jasti_report_title($type)]);
    fputcsv($out, ['Generated', date('Y-m-d H:i:s'), 'Total records', count($rows)]);
    fputcsv($out, []);
    fputcsv($out, array_map('jasti_report_label', $columns));
    foreach (jasti_report_data_rows($rows) as $row) {
        fputcsv($out, array_map(static fn ($column) => jasti_csv_text((string) ($row[$column] ?? '')), $columns));
    }
    fclose($out);
    exit;
}

function jasti_column_letter(int $index): string
{
    $letter = '';
    $index++;
    while ($index > 0) {
        $mod = ($index - 1) % 26;
        $letter = chr(65 + $mod) . $letter;
        $index = intdiv($index - $mod, 26);
    }
    return $letter;
}

function jasti_create_zip_document(array $files): string
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('ZipArchive is required for this report format.');
    }
    $path = tempnam(sys_get_temp_dir(), 'jasti-report-');
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Unable to create report archive.');
    }
    foreach ($files as $name => $content) {
        $zip->addFromString($name, $content);
    }
    $zip->close();
    return $path;
}

function jasti_send_xlsx_report(array $rows, string $type): void
{
    $columns = jasti_report_columns($rows);
    $dataRows = jasti_report_data_rows($rows);
    $lastColumn = jasti_column_letter(max(0, count($columns) - 1));
    $sheetRows = [
        '<row r="1" ht="28"><c r="A1" s="1" t="inlineStr"><is><t>' . jasti_xml(jasti_report_title($type)) . '</t></is></c></row>',
        '<row r="2"><c r="A2" s="2" t="inlineStr"><is><t>Generated</t></is></c><c r="B2" s="3" t="inlineStr"><is><t>' . date('Y-m-d H:i:s') . '</t></is></c><c r="C2" s="2" t="inlineStr"><is><t>Total records</t></is></c><c r="D2" s="3" t="inlineStr"><is><t>' . count($rows) . '</t></is></c></row>',
        '<row r="4">' . implode('', array_map(static fn ($column, $index) => '<c r="' . jasti_column_letter((int) $index) . '4" s="4" t="inlineStr"><is><t>' . jasti_xml(jasti_report_label((string) $column)) . '</t></is></c>', $columns, array_keys($columns))) . '</row>',
    ];
    $rowNumber = 4;
    foreach ($dataRows as $row) {
        $rowNumber++;
        $cells = [];
        foreach ($columns as $index => $column) {
            $cells[] = '<c r="' . jasti_column_letter((int) $index) . $rowNumber . '" s="' . ($rowNumber % 2 === 0 ? '5' : '6') . '" t="inlineStr"><is><t>' . jasti_xml((string) ($row[$column] ?? '')) . '</t></is></c>';
        }
        $sheetRows[] = '<row r="' . $rowNumber . '">' . implode('', $cells) . '</row>';
    }
    $cols = '<cols>' . implode('', array_map(static fn ($column, $index) => '<col min="' . ((int) $index + 1) . '" max="' . ((int) $index + 1) . '" width="' . (str_contains((string) $column, 'title') ? '42' : '20') . '" customWidth="1"/>', $columns, array_keys($columns))) . '</cols>';
    $sheet = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' . $cols . '<sheetData>' . implode('', $sheetRows) . '</sheetData><mergeCells count="1"><mergeCell ref="A1:' . $lastColumn . '1"/></mergeCells><autoFilter ref="A4:' . $lastColumn . $rowNumber . '"/></worksheet>';
    $styles = '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B6FA4"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6B5C"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD8DEE9"/></left><right style="thin"><color rgb="FFD8DEE9"/></right><top style="thin"><color rgb="FFD8DEE9"/></top><bottom style="thin"><color rgb="FFD8DEE9"/></bottom></border></borders><cellXfs count="7"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1"/><xf fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1"/><xf borderId="1"/><xf fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1"/><xf fillId="4" borderId="1" applyFill="1"/><xf borderId="1"/></cellXfs></styleSheet>';
    $path = jasti_create_zip_document([
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="JASTI Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml' => $styles,
        'xl/worksheets/sheet1.xml' => $sheet,
    ]);
    jasti_download_headers(jasti_report_filename($type, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    readfile($path);
    @unlink($path);
    exit;
}

function jasti_send_docx_report(array $rows, string $type): void
{
    $columns = jasti_report_columns($rows);
    $dataRows = jasti_report_data_rows($rows);
    $tableRows = '<w:tr>' . implode('', array_map(static fn ($column) => '<w:tc><w:tcPr><w:shd w:fill="0B6FA4"/><w:tcW w:w="2200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>' . jasti_xml(jasti_report_label((string) $column)) . '</w:t></w:r></w:p></w:tc>', $columns)) . '</w:tr>';
    foreach ($dataRows as $row) {
        $tableRows .= '<w:tr>' . implode('', array_map(static fn ($column) => '<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="D8DEE9"/><w:left w:val="single" w:sz="4" w:color="D8DEE9"/><w:bottom w:val="single" w:sz="4" w:color="D8DEE9"/><w:right w:val="single" w:sz="4" w:color="D8DEE9"/></w:tcBorders></w:tcPr><w:p><w:r><w:t>' . jasti_xml((string) ($row[$column] ?? '')) . '</w:t></w:r></w:p></w:tc>', $columns)) . '</w:tr>';
    }
    $document = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="0B6FA4"/></w:rPr><w:t>' . jasti_xml(jasti_report_title($type)) . '</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="64748B"/></w:rPr><w:t>Generated ' . date('Y-m-d H:i:s') . ' | Total records: ' . count($rows) . '</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>' . $tableRows . '</w:tbl><w:sectPr><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>';
    $path = jasti_create_zip_document([
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml' => $document,
    ]);
    jasti_download_headers(jasti_report_filename($type, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    readfile($path);
    @unlink($path);
    exit;
}

function jasti_pdf_escape(string $value): string
{
    return str_replace(["\\", '(', ')', "\r", "\n"], ["\\\\", "\\(", "\\)", ' ', ' '], $value);
}

function jasti_pdf_rgb(float $red, float $green, float $blue): string
{
    return sprintf('%.3F %.3F %.3F rg', max(0, min(1, $red)), max(0, min(1, $green)), max(0, min(1, $blue)));
}

function jasti_pdf_stream_text(float $x, float $y, string $text, int $size = 9, array $rgb = [0.059, 0.090, 0.165]): string
{
    [$red, $green, $blue] = $rgb;
    return jasti_pdf_rgb((float) $red, (float) $green, (float) $blue)
        . " BT /F1 {$size} Tf {$x} {$y} Td ("
        . jasti_pdf_escape($text)
        . ") Tj ET\n";
}

function jasti_send_pdf_report(array $rows, string $type): void
{
    $columns = array_slice(jasti_report_columns($rows), 0, 6);
    $dataRows = array_slice(jasti_report_data_rows($rows), 0, 32);
    $content = "0.043 0.435 0.643 rg 0 560 792 52 re f\n";
    $content .= jasti_pdf_stream_text(36, 594, jasti_report_title($type), 18, [1, 1, 1]);
    $content .= jasti_pdf_stream_text(36, 574, 'Generated ' . date('Y-m-d H:i:s') . ' | Total records: ' . count($rows), 9, [0.878, 0.953, 1]);
    $y = 526;
    $colWidth = 120;
    $content .= "0.122 0.420 0.361 rg 36 {$y} 720 20 re f\n";
    foreach ($columns as $index => $column) {
        $content .= jasti_pdf_stream_text(42 + ($index * $colWidth), $y + 6, substr(jasti_report_label($column), 0, 18), 8, [1, 1, 1]);
    }
    $y -= 22;
    foreach ($dataRows as $rowIndex => $row) {
        if ($rowIndex % 2 === 0) {
            $content .= "0.973 0.980 0.988 rg 36 {$y} 720 20 re f\n";
        }
        foreach ($columns as $index => $column) {
            $content .= jasti_pdf_stream_text(42 + ($index * $colWidth), $y + 6, substr((string) ($row[$column] ?? ''), 0, 26), 7, [0.129, 0.161, 0.216]);
        }
        $y -= 20;
    }
    $content .= "0.82 0.86 0.91 RG 36 104 720 442 re S\n";
    $objects = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
        "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
        "5 0 obj << /Length " . strlen($content) . " >> stream\n{$content}\nendstream endobj\n",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object;
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 6\n0000000000 65535 f \n";
    for ($i = 1; $i <= 5; $i++) {
        $pdf .= str_pad((string) $offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
    }
    $pdf .= "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    jasti_download_headers(jasti_report_filename($type, 'pdf'), 'application/pdf');
    echo $pdf;
    exit;
}

$rows = jasti_report_rows($pdo, $type);
jasti_log($pdo, (int) $user['user_id'], 'generated report ' . $type . ' as ' . $format, 'reports', null);

try {
    match ($format) {
        'xlsx' => jasti_send_xlsx_report($rows, $type),
        'docx' => jasti_send_docx_report($rows, $type),
        'pdf' => jasti_send_pdf_report($rows, $type),
        default => jasti_send_csv_report($rows, $type),
    };
} catch (Throwable $exception) {
    error_log('JASTI styled report generation failed: ' . $exception->getMessage());
    jasti_send_csv_report($rows, $type);
}
