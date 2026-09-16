<?php
/**
 * Форма-заявка Forestbyte + обработчик отправки в CRM.
 * Шорткод [fb_lead_form] рендерит форму; отправка идёт через admin-ajax
 * в выбранную в настройках CRM (Bitrix24 / amoCRM) + дубль на e-mail.
 */
if (!defined('ABSPATH')) { exit; }

/** Шорткод формы. */
add_shortcode('fb_lead_form', function ($atts) {
    $atts = shortcode_atts([
        'title'   => 'Оставить заявку',
        'button'  => 'Отправить',
        'comment' => '1',   // показывать поле «комментарий»
        'policy'  => '/privacy',
    ], $atts);

    $nonce = wp_create_nonce('fb_lead');
    ob_start(); ?>
    <form class="fb-lead" data-fb-lead>
        <?php if ($atts['title']): ?><h3 class="fb-lead__title"><?php echo esc_html($atts['title']); ?></h3><?php endif; ?>
        <div class="fb-lead__row">
            <input class="fb-lead__input" type="text" name="name" placeholder="Ваше имя" required>
        </div>
        <div class="fb-lead__row">
            <input class="fb-lead__input" type="tel" name="phone" placeholder="Телефон" required>
        </div>
        <div class="fb-lead__row">
            <input class="fb-lead__input" type="email" name="email" placeholder="E-mail">
        </div>
        <?php if ($atts['comment'] === '1'): ?>
        <div class="fb-lead__row">
            <textarea class="fb-lead__input" name="comment" rows="3" placeholder="Комментарий"></textarea>
        </div>
        <?php endif; ?>
        <!-- honeypot: люди это поле не видят, боты заполняют -->
        <input type="text" name="website" tabindex="-1" autocomplete="off"
               style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true">
        <label class="fb-lead__consent">
            <input type="checkbox" name="consent" required>
            <span>Согласен с <a href="<?php echo esc_url($atts['policy']); ?>" target="_blank">политикой конфиденциальности</a></span>
        </label>
        <input type="hidden" name="_nonce" value="<?php echo esc_attr($nonce); ?>">
        <button class="fb-btn fb-lead__btn" type="submit"><?php echo esc_html($atts['button']); ?></button>
        <div class="fb-lead__msg" role="status" aria-live="polite"></div>
    </form>
    <?php
    forestbyte_lead_assets();
    return ob_get_clean();
});

