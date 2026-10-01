<?php
/**
 * The post grid + pagination. Shared by home.php, archive.php and search.php.
 * Assumes it is called inside a .wrap.
 */
if(!defined('ABSPATH'))exit;

if(!have_posts()):
  ?>
  <div class="blog-empty reveal">
    <svg class="icon"><use href="#i-search"/></svg>
    <h2><?php echo is_search() ? 'No results found' : 'Nothing published here yet'; ?></h2>
    <p><?php echo is_search()
      ? 'We couldn&rsquo;t find anything matching that search. Try a different term, or browse everything we&rsquo;ve written.'
      : 'New articles are on the way. In the meantime, take a look at what we build.'; ?></p>
    <form class="blog-search" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
      <label class="screen-reader-text" for="wb-s">Search articles</label>
      <input type="search" id="wb-s" name="s" placeholder="Search articles&hellip;" value="<?php echo esc_attr(get_search_query()); ?>">
      <button class="btn btn-primary" type="submit">Search</button>
    </form>
  </div>
  <?php
  return;
endif;

$wb_i = 0;
?>
<div class="post-grid">
  <?php while(have_posts()): the_post();
    $wb_lead = ( is_home() && !is_paged() && 0 === $wb_i && get_query_var('paged') < 2 );
    $wb_cat  = get_the_category();
  ?>
  <article <?php post_class('post-card reveal'.($wb_lead?' is-lead':'')); ?>>
    <a class="post-thumb" href="<?php the_permalink(); ?>" aria-hidden="true" tabindex="-1">
      <?php if($wb_cat): ?><span class="post-chip"><?php echo esc_html($wb_cat[0]->name); ?></span><?php endif; ?>
      <?php wb_post_thumb($wb_lead?'large':'medium_large'); ?>
    </a>
    <div class="post-card-body">
      <div class="post-meta">
        <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('j M Y')); ?></time>
        <span class="dot"></span>
        <span><?php echo esc_html(wb_reading_time()); ?></span>
      </div>
      <?php if($wb_lead): ?>
        <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
      <?php else: ?>
        <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
      <?php endif; ?>
      <p><?php echo esc_html(wb_excerpt($wb_lead?42:24)); ?></p>
      <a class="post-more" href="<?php the_permalink(); ?>">Read article <svg class="icon"><use href="#i-arrow"/></svg></a>
    </div>
  </article>
  <?php $wb_i++; endwhile; ?>
</div>

<?php
$wb_pager = paginate_links(array(
  'type'      => 'list',
  'mid_size'  => 1,
  'prev_text' => '<span class="screen-reader-text">Previous</span>',
  'next_text' => '<span class="screen-reader-text">Next</span>',
  'before_page_number' => '',
));
if($wb_pager): ?>
<nav class="post-pager" aria-label="Pagination">
  <?php echo $wb_pager; ?>
</nav>
<?php endif; ?>
