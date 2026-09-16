<?php
/**
 * Шорткоды Forestbyte — рендерят виджеты <fb-*> и подключают их скрипты.
 * Скрипт виджета грузится только если его шорткод реально используется на странице.
 */
if (!defined('ABSPATH')) { exit; }

/** Карта: имя виджета => [папка, файл, html-тег]. */
function forestbyte_widget_map() {
    return [
        'stories'        => ['stories',        'fb-stories.js',        'fb-stories'],
        'video_circles'  => ['video-circles',  'fb-video-circles.js',  'fb-video-circles'],
        'social_feed'    => ['social-feed',     'fb-social-feed.js',     'fb-social-feed'],
        'testimonials'   => ['testimonials',    'fb-testimonials.js',    'fb-testimonials'],
        'faq'            => ['faq',             'fb-faq.js',             'fb-faq'],
        'counter'        => ['counter',         'fb-counter.js',         'fb-counter'],
        'cookie_consent' => ['cookie-consent',  'fb-cookie-consent.js',  'fb-cookie-consent'],
        'reveal'         => ['reveal',          'fb-reveal.js',          'fb-reveal'],
        'modal'          => ['modal',           'fb-modal.js',           'fb-modal'],
    ];
}

/** Подключить скрипт виджета (ES-модуль). */
function forestbyte_enqueue_widget($name) {
    $map = forestbyte_widget_map();
    if (!isset($map[$name])) { return; }
    [$folder, $file] = $map[$name];
    $handle = 'forestbyte-fb-' . $name;
    if (!wp_script_is($handle, 'enqueued')) {
        wp_enqueue_script(
            $handle,
            FORESTBYTE_URL . "assets/components/{$folder}/{$file}",
            [],
            FORESTBYTE_VERSION,
            true
        );
    }
}

/** Собрать строку атрибутов из shortcode-атрибутов (маппинг подчёркиваний в дефисы). */
function forestbyte_build_attrs($atts, $allowed) {
    $out = '';
    foreach ($allowed as $key) {
        if (isset($atts[$key]) && $atts[$key] !== '') {
            $attrName = str_replace('_', '-', $key);
            $out .= sprintf(' %s="%s"', esc_attr($attrName), esc_attr($atts[$key]));
        }
    }
    return $out;
}

/** Универсальный рендер простого виджета. */
function forestbyte_render_widget($name, $tag, $atts, $allowed) {
    forestbyte_enqueue_widget($name);
    return "<{$tag}" . forestbyte_build_attrs($atts, $allowed) . "></{$tag}>";
}

/* ---------- Регистрация шорткодов ---------- */

add_shortcode('fb_stories', function ($atts) {
    return forestbyte_render_widget('stories', 'fb-stories', (array) $atts, ['src', 'items', 'size', 'default-duration']);
});

add_shortcode('fb_video_circles', function ($atts) {
    return forestbyte_render_widget('video_circles', 'fb-video-circles', (array) $atts, ['src', 'items', 'size']);
});

add_shortcode('fb_social_feed', function ($atts) {
    return forestbyte_render_widget('social_feed', 'fb-social-feed', (array) $atts, ['src', 'items', 'columns']);
});

add_shortcode('fb_testimonials', function ($atts) {
    return forestbyte_render_widget('testimonials', 'fb-testimonials', (array) $atts, ['src', 'items', 'autoplay']);
});

add_shortcode('fb_faq', function ($atts) {
    $atts = (array) $atts;
    // single="1" -> булев атрибут single
    $single = !empty($atts['single']) ? ' single' : '';
    unset($atts['single']);
    forestbyte_enqueue_widget('faq');
    return '<fb-faq' . $single . forestbyte_build_attrs($atts, ['src', 'items']) . '></fb-faq>';
});

add_shortcode('fb_counter', function ($atts) {
    return forestbyte_render_widget('counter', 'fb-counter', (array) $atts,
        ['to', 'from', 'duration', 'decimals', 'separator', 'prefix', 'suffix']);
});

add_shortcode('fb_cookie_consent', function ($atts) {
    $atts = (array) $atts;
    $cats = !empty($atts['categories']) ? ' categories' : '';
    $policy = isset($atts['policy']) ? sprintf(' policy-href="%s"', esc_attr($atts['policy'])) : '';
    forestbyte_enqueue_widget('cookie_consent');
    return '<fb-cookie-consent' . $policy . $cats . '></fb-cookie-consent>';
});

// Обёрточные (с контентом)
add_shortcode('fb_reveal', function ($atts, $content = '') {
    forestbyte_enqueue_widget('reveal');
    $attrs = forestbyte_build_attrs((array) $atts, ['animation', 'stagger', 'duration', 'delay', 'once', 'threshold']);
    return '<fb-reveal' . $attrs . '>' . do_shortcode($content) . '</fb-reveal>';
});

add_shortcode('fb_modal', function ($atts, $content = '') {
    forestbyte_enqueue_widget('modal');
    $attrs = forestbyte_build_attrs((array) $atts, ['id', 'title', 'open_on', 'delay', 'once']);
    return '<fb-modal' . $attrs . '>' . do_shortcode($content) . '</fb-modal>';
});

/** Проставить тему (data-theme) на <html>, если выбрана не «авто». */
add_action('wp_head', function () {
    $s = forestbyte_get_settings();
    if (in_array($s['theme'], ['light', 'dark'], true)) {
        echo "<script>document.documentElement.setAttribute('data-theme','" . esc_js($s['theme']) . "');</script>\n";
    }
});
