<?php
/**
 * Админ-панель Forestbyte: страница настроек (внешний вид + CRM).
 */
if (!defined('ABSPATH')) { exit; }

/** Хелпер: получить настройки с дефолтами. */
function forestbyte_get_settings() {
    $defaults = [
        'accent'           => '#0ea5a4',
        'theme'            => 'auto',
        'crm_type'         => 'none',
        'bitrix_webhook'   => '',
        'amocrm_subdomain' => '',
        'amocrm_token'     => '',
        'notify_email'     => get_option('admin_email'),
    ];
    return wp_parse_args(get_option('forestbyte_settings', []), $defaults);
}

/** Пункт меню в админке. */
function forestbyte_admin_menu() {
    add_menu_page(
        'Forestbyte',
        'Forestbyte',
        'manage_options',
        'forestbyte',
        'forestbyte_settings_page',
        'dashicons-screenoptions',
        58
    );
}
add_action('admin_menu', 'forestbyte_admin_menu');

/** Регистрация настроек (единый массив forestbyte_settings). */
function forestbyte_register_settings() {
    register_setting('forestbyte_group', 'forestbyte_settings', 'forestbyte_sanitize');
}
add_action('admin_init', 'forestbyte_register_settings');

/** Санитайз входящих настроек. */
function forestbyte_sanitize($input) {
    return [
        'accent'           => sanitize_hex_color($input['accent'] ?? '') ?: '#0ea5a4',
        'theme'            => in_array($input['theme'] ?? 'auto', ['auto', 'light', 'dark'], true) ? $input['theme'] : 'auto',
        'crm_type'         => in_array($input['crm_type'] ?? 'none', ['none', 'bitrix24', 'amocrm'], true) ? $input['crm_type'] : 'none',
        'bitrix_webhook'   => esc_url_raw(trim($input['bitrix_webhook'] ?? '')),
        'amocrm_subdomain' => sanitize_text_field($input['amocrm_subdomain'] ?? ''),
        'amocrm_token'     => sanitize_text_field($input['amocrm_token'] ?? ''),
        'notify_email'     => sanitize_email($input['notify_email'] ?? ''),
    ];
}

/** Разметка страницы настроек. */
function forestbyte_settings_page() {
    if (!current_user_can('manage_options')) { return; }
    $s = forestbyte_get_settings();
    ?>
    <div class="wrap">
        <h1>🌲 Forestbyte — настройки</h1>
        <p>Настройте внешний вид виджетов и подключите CRM. Шорткоды виджетов — во вкладке «Шорткоды» ниже.</p>

        <form method="post" action="options.php">
            <?php settings_fields('forestbyte_group'); ?>

            <h2 class="title">Внешний вид</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="fb_accent">Цвет акцента</label></th>
                    <td>
                        <input type="color" id="fb_accent" name="forestbyte_settings[accent]"
                               value="<?php echo esc_attr($s['accent']); ?>">
                        <p class="description">Основной цвет кнопок и акцентов виджетов.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="fb_theme">Тема</label></th>
                    <td>
                        <select id="fb_theme" name="forestbyte_settings[theme]">
                            <option value="auto"  <?php selected($s['theme'], 'auto'); ?>>Авто (как в системе)</option>
                            <option value="light" <?php selected($s['theme'], 'light'); ?>>Светлая</option>
                            <option value="dark"  <?php selected($s['theme'], 'dark'); ?>>Тёмная</option>
                        </select>
                    </td>
                </tr>
            </table>

            <h2 class="title">CRM (куда уходят заявки)</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="fb_crm">CRM</label></th>
                    <td>
                        <select id="fb_crm" name="forestbyte_settings[crm_type]">
                            <option value="none"     <?php selected($s['crm_type'], 'none'); ?>>Не подключать (заявки на e-mail)</option>
                            <option value="bitrix24" <?php selected($s['crm_type'], 'bitrix24'); ?>>Bitrix24</option>
                            <option value="amocrm"   <?php selected($s['crm_type'], 'amocrm'); ?>>amoCRM</option>
                        </select>
                        <p class="description">Инструкции по получению ключей — в папке <code>sites/integrations/crm/</code> (TUTORIAL.md).</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="fb_bitrix">Bitrix24: Webhook URL</label></th>
                    <td>
                        <input type="text" class="regular-text" id="fb_bitrix" name="forestbyte_settings[bitrix_webhook]"
                               value="<?php echo esc_attr($s['bitrix_webhook']); ?>"
                               placeholder="https://портал.bitrix24.ru/rest/1/xxxx/">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="fb_amo_sub">amoCRM: Поддомен</label></th>
                    <td>
                        <input type="text" class="regular-text" id="fb_amo_sub" name="forestbyte_settings[amocrm_subdomain]"
                               value="<?php echo esc_attr($s['amocrm_subdomain']); ?>" placeholder="mycompany">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="fb_amo_tok">amoCRM: Долгосрочный токен</label></th>
                    <td>
                        <input type="password" class="regular-text" id="fb_amo_tok" name="forestbyte_settings[amocrm_token]"
                               value="<?php echo esc_attr($s['amocrm_token']); ?>" autocomplete="off">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="fb_email">E-mail для заявок</label></th>
                    <td>
                        <input type="email" class="regular-text" id="fb_email" name="forestbyte_settings[notify_email]"
                               value="<?php echo esc_attr($s['notify_email']); ?>">
                        <p class="description">Дубль заявки придёт на почту (и это резерв, если CRM недоступна).</p>
                    </td>
                </tr>
            </table>

            <?php submit_button('Сохранить настройки'); ?>
        </form>

        <hr>
        <h2>Шорткоды виджетов</h2>
        <p>Вставляйте в любую страницу/запись:</p>
        <table class="widefat striped" style="max-width:900px">
            <thead><tr><th>Виджет</th><th>Шорткод</th></tr></thead>
            <tbody>
                <tr><td>Форма-заявка → CRM</td><td><code>[fb_lead_form title="Оставить заявку" button="Отправить"]</code></td></tr>
                <tr><td>Сториз (Instagram)</td><td><code>[fb_stories src="/wp-content/uploads/stories.json"]</code></td></tr>
                <tr><td>Кружки (Telegram)</td><td><code>[fb_video_circles src="/wp-content/uploads/circles.json"]</code></td></tr>
                <tr><td>Лента соцсетей</td><td><code>[fb_social_feed src="/wp-json/..." columns="3"]</code></td></tr>
                <tr><td>Отзывы</td><td><code>[fb_testimonials src="/wp-content/uploads/reviews.json" autoplay="6000"]</code></td></tr>
                <tr><td>FAQ</td><td><code>[fb_faq src="/wp-content/uploads/faq.json" single="1"]</code></td></tr>
                <tr><td>Счётчик</td><td><code>[fb_counter to="1500" suffix="+"]</code></td></tr>
                <tr><td>Cookie 152-ФЗ</td><td><code>[fb_cookie_consent policy="/privacy" categories="1"]</code></td></tr>
                <tr><td>Появление при скролле</td><td><code>[fb_reveal]…контент…[/fb_reveal]</code></td></tr>
                <tr><td>Попап</td><td><code>[fb_modal id="promo" open_on="delay" delay="4000" title="Скидка"]…[/fb_modal]</code></td></tr>
            </tbody>
        </table>
    </div>
    <?php
}
