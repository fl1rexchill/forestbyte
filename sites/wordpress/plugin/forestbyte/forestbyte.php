<?php
/**
 * Plugin Name:       Forestbyte
 * Plugin URI:        https://github.com/fl1rexchill/forestbyte
 * Description:        Виджеты (кружки, сториз, лента, FAQ, отзывы, попапы) + форма-заявка с отправкой в CRM (Bitrix24 / amoCRM). Всё настраивается в админке.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Forestbyte
 * License:           MIT
 * Text Domain:       forestbyte
 */

if (!defined('ABSPATH')) {
    exit; // прямой доступ запрещён
}

define('FORESTBYTE_VERSION', '1.0.0');
define('FORESTBYTE_PATH', plugin_dir_path(__FILE__));
define('FORESTBYTE_URL', plugin_dir_url(__FILE__));

require_once FORESTBYTE_PATH . 'includes/settings.php';
require_once FORESTBYTE_PATH . 'includes/shortcodes.php';
require_once FORESTBYTE_PATH . 'includes/lead.php';

/**
 * Настройки по умолчанию при активации.
 */
function forestbyte_activate() {
    if (get_option('forestbyte_settings') === false) {
        add_option('forestbyte_settings', [
            'accent'            => '#0ea5a4',
            'theme'             => 'auto',
            'crm_type'          => 'none',
            'bitrix_webhook'    => '',
            'amocrm_subdomain'  => '',
            'amocrm_token'      => '',
            'notify_email'      => get_option('admin_email'),
        ]);
    }
}
register_activation_hook(__FILE__, 'forestbyte_activate');

/**
 * Подключение стилей/скриптов на фронте.
 * tokens.css грузится всегда; сами виджеты — по мере использования шорткодов
 * (см. forestbyte_enqueue_widget() в shortcodes.php).
 */
function forestbyte_enqueue_front() {
    wp_enqueue_style(
        'forestbyte-tokens',
        FORESTBYTE_URL . 'assets/components/shared/tokens.css',
        [],
        FORESTBYTE_VERSION
    );

    // Перекраска под бренд из настроек (акцент + режим темы)
    $s = forestbyte_get_settings();
    $accent = esc_attr($s['accent'] ?? '#0ea5a4');
    $inline = ":root{--fb-accent:{$accent};}";
    wp_add_inline_style('forestbyte-tokens', $inline);
}
add_action('wp_enqueue_scripts', 'forestbyte_enqueue_front');

/**
 * Делает скрипты виджетов ES-модулями (type="module").
 * Применяется ко всем нашим handle с префиксом forestbyte-fb-.
 */
function forestbyte_module_type($tag, $handle) {
    if (strpos($handle, 'forestbyte-fb-') === 0) {
        $tag = str_replace('<script ', '<script type="module" ', $tag);
    }
    return $tag;
}
add_filter('script_loader_tag', 'forestbyte_module_type', 10, 2);
