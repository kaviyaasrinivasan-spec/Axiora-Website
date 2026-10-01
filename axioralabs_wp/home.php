<?php
/**
 * The Blog page.
 *
 * WordPress uses this file for the page assigned under
 * Settings → Reading → "Posts page". Create a page called Blog, assign it there,
 * and every post is listed here — and only here.
 */
if(!defined('ABSPATH'))exit;
get_header();

$wb_intro = wb_blog_intro();
if(!$wb_intro) $wb_intro = 'Practical frameworks, automation roadmaps and industry insights from our AI engineering team.';
$wb_cats = get_categories(array('hide_empty'=>true,'number'=>6,'orderby'=>'count','order'=>'DESC'));
?>
<main id="top">

  <section class="blog-hero">
    <div class="wrap inner">
      <span class="eyebrow reveal">Latest research &amp; insights</span>
      <h1 class="reveal"><?php echo esc_html(wb_blog_title()); ?></h1>
      <p class="reveal"><?php echo esc_html($wb_intro); ?></p>
      <?php if($wb_cats): ?>
        <div class="blog-cats reveal">
          <a class="blog-cat is-current" href="<?php echo esc_url(get_permalink(get_option('page_for_posts'))); ?>">All</a>
          <?php foreach($wb_cats as $wb_c): ?>
            <a class="blog-cat" href="<?php echo esc_url(get_category_link($wb_c->term_id)); ?>"><?php echo esc_html($wb_c->name); ?></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <?php get_template_part('parts-blog-loop'); ?>
    </div>
  </section>

  <?php get_template_part('parts-newsletter',null,array('variant'=>'band')); ?>

</main>
<?php get_footer();
