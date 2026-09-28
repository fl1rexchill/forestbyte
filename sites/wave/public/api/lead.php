<?php
/**
 * WAVE — приём заявок с сайта.
 * Письмо уходит на адрес дилера через mail() хостинга. Данные не сохраняются на сервере
 * и не передаются в сторонние сервисы (152-ФЗ: только цель «ответ на заявку»).
 *
 * Настройка — константы ниже. Для надёжной доставки лучше настроить на хостинге SMTP
 * с отправителем на домене waverus.ru (SPF/DKIM), иначе письма могут попадать в спам.
 */

const LEAD_TO   = '511-238@mail.ru';          // кому (можно несколько через запятую)
const LEAD_FROM = 'no-reply@waverus.ru';      // от кого — ящик на домене сайта
const RATE_MAX  = 5;                          // не больше N заявок…
const RATE_WIN  = 600;                        // …за столько секунд с одного IP

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

function reply(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'Метод не поддерживается.']);
}

// Запросы только с нашего сайта
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && preg_replace('~^https?://~i', '', $origin) !== $host) {
    reply(403, ['ok' => false, 'error' => 'Запрос отклонён.']);
}

$field = static function (string $key, int $max): string {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
};

// Ловушки для ботов: скрытое поле и слишком быстрое заполнение — делаем вид, что всё хорошо
if ($field('website', 200) !== '' || (int)($_POST['elapsed'] ?? 0) < 3) {
    reply(200, ['ok' => true]);
}

$name    = $field('name', 80);
$phone   = preg_replace('/\D/', '', $field('phone', 30));
$model   = $field('model', 60);
$message = $field('message', 1500);
$page    = $field('page', 120);
$consent = ($_POST['consent'] ?? '') === '1';

if (mb_strlen($name) < 2)   reply(422, ['ok' => false, 'error' => 'Укажите имя.']);
if (strlen($phone) !== 11)  reply(422, ['ok' => false, 'error' => 'Проверьте номер телефона.']);
if (!$consent)              reply(422, ['ok' => false, 'error' => 'Нужно согласие на обработку персональных данных.']);

// Ограничение частоты: храним только хэш IP и время, без персональных данных
$ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __FILE__);
$rateFile = sys_get_temp_dir() . '/wave-lead-' . substr($ipHash, 0, 16);
$now = time();
$hits = array_filter(
    array_map('intval', @file($rateFile, FILE_IGNORE_NEW_LINES) ?: []),
    static fn(int $t) => $t > $now - RATE_WIN
);
if (count($hits) >= RATE_MAX) {
    reply(429, ['ok' => false, 'error' => 'Слишком много заявок подряд. Попробуйте позже.']);
}
$hits[] = $now;
@file_put_contents($rateFile, implode("\n", $hits), LOCK_EX);

$fmtPhone = sprintf('+7 (%s) %s-%s-%s', substr($phone, 1, 3), substr($phone, 4, 3), substr($phone, 7, 2), substr($phone, 9, 2));
$lines = [
    'Новая заявка с сайта waverus.ru',
    '',
    'Имя: ' . $name,
    'Телефон: ' . $fmtPhone,
    'Комплект: ' . ($model !== '' ? $model : 'нужна помощь с выбором'),
    'Вопрос: ' . ($message !== '' ? $message : '—'),
    '',
    'Страница: ' . $page,
    'Время: ' . date('d.m.Y H:i'),
    'Согласие на обработку ПД: получено (' . date('d.m.Y H:i:s') . ')',
    '',
    'Данные переданы для ответа на заявку. После обработки удалите письмо',
    'или храните не дольше срока, указанного в Согласии (1 год).',
];

$subject = '=?UTF-8?B?' . base64_encode('Заявка WAVE: ' . $name . ', ' . $fmtPhone) . '?=';
$headers = implode("\r\n", [
    'From: =?UTF-8?B?' . base64_encode('Сайт WAVE') . '?= <' . LEAD_FROM . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
]);

if (!@mail(LEAD_TO, $subject, implode("\n", $lines), $headers, '-f' . LEAD_FROM)) {
    reply(500, ['ok' => false, 'error' => 'Сервер не смог отправить заявку.']);
}

reply(200, ['ok' => true]);
