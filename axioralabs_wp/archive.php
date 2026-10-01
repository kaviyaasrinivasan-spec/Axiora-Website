<?php
/**
 * Category, tag, author and date archives. Same grid as the Blog page, with a
 * heading that says which slice of the blog you are looking at.
 */
if(!defined('ABSPATH'))exit;
get_header();

$wb_blog_url = get_permalink(get_option('page_for_posts'));
$wb_desc     = wp_strip_all_tags(get_the_archive_description());
$wb_cats     = get_categories(array('hide_empty'=>true,'number'=>6,'orderby'=>'count','order'=>'DESC'));
$wb_current  = is_category() ? (int) get_queried_object_id() : 0;
?>
<main id="top">

  <section class="blog-hero">
    <div class="wrap inner">
      <span class="eyebrow reveal"><?php
        if(is_category()) echo 'Category';
        elseif(is_tag()) echo 'Topic';
        elseif(is_author()) echo 'Author';
        else echo 'Archive';
      ?></span>
      <h1 class="reveal"><?php echo esc_html(wp_strip_all_tags(get_the_archive_title())); ?></h1>
      <p class="reveal"><?php echo esc_html($wb_desc ? $wb_desc : 'Everything we have written on this topic.'); ?></p>
      <?php if($wb_cats): ?>
        <div class="blog-cats reveal">
          <?php if($wb_blog_url): ?><a class="blog-cat" href="<?php echo esc_url($wb_blog_url); ?>">All</a><?php endif; ?>
          <?php foreach($wb_cats as $wb_c): ?>
            <a class="blog-cat<?php echo ($wb_current===(int)$wb_c->term_id)?' is-current':''; ?>"
               href="<?php echo esc_url(get_category_link($wb_c->term_id)); ?>"><?php echo esc_html($wb_c->name); ?></a>
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
