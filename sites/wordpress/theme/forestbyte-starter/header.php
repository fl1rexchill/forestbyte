<?php if (!defined('ABSPATH')) { exit; } ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header">
  <div class="container">
    <a class="site-title" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a>
    <nav class="main-nav">
      <?php
      wp_nav_menu([
          'theme_location' => 'primary',
          'container'      => false,
          'items_wrap'     => '%3$s',
          'fallback_cb'    => '__return_empty_string',
          'depth'          => 1,
      ]);
      ?>
    </nav>
  </div>
</header>

<main class="site-main">
