<?php
/**
 * ============================================================================
 * SANDANA CLINIC & DUDRUCS MEDICAL STORE — STANDALONE PHP + MYSQL CONNECTOR
 * File: mysql_api.php
 * Upload this file to your cPanel / Hostinger / GoDaddy public_html folder
 * alongside your website files and import sandana_dudrucs_mysql.sql in phpMyAdmin.
 * ============================================================================
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DB_HOST = getenv('MYSQL_HOST') ?: 'localhost';
$DB_PORT = getenv('MYSQL_PORT') ?: '3306';
$DB_NAME = getenv('MYSQL_DATABASE') ?: 'sandana_dudrucs_mysql';
$DB_USER = getenv('MYSQL_USER') ?: 'root';
$DB_PASS = getenv('MYSQL_PASSWORD') ?: '';

try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "MySQL Connection Failed: " . $e->getMessage()
    ]);
    exit;
}

$allowedTables = [
    'settings', 'counters', 'users', 'doctors', 'appointments',
    'tokens', 'prescriptions', 'medicines', 'batches', 'invoices',
    'feedback', 'staff_activity'
];

$action = $_GET['action'] ?? 'status';

if ($action === 'status') {
    $counts = [];
    foreach ($allowedTables as $t) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM `{$t}`");
            $row = $stmt->fetch();
            $counts[$t] = (int)($row['cnt'] ?? 0);
        } catch (Exception $ex) {
            $counts[$t] = 0;
        }
    }
    echo json_encode([
        "success" => true,
        "engine" => "PHP PDO MySQL Relational Database",
        "database" => $DB_NAME,
        "tableCounts" => $counts
    ]);
    exit;
}

if ($action === 'get_all') {
    $collections = [];
    foreach ($allowedTables as $t) {
        try {
            $stmt = $pdo->query("SELECT id, data_json FROM `{$t}` ORDER BY updated_at DESC");
            $rows = [];
            while ($r = $stmt->fetch()) {
                $rows[] = [
                    "id" => $r['id'],
                    "data" => json_decode($r['data_json'], true) ?: []
                ];
            }
            $collections[$t] = $rows;
        } catch (Exception $ex) {
            $collections[$t] = [];
        }
    }
    echo json_encode(["success" => true, "collections" => $collections]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upsert') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $table = $body['table'] ?? '';
    $id = $body['id'] ?? '';
    $data = $body['data'] ?? [];

    if (!in_array($table, $allowedTables, true) || empty($id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid table or ID"]);
        exit;
    }

    $now = gmdate('Y-m-d\TH:i:s\Z');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare("INSERT INTO `{$table}` (id, data_json, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = VALUES(updated_at)");
    $stmt->execute([$id, $json, $now]);

    echo json_encode(["success" => true, "table" => $table, "id" => $id]);
    exit;
}

echo json_encode(["success" => true, "message" => "Sandana Clinic & Dudrucs MySQL API Active"]);
?>