<?php
/**
 * Forestbyte — адаптер Bitrix24 (PHP).
 * Создаёт лид (заявку) в Bitrix24 через входящий вебхук.
 *
 * Как получить webhook — см. TUTORIAL.md рядом.
 *
 * Пример:
 *   require_once __DIR__ . '/bitrix24.php';
 *   $crm = new ForestbyteBitrix24('https://portal.bitrix24.ru/rest/1/xxxx/');
 *   $result = $crm->createLead([
 *       'name'    => 'Иван',
 *       'phone'   => '+7 900 000-00-00',
 *       'email'   => 'ivan@mail.ru',
 *       'comment' => 'Заявка с сайта',
 *       'title'   => 'Заявка с лендинга',
 *   ]);
 *   // $result === true при успехе
 */

if (!class_exists('ForestbyteBitrix24')) {

class ForestbyteBitrix24 {
    private string $webhook;

    /** @param string $webhook Ссылка входящего вебхука (с / на конце). */
    public function __construct(string $webhook) {
        $this->webhook = rtrim($webhook, '/') . '/';
    }

    /**
     * Создать лид. Возвращает true или строку с текстом ошибки.
     * @param array $data name, phone, email, comment, title
     * @return true|string
     */
    public function createLead(array $data) {
        $fields = [
            'TITLE'   => $data['title']   ?? ('Заявка с сайта: ' . ($data['name'] ?? '')),
            'NAME'    => $data['name']    ?? '',
            'COMMENTS'=> $data['comment'] ?? '',
            'SOURCE_ID' => 'WEB',
        ];
        if (!empty($data['phone'])) {
            $fields['PHONE'] = [['VALUE' => $data['phone'], 'VALUE_TYPE' => 'WORK']];
        }
        if (!empty($data['email'])) {
            $fields['EMAIL'] = [['VALUE' => $data['email'], 'VALUE_TYPE' => 'WORK']];
        }

        $response = $this->call('crm.lead.add', ['fields' => $fields]);
        if ($response === false) {
            return 'Не удалось связаться с Bitrix24 (проверьте ссылку вебхука).';
        }
        if (isset($response['error'])) {
            return 'Bitrix24: ' . ($response['error_description'] ?? $response['error']);
        }
        return true;
    }

    /** Низкоуровневый вызов метода REST. */
    private function call(string $method, array $params) {
        $url = $this->webhook . $method . '.json';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($params),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        if ($raw === false) {
            return false;
        }
        return json_decode($raw, true);
    }
}

}
