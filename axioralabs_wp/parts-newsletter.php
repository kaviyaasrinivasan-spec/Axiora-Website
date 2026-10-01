<?php
/**
 * Newsletter signup. Two variants, same form and same handler:
 *
 *   'side' — compact card for the article sidebar, under the contents panel
 *   'band' — full-width section at the foot of the blog and of every article
 *
 * Usage: get_template_part('parts-newsletter', null, array('variant'=>'side'));
 * Posts to admin-post.php (wb_handle_subscribe in inc-blog.php); blog.js
 * upgrades it to a fetch() submit so the page does not reload.
 */
if(!defined('ABSPATH'))exit;

$wb_variant = (isset($args['variant']) && $args['variant'] === 'side') ? 'side' : 'band';
$wb_uid     = 'wb-news-'.$wb_variant;
$wb_notice  = wb_subscribe_notice($wb_variant);
$wb_cls     = $wb_notice ? ($wb_notice['ok'] ? ' is-ok' : ' is-err') : '';
?>

<?php if($wb_variant === 'side'): ?>

  <div class="news-card">
    <div class="news-card-in">
      <h2 class="news-card-title">Newsletter</h2>
      <p class="news-card-sub">Practical AI insights, straight to your inbox.</p>
      <?php /* novalidate: the browser's own bubble is unstyled and easy to miss — blog.js
               shows the message inline instead, and the field turns red with it. */ ?>
      <form class="news-form<?php echo esc_attr($wb_cls); ?>" method="post" novalidate
            action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <input type="hidden" name="action" value="wb_subscribe">
        <input type="hidden" name="wb_from" value="side">
        <?php wp_nonce_field('wb_subscribe','wb_nonce'); ?>
        <div class="news-hp" aria-hidden="true">
          <label for="<?php echo esc_attr($wb_uid); ?>-hp">Leave this field empty</label>
          <input id="<?php echo esc_attr($wb_uid); ?>-hp" type="text" name="wb_website" tabindex="-1" autocomplete="off">
        </div>
        <label class="screen-reader-text" for="<?php echo esc_attr($wb_uid); ?>-email">Your email address</label>
        <input class="news-input" id="<?php echo esc_attr($wb_uid); ?>-email" type="email" name="wb_email"
               placeholder="Your Email Address" autocomplete="email" required>
        <button class="news-btn" type="submit">Subscribe</button>
        <?php /* One slot for both lines: the reassurance is swapped for the result, so the
                 button never moves when a message appears. */ ?>
        <div class="news-foot">
          <p class="news-msg" role="status" aria-live="polite"><?php echo $wb_notice ? esc_html($wb_notice['text']) : ''; ?></p>
          <p class="news-fine">No spam. Unsubscribe anytime.</p>
        </div>
      </form>
    </div>
  </div>

<?php else: ?>

  <section class="news-band" id="subscribe">
    <div class="wrap">
      <div class="news-band-in reveal">
        <div class="news-band-copy">
          <span class="eyebrow on-dark">Newsletter</span>
          <h2>AI insights worth the inbox space</h2>
          <p>New articles, automation playbooks and lessons from live enterprise AI projects — sent as we publish them.</p>
          <ul class="news-points">
            <li><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Practical frameworks, not hype</li>
            <li><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Written by the team doing the work</li>
            <li><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> No spam. Unsubscribe anytime</li>
          </ul>
        </div>

        <div class="news-band-form">
          <form class="news-form<?php echo esc_attr($wb_cls); ?>" method="post" novalidate
                action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="wb_subscribe">
            <input type="hidden" name="wb_from" value="band">
            <?php wp_nonce_field('wb_subscribe','wb_nonce'); ?>
            <div class="news-hp" aria-hidden="true">
              <label for="<?php echo esc_attr($wb_uid); ?>-hp">Leave this field empty</label>
              <input id="<?php echo esc_attr($wb_uid); ?>-hp" type="text" name="wb_website" tabindex="-1" autocomplete="off">
            </div>
            <label class="news-label" for="<?php echo esc_attr($wb_uid); ?>-email">Get new articles by email</label>
            <div class="news-row">
              <input class="news-input" id="<?php echo esc_attr($wb_uid); ?>-email" type="email" name="wb_email"
                     placeholder="you@company.com" autocomplete="email" required>
              <button class="news-btn" type="submit">Subscribe <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>
            </div>
            <div class="news-foot">
              <p class="news-msg" role="status" aria-live="polite"><?php echo $wb_notice ? esc_html($wb_notice['text']) : ''; ?></p>
              <p class="news-fine">By subscribing you agree to our <a href="/privacy-policy/">Privacy Policy</a>.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>

<?php endif; ?>
