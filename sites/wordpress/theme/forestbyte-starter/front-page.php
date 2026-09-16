<?php
/**
 * Демо-главная. Показывает виджеты через шорткоды плагина Forestbyte.
 * Если плагин не активен — блоки просто не выводятся.
 */
if (!defined('ABSPATH')) { exit; }
get_header();

$has = function ($tag) { return function_exists('shortcode_exists') && shortcode_exists($tag); };
?>

<section class="hero">
  <div class="container">
    <h1><?php bloginfo('name'); ?></h1>
    <p><?php echo esc_html(get_bloginfo('description') ?: 'Современный сайт на готовых блоках Forestbyte.'); ?></p>
    <?php if ($has('fb_modal')): ?>
      <a class="fb-btn" href="#lead">Оставить заявку</a>
    <?php endif; ?>
  </div>
</section>

<?php if ($has('fb_counter')): ?>
<section class="section">
  <div class="container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;text-align:center">
    <div><div style="font-size:2.4rem;font-weight:800;color:var(--fb-accent)"><?php echo do_shortcode('[fb_counter to="1500" suffix="+"]'); ?></div>проектов</div>
    <div><div style="font-size:2.4rem;font-weight:800;color:var(--fb-accent)"><?php echo do_shortcode('[fb_counter to="12" suffix=" лет"]'); ?></div>на рынке</div>
    <div><div style="font-size:2.4rem;font-weight:800;color:var(--fb-accent)"><?php echo do_shortcode('[fb_counter to="98" suffix="%"]'); ?></div>довольны</div>
  </div>
</section>
<?php endif; ?>

<?php if ($has('fb_testimonials')): ?>
<section class="section">
  <div class="container">
    <h2>Отзывы</h2>
    <?php echo do_shortcode('[fb_testimonials autoplay="6000" items=\'[{"name":"Анна","role":"Клиент","text":"Всё быстро и по делу!","rating":5},{"name":"Игорь","role":"Клиент","text":"Рекомендую.","rating":5}]\']'); ?>
  </div>
</section>
<?php endif; ?>

<?php if ($has('fb_faq')): ?>
<section class="section">
  <div class="container">
    <h2>Частые вопросы</h2>
    <?php echo do_shortcode('[fb_faq single="1" items=\'[{"q":"Сколько стоит?","a":"От 30 000 ₽."},{"q":"Какие сроки?","a":"1–2 недели."}]\']'); ?>
  </div>
</section>
<?php endif; ?>

<?php if ($has('fb_lead_form')): ?>
<section class="section" id="lead">
  <div class="container">
    <h2>Свяжитесь с нами</h2>
    <?php echo do_shortcode('[fb_lead_form title="Оставить заявку" button="Отправить"]'); ?>
  </div>
</section>
<?php endif; ?>

<?php get_footer(); ?>
