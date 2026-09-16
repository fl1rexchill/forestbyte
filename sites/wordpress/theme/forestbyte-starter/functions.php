<?php
/**
 * Forestbyte Starter — настройка темы.
 */
if (!defined('ABSPATH')) { exit; }

function forestbyte_theme_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    add_theme_support('custom-logo');
    register_nav_menus([
        'primary' => 'Главное меню',
    ]);
}
add_action('after_setup_theme', 'forestbyte_theme_setup');

function forestbyte_theme_assets() {
    wp_enqueue_style('forestbyte-starter', get_stylesheet_uri(), [], '1.0.0');
}
add_action('wp_enqueue_scripts', 'forestbyte_theme_assets');

/**
 * Подсказка в админке, если не активирован плагин Forestbyte (виджеты не заработают).
 */
function forestbyte_theme_notice() {
    if (!function_exists('forestbyte_get_settings')) {
        echo '<div class="notice notice-warning"><p>'
            . 'Тема <b>Forestbyte Starter</b> работает лучше с плагином <b>Forestbyte</b> '
            . '(виджеты и форма-заявка). Установите и активируйте плагин.'
            . '</p></div>';
    }
}
add_action('admin_notices', 'forestbyte_theme_notice');
