<?php
/**
 * Fallback for pages that don't use one of the custom "Axiora — …" templates.
 *
 * Without this file WordPress falls back to index.php, which renders
 * "Page not found" — so any page created without picking a template would look
 * broken. This renders the page's own title and content in the site's styling.
 */
if(!defined('ABSPATH'))exit;
get_header();
?>
<main id="top">

  <section class="blog-hero">
    <div class="wrap inner">
      <h1 class="reveal"><?php the_title(); ?></h1>
    </div>
  </section>

  <section class="article-wrap">
    <div class="wrap">
      <div class="post-body reveal">
        <?php
        while(have_posts()): the_post();
          the_content();
          wp_link_pages(array('before'=>'<nav class="post-pager">','after'=>'</nav>'));
        endwhile;
        ?>
      </div>
    </div>
  </section>

</main>
<?php get_footer();
