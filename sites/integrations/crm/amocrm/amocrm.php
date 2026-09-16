<?php
/**
 * Forestbyte — адаптер amoCRM (PHP), API v4.
 * Создаёт сделку с контактом через долгосрочный токен.
 * Как получить токен и поддомен — см. TUTORIAL.md рядом.
 *
 * Пример:
 *   require_once __DIR__ . '/amocrm.php';
 *   $crm = new ForestbyteAmoCRM('mycompany', 'ДОЛГОСРОЧНЫЙ_ТОКЕН');
 *   $result = $crm->createLead([
 *       'name'    => 'Иван',
 *       'phone'   => '+7 900 000-00-00',
 *       'email'   => 'ivan@mail.ru',
 *       'comment' => 'Заявка с сайта',
 *       'title'   => 'Заявка с лендинга',
 *   ]);
 *   // $result === true при успехе, иначе строка ошибки
 */

if (!class_exists('ForestbyteAmoCRM')) {

class ForestbyteAmoCRM {
    private string $base;
    private string $token;

    public function __construct(string $subdomain, string $token) {
        // принимаем как "mycompany", так и полный адрес
        $subdomain = preg_replace('~^https?://~', '', $subdomain);
        $subdomain = preg_replace('~\.amocrm\.(ru|com)/?$~', '', $subdomain);
        $this->base = "https://{$subdomain}.amocrm.ru";
        $this->token = $token;
    }

    /**
     * Создать сделку с контактом (endpoint /leads/complex).
     * @return true|string
     */
    public function createLead(array $data) {
        $contactFields = [];
        if (!empty($data['phone'])) {
            $contactFields[] = ['field_code' => 'PHONE', 'values' => [['value' => $data['phone']]]];
        }
        if (!empty($data['email'])) {
            $contactFields[] = ['field_code' => 'EMAIL', 'values' => [['value' => $data['email']]]];
        }

        $payload = [[
            'name' => $data['title'] ?? ('Заявка с сайта: ' . ($data['name'] ?? '')),
            '_embedded' => [
                'contacts' => [[
                    'name' => $data['name'] ?? 'Клиент с сайта',
                    'custom_fields_values' => $contactFields ?: null,
                ]],
            ],
        ]];

        $resp = $this->request('POST', '/api/v4/leads/complex', $payload);
        if ($resp['ok'] !== true) {
            return $resp['error'];
        }

        // Необязательно: добавить примечание с комментарием к созданной сделке
        if (!empty($data['comment']) && !empty($resp['body'][0]['id'])) {
            $leadId = $resp['body'][0]['id'];
            $this->request('POST', "/api/v4/leads/{$leadId}/notes", [[
                'note_type' => 'common',
                'params' => ['text' => $data['comment']],
            ]]);
        }
        return true;
    }

    /** @return array{ok:bool, body?:array, error?:string} */
    private function request(string $method, string $path, array $body) {
        $ch = curl_init($this->base . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->token,
                'Content-Type: application/json',
            ],
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false) {
            return ['ok' => false, 'error' => 'Не удалось связаться с amoCRM.'];
        }
        if ($code === 401) return ['ok' => false, 'error' => 'amoCRM: токен неверный или истёк (401).'];
        if ($code === 403) return ['ok' => false, 'error' => 'amoCRM: нет доступа к CRM (403).'];
        if ($code >= 400)  return ['ok' => false, 'error' => "amoCRM: ошибка HTTP {$code}. Ответ: {$raw}"];

        return ['ok' => true, 'body' => json_decode($raw, true)];
    }
}

}