/** Стили формы + скрипт отправки (выводится один раз). */
function forestbyte_lead_assets() {
    static $done = false;
    if ($done) { return; }
    $done = true;
    $ajax = admin_url('admin-ajax.php');
    ?>
    <style>
      .fb-lead{max-width:440px;display:grid;gap:12px;font-family:var(--fb-font,sans-serif)}
      .fb-lead__title{margin:0 0 4px;color:var(--fb-text,#111)}
      .fb-lead__input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--fb-border,#e4e8e8);
        border-radius:var(--fb-radius-sm,10px);background:var(--fb-bg,#fff);color:var(--fb-text,#111);font:inherit}
      .fb-lead__input:focus{outline:2px solid var(--fb-accent,#0ea5a4);outline-offset:1px;border-color:transparent}
      .fb-lead__consent{display:flex;gap:10px;align-items:flex-start;font-size:.85rem;color:var(--fb-text-muted,#5f6b69)}
      .fb-lead__consent a{color:var(--fb-accent,#0ea5a4)}
      .fb-lead__btn{width:100%}
      .fb-lead__msg{font-size:.9rem;min-height:1.2em}
      .fb-lead__msg.ok{color:var(--fb-success,#16a34a)} .fb-lead__msg.err{color:var(--fb-danger,#ef4444)}
    </style>
    <script>
    (function(){
      var AJAX = <?php echo wp_json_encode($ajax); ?>;
      document.addEventListener('submit', async function(e){
        var form = e.target.closest('form[data-fb-lead]');
        if(!form) return;
        e.preventDefault();
        var msg = form.querySelector('.fb-lead__msg');
        var btn = form.querySelector('button[type=submit]');
        msg.className='fb-lead__msg'; msg.textContent='Отправляем…'; btn.disabled=true;
        try{
          var fd = new FormData(form); fd.append('action','fb_lead');
          var r = await fetch(AJAX,{method:'POST',body:fd});
          var j = await r.json();
          if(j.success){ msg.classList.add('ok'); msg.textContent=j.data.message||'Заявка отправлена!'; form.reset(); }
          else { msg.classList.add('err'); msg.textContent=(j.data&&j.data.message)||'Ошибка отправки.'; }
        }catch(err){ msg.classList.add('err'); msg.textContent='Ошибка сети. Попробуйте ещё раз.'; }
        finally{ btn.disabled=false; }
      });
    })();
    </script>
    <?php
}

/** Обработчик AJAX (для гостей и авторизованных). */
function forestbyte_handle_lead() {
    // 1. Защита: nonce
    if (!isset($_POST['_nonce']) || !wp_verify_nonce($_POST['_nonce'], 'fb_lead')) {
        wp_send_json_error(['message' => 'Сессия устарела, обновите страницу.']);
    }
    // 2. Антиспам: honeypot
    if (!empty($_POST['website'])) {
        wp_send_json_success(['message' => 'Заявка отправлена!']); // тихо игнорируем бота
    }
    // 3. Согласие
    if (empty($_POST['consent'])) {
        wp_send_json_error(['message' => 'Нужно согласие с политикой конфиденциальности.']);
    }

    $data = [
        'name'    => sanitize_text_field($_POST['name'] ?? ''),
        'phone'   => sanitize_text_field($_POST['phone'] ?? ''),
        'email'   => sanitize_email($_POST['email'] ?? ''),
        'comment' => sanitize_textarea_field($_POST['comment'] ?? ''),
        'title'   => 'Заявка с сайта: ' . get_bloginfo('name'),
    ];
    if ($data['name'] === '' || $data['phone'] === '') {
        wp_send_json_error(['message' => 'Заполните имя и телефон.']);
    }

    $s = forestbyte_get_settings();

    // 4. Дубль на e-mail (всегда, если задан) — резерв
    if (!empty($s['notify_email'])) {
        $body = "Имя: {$data['name']}\nТелефон: {$data['phone']}\nE-mail: {$data['email']}\nКомментарий: {$data['comment']}";
        wp_mail($s['notify_email'], 'Новая заявка с сайта', $body);
    }

    // 5. Отправка в CRM
    $crmResult = true;
    if ($s['crm_type'] === 'bitrix24' && !empty($s['bitrix_webhook'])) {
        require_once FORESTBYTE_PATH . 'includes/crm/bitrix24.php';
        $crm = new ForestbyteBitrix24($s['bitrix_webhook']);
        $crmResult = $crm->createLead($data);
    } elseif ($s['crm_type'] === 'amocrm' && !empty($s['amocrm_subdomain']) && !empty($s['amocrm_token'])) {
        require_once FORESTBYTE_PATH . 'includes/crm/amocrm.php';
        $crm = new ForestbyteAmoCRM($s['amocrm_subdomain'], $s['amocrm_token']);
        $crmResult = $crm->createLead($data);
    }

    // Заявку на почту мы уже отправили — даже при сбое CRM клиент не потерян
    if ($crmResult !== true) {
        wp_send_json_success(['message' => 'Заявка принята! Мы свяжемся с вами.']);
    }
    wp_send_json_success(['message' => 'Спасибо! Заявка отправлена, скоро свяжемся.']);
}
add_action('wp_ajax_fb_lead', 'forestbyte_handle_lead');
add_action('wp_ajax_nopriv_fb_lead', 'forestbyte_handle_lead');
