<?php
/**
 * Search results — same grid as the Blog page.
 */
if(!defined('ABSPATH'))exit;
get_header();

global $wp_query;
$wb_found = (int) $wp_query->found_posts;
?>
<main id="top">

  <section class="blog-hero">
    <div class="wrap inner">
      <span class="eyebrow reveal">Search</span>
      <h1 class="reveal">Results for &ldquo;<?php echo esc_html(get_search_query()); ?>&rdquo;</h1>
      <p class="reveal"><?php
        echo esc_html($wb_found === 1 ? '1 result found.' : number_format_i18n($wb_found).' results found.');
      ?></p>
      <form class="blog-search reveal" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
        <label class="screen-reader-text" for="wb-s-top">Search</label>
        <input type="search" id="wb-s-top" name="s" placeholder="Search again&hellip;" value="<?php echo esc_attr(get_search_query()); ?>">
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <?php get_template_part('parts-blog-loop'); ?>
    </div>
  </section>

</main>
<?php get_footer();
