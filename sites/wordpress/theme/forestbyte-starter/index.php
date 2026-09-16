<?php if (!defined('ABSPATH')) { exit; } get_header(); ?>

<div class="container">
  <?php if (have_posts()): ?>
    <?php while (have_posts()): the_post(); ?>
      <article <?php post_class('section'); ?>>
        <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
        <div class="entry"><?php the_content(); ?></div>
      </article>
    <?php endwhile; ?>
    <?php the_posts_pagination(); ?>
  <?php else: ?>
    <p>Записей не найдено.</p>
  <?php endif; ?>
</div>

<?php get_footer(); ?>
