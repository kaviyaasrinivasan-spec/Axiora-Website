<?php
/**
 * Single post — Axiora Labs
 *
 * Class names here match assets/css/blog.css. Keep them in sync: the previous
 * version used .post-hero / .post-content-body / .wrap-narrow, none of which
 * exist in the stylesheet, so articles rendered as unstyled full-width text.
 */
if(!defined('ABSPATH'))exit;
get_header();

while(have_posts()): the_post();
  $wb_cat    = get_the_category();
  $wb_author = get_the_author();
  $wb_url    = get_permalink();
  $wb_title  = get_the_title();

  /* initials for the byline avatar */
  $wb_parts = preg_split('/\s+/', trim($wb_author));
  $wb_ini   = strtoupper(mb_substr($wb_parts[0],0,1) . (count($wb_parts)>1 ? mb_substr(end($wb_parts),0,1) : ''));

  /* Contents panel — only on articles long enough to need one (3+ headings). */
  $wb_toc  = wb_toc_items();
  $wb_side = wb_toc_enabled();
?>
<main id="top">
  <div class="read-bar" aria-hidden="true"><span></span></div>

  <article <?php post_class(); ?>>

    <header class="article-hero">
      <div class="wrap">
        <div class="article-head">
          <?php if($wb_cat): ?>
            <a class="eyebrow reveal" href="<?php echo esc_url(get_category_link($wb_cat[0]->term_id)); ?>"><?php echo esc_html($wb_cat[0]->name); ?></a>
          <?php endif; ?>

          <h1 class="reveal"><?php the_title(); ?></h1>

          <?php if(has_excerpt()): ?>
            <p class="article-standfirst reveal"><?php echo esc_html(get_the_excerpt()); ?></p>
          <?php endif; ?>

          <div class="article-byline reveal">
            <span class="byline-avatar"><?php echo esc_html($wb_ini); ?></span>
            <span class="byline-text">
              <strong><?php echo esc_html($wb_author); ?></strong>
              <span>
                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('j M Y')); ?></time>
                &middot; <?php echo esc_html(wb_reading_time()); ?>
              </span>
            </span>
          </div>
        </div>

        <?php if(has_post_thumbnail()): ?>
          <figure class="article-figure reveal"><?php the_post_thumbnail('large',array('alt'=>esc_attr($wb_title))); ?></figure>
        <?php endif; ?>
      </div>
    </header>

    <div class="article-wrap">
      <div class="wrap<?php echo $wb_side ? ' article-layout' : ''; ?>">

        <?php if($wb_side): ?>
        <aside class="article-side">

          <div class="toc-card is-open" id="toc">
            <button class="toc-head" type="button" aria-expanded="true" aria-controls="toc-body">
              <span>Table of Contents</span>
              <svg class="icon toc-chev" aria-hidden="true"><use href="#i-chev"/></svg>
            </button>
            <nav class="toc-body" id="toc-body" aria-label="Article contents">
              <ol class="toc-list">
                <?php foreach($wb_toc as $wb_h): ?>
                  <li class="lvl-<?php echo (int) $wb_h['level']; ?>">
                    <a href="#<?php echo esc_attr($wb_h['id']); ?>"><?php echo esc_html($wb_h['text']); ?></a>
                  </li>
                <?php endforeach; ?>
              </ol>
            </nav>
          </div>

          <?php get_template_part('parts-newsletter',null,array('variant'=>'side')); ?>

          <a class="side-cta" href="/contact/">
            <span class="side-cta-k">Free consultation</span>
            <strong>Talk to an AI engineer about your workflow</strong>
            <span class="side-cta-go">Book a call <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></span>
          </a>

        </aside>
        <?php endif; ?>

        <div class="article-main">

        <div class="post-body">
          <?php the_content(); ?>
        </div>

        <div class="article-share">
          <span>Share</span>
          <a class="share-btn" target="_blank" rel="noopener" aria-label="Share on LinkedIn"
             href="https://www.linkedin.com/sharing/share-offsite/?url=<?php echo rawurlencode($wb_url); ?>">
            <svg class="icon"><use href="#i-linkedin"/></svg>
          </a>
          <a class="share-btn" target="_blank" rel="noopener" aria-label="Share on X"
             href="https://twitter.com/intent/tweet?url=<?php echo rawurlencode($wb_url); ?>&amp;text=<?php echo rawurlencode($wb_title); ?>">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z"/></svg>
          </a>
          <a class="share-btn" target="_blank" rel="noopener" aria-label="Share on WhatsApp"
             href="https://wa.me/?text=<?php echo rawurlencode($wb_title.' '.$wb_url); ?>">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.04s.87 2.37 1 2.53c.12.17 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>
          </a>
          <a class="share-btn" aria-label="Share by email"
             href="mailto:?subject=<?php echo rawurlencode($wb_title); ?>&amp;body=<?php echo rawurlencode($wb_url); ?>">
            <svg class="icon"><use href="#i-mail"/></svg>
          </a>
        </div>

        <?php if(get_the_author_meta('description')): ?>
          <aside class="article-author">
            <span class="byline-avatar"><?php echo esc_html($wb_ini); ?></span>
            <div>
              <h3><?php echo esc_html($wb_author); ?></h3>
              <p class="role">Axiora Labs</p>
              <p><?php echo esc_html(get_the_author_meta('description')); ?></p>
            </div>
          </aside>
        <?php endif; ?>

        <?php
        $wb_prev = get_previous_post();
        $wb_next = get_next_post();
        if($wb_prev || $wb_next):
        ?>
        <nav class="article-nav">
          <?php if($wb_prev): ?>
            <a href="<?php echo esc_url(get_permalink($wb_prev)); ?>">
              <span class="dir"><svg class="icon"><use href="#i-left"/></svg> Previous</span>
              <span class="t"><?php echo esc_html(get_the_title($wb_prev)); ?></span>
            </a>
          <?php else: ?><span></span><?php endif; ?>

          <?php if($wb_next): ?>
            <a class="next" href="<?php echo esc_url(get_permalink($wb_next)); ?>">
              <span class="dir">Next <svg class="icon"><use href="#i-right"/></svg></span>
              <span class="t"><?php echo esc_html(get_the_title($wb_next)); ?></span>
            </a>
          <?php endif; ?>
        </nav>
        <?php endif; ?>

        </div><!-- /.article-main -->
      </div>
    </div>

  </article>

  <?php
  /* Related — same category, newest first */
  $wb_rel = $wb_cat ? new WP_Query(array(
    'post__not_in'        => array(get_the_ID()),
    'posts_per_page'      => 3,
    'ignore_sticky_posts' => 1,
    'cat'                 => $wb_cat[0]->term_id,
  )) : null;

  if($wb_rel && $wb_rel->have_posts()):
  ?>
  <section class="related-section">
    <div class="wrap">
      <div class="related-head reveal">
        <span class="eyebrow">Keep reading</span>
        <h2>Related articles</h2>
      </div>
      <div class="post-grid">
        <?php while($wb_rel->have_posts()): $wb_rel->the_post(); $wb_rc = get_the_category(); ?>
          <article class="post-card reveal">
            <a class="post-thumb" href="<?php the_permalink(); ?>" aria-hidden="true" tabindex="-1">
              <?php if($wb_rc): ?><span class="post-chip"><?php echo esc_html($wb_rc[0]->name); ?></span><?php endif; ?>
              <?php wb_post_thumb('medium_large'); ?>
            </a>
            <div class="post-card-body">
              <div class="post-meta">
                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('j M Y')); ?></time>
                <span class="dot"></span>
                <span><?php echo esc_html(wb_reading_time()); ?></span>
              </div>
              <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
              <p><?php echo esc_html(wb_excerpt(20)); ?></p>
              <a class="post-more" href="<?php the_permalink(); ?>">Read article <svg class="icon"><use href="#i-arrow"/></svg></a>
            </div>
          </article>
        <?php endwhile; wp_reset_postdata(); ?>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php get_template_part('parts-newsletter',null,array('variant'=>'band')); ?>

</main>
<?php
endwhile;
get_footer();
