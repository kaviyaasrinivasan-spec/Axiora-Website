<?php
/**
 * Not found. Previously index.php served this purpose for everything; now it is
 * a real 404 so genuine misses are handled here and posts/archives get their own
 * templates.
 */
if(!defined('ABSPATH'))exit;
get_header();
$wb_blog = get_permalink(get_option('page_for_posts'));
?>
<main id="top">
  <section class="blog-hero">
    <div class="wrap inner">
      <span class="eyebrow reveal">404</span>
      <h1 class="reveal">Page not found</h1>
      <p class="reveal">The page you were looking for has moved or no longer exists.</p>
      <div class="axi-404-actions reveal" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:4px">
        <a class="btn btn-primary" href="<?php echo esc_url(home_url('/')); ?>">Go home <svg class="icon"><use href="#i-arrow"/></svg></a>
        <?php if($wb_blog): ?><a class="btn btn-ghost" href="<?php echo esc_url($wb_blog); ?>">Read the blog</a><?php endif; ?>
        <a class="btn btn-ghost" href="<?php echo esc_url(home_url('/contact/')); ?>">Contact us</a>
      </div>
      <form class="blog-search reveal" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
        <label class="screen-reader-text" for="wb-s-404">Search</label>
        <input type="search" id="wb-s-404" name="s" placeholder="Search the site&hellip;">
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
    </div>
  </section>
</main>
<?php get_footer();
