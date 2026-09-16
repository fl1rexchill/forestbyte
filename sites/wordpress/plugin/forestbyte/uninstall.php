<?php
/**
 * Выполняется при УДАЛЕНИИ плагина через админку WordPress.
 * Чистим сохранённые настройки.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}
delete_option('forestbyte_settings');
