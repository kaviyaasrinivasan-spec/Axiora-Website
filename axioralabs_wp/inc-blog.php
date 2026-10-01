<?php
/**
 * Blog extras — table of contents + newsletter signup.
 *
 * Hand-written. build_theme.js never writes this file and never deletes files
 * it does not write, so it survives `node build/build_theme.js` untouched.
 * functions.php requires it (that require is part of the build template too).
 */
if(!defined('ABSPATH'))exit;

/* ==============================================================
   TABLE OF CONTENTS
   ============================================================== */

/**
 * Give every h2/h3 in a chunk of post HTML a stable id and collect them.
 *
 * Runs twice per request over the same headings in the same order — once on the
 * raw content to build the sidebar list, once through the_content to stamp the
 * ids onto the rendered markup — so both passes produce the same slugs and the
 * anchors line up.
 *
 * @return array{html:string,items:array<int,array{id:string,text:string,level:int}>}
 */
function wb_toc_build($html){
  $items = array();
  $used  = array();

  $out = preg_replace_callback('/<h([23])([^>]*)>(.*?)<\/h\1>/is', function($m) use (&$items,&$used){
    $level = (int) $m[1];
    $attr  = $m[2];
    $inner = $m[3];

    /* Decode entities before storing: the editor writes "Sales &amp; Ops", and without this
       esc_html() in the template would escape it a second time and print the &amp; literally. */
    $text = html_entity_decode(wp_strip_all_tags($inner), ENT_QUOTES, 'UTF-8');
    $text = trim(preg_replace('/\s+/',' ',$text));
    if($text === '') return $m[0];

    if(preg_match('/\bid=["\']([^"\']+)["\']/i',$attr,$has)){
      $id = $has[1];
    }else{
      $base = sanitize_title($text);
      if($base === '') $base = 'section';
      $id = $base;
      $n  = 2;
      while(isset($used[$id])){ $id = $base.'-'.$n; $n++; }
      $attr .= ' id="'.esc_attr($id).'"';
    }

    $used[$id] = true;
    $items[]   = array('id'=>$id,'text'=>$text,'level'=>$level);

    return '<h'.$level.$attr.'>'.$inner.'</h'.$level.'>';
  }, $html);

  if($out === null) $out = $html;   /* PCRE backtrack limit — leave content alone */

  return array('html'=>$out,'items'=>$items);
}

/** Headings of the current post, in document order. Cached per post. */
function wb_toc_items(){
  static $cache = array();
  $id = get_the_ID();
  if(!$id) return array();
  if(!isset($cache[$id])){
    $post = get_post($id);
    $r = $post ? wb_toc_build($post->post_content) : array('items'=>array());
    $cache[$id] = $r['items'];
  }
  return $cache[$id];
}

/** Should this post show a contents panel? Short posts do not need one. */
function wb_toc_enabled(){
  return count(wb_toc_items()) >= 3;
}

/* Stamp the ids onto the rendered article. Priority 12 puts this after wpautop. */
add_filter('the_content', function($html){
  if(!is_singular('post') || !in_the_loop() || !is_main_query()) return $html;
  $r = wb_toc_build($html);
  return $r['html'];
}, 12);

/* ==============================================================
   NEWSLETTER SUBSCRIBERS
   ============================================================== */

/**
 * Subscribers are stored as a private post type so they are visible and
 * exportable from wp-admin without a plugin. Not public, not searchable, and
 * new ones cannot be typed in by hand — they only arrive through the form.
 */
function wb_subscriber_post_type(){
  register_post_type('wb_subscriber', array(
    'labels' => array(
      'name'               => 'Subscribers',
      'singular_name'      => 'Subscriber',
      'menu_name'          => 'Subscribers',
      'all_items'          => 'All Subscribers',
      'search_items'       => 'Search subscribers',
      'not_found'          => 'No subscribers yet.',
      'not_found_in_trash' => 'No subscribers in trash.',
    ),
    'public'              => false,
    'publicly_queryable'  => false,
    'exclude_from_search' => true,
    'show_ui'             => true,
    'show_in_menu'        => true,
    'menu_position'       => 26,
    'menu_icon'           => 'dashicons-email-alt',
    'supports'            => array('title'),
    'capability_type'     => 'post',
    'map_meta_cap'        => true,
    'capabilities'        => array('create_posts'=>'do_not_allow'),
    'has_archive'         => false,
    'rewrite'             => false,
  ));
}
add_action('init','wb_subscriber_post_type');

/* Subscriber list table: email, where they signed up, when. */
add_filter('manage_wb_subscriber_posts_columns', function($cols){
  return array(
    'cb'        => isset($cols['cb']) ? $cols['cb'] : '',
    'title'     => 'Email',
    'wb_source' => 'Signed up on',
    'date'      => 'Date',
  );
});
add_action('manage_wb_subscriber_posts_custom_column', function($col,$post_id){
  if($col !== 'wb_source') return;
  $src = get_post_meta($post_id,'_wb_source',true);
  echo $src ? '<a href="'.esc_url($src).'" target="_blank" rel="noopener">'.esc_html($src).'</a>' : '&mdash;';
}, 10, 2);

/** Message shown for each outcome. Keys double as the ?wb_sub= redirect value. */
function wb_subscribe_messages(){
  return array(
    'ok'        => array('ok'=>true,  'text'=>"You're on the list — thanks for subscribing."),
    'dupe'      => array('ok'=>true,  'text'=>"You're already subscribed. Thanks for reading."),
    'invalid'   => array('ok'=>false, 'text'=>'Please enter a valid email address.'),
    'expired'   => array('ok'=>false, 'text'=>'That form expired. Please refresh the page and try again.'),
    'throttled' => array('ok'=>false, 'text'=>'Too many attempts. Please try again in a little while.'),
    'error'     => array('ok'=>false, 'text'=>'Something went wrong. Please try again.'),
  );
}

/**
 * Notice for a non-JS submit, read back off the redirect.
 *
 * A page can carry two forms (sidebar card and bottom band); only the one that
 * was actually submitted shows the result. Null when there is nothing to show.
 */
function wb_subscribe_notice($variant='band'){
  if(empty($_GET['wb_sub'])) return null;
  $from = isset($_GET['wb_from']) ? sanitize_key(wp_unslash($_GET['wb_from'])) : 'band';
  if($from !== $variant) return null;
  $code = sanitize_key(wp_unslash($_GET['wb_sub']));
  $all  = wb_subscribe_messages();
  if(!isset($all[$code])) return null;
  return array('ok'=>$all[$code]['ok'],'text'=>$all[$code]['text']);
}

/** Send the outcome back — JSON for the fetch() path, a redirect for plain POST. */
function wb_subscribe_finish($code,$ajax,$from='band'){
  $all = wb_subscribe_messages();
  $msg = isset($all[$code]) ? $all[$code] : $all['error'];

  if($ajax){
    wp_send_json(array('ok'=>$msg['ok'],'code'=>$code,'message'=>$msg['text']));
  }

  $back = wp_get_referer();
  if(!$back) $back = home_url('/');
  $back = remove_query_arg(array('wb_sub','wb_from'),$back);
  $back = add_query_arg(array('wb_sub'=>$code,'wb_from'=>$from),$back);
  wp_safe_redirect($back.'#subscribe');
  exit;
}

function wb_handle_subscribe(){
  $ajax = !empty($_POST['wb_ajax']);
  $from = (isset($_POST['wb_from']) && sanitize_key(wp_unslash($_POST['wb_from'])) === 'side') ? 'side' : 'band';

  /* honeypot — bots fill it, people never see it. Answer as if it worked. */
  if(!empty($_POST['wb_website'])) wb_subscribe_finish('ok',$ajax,$from);

  /* The nonce is enforced for logged-in users only, and deliberately so: a page
     cache hands every anonymous visitor the same stale nonce, which would turn
     every real signup into "that form expired". Subscribing grants no privilege
     and exposes nothing, so the honeypot above plus the throttle and address
     validation below carry the weight for logged-out visitors. */
  if(is_user_logged_in()){
    if(empty($_POST['wb_nonce']) || !wp_verify_nonce(wp_unslash($_POST['wb_nonce']),'wb_subscribe')){
      wb_subscribe_finish('expired',$ajax,$from);
    }
  }

  /* light per-IP throttle */
  $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
  if($ip){
    $key   = 'wb_sub_'.md5($ip);
    $tries = (int) get_transient($key);
    if($tries >= 8) wb_subscribe_finish('throttled',$ajax,$from);
    set_transient($key,$tries + 1,HOUR_IN_SECONDS);
  }

  $email = isset($_POST['wb_email']) ? sanitize_email(wp_unslash($_POST['wb_email'])) : '';
  if(!$email || !is_email($email)) wb_subscribe_finish('invalid',$ajax,$from);

  $existing = get_posts(array(
    'post_type'        => 'wb_subscriber',
    'post_status'      => 'any',
    'posts_per_page'   => 1,
    'fields'           => 'ids',
    'no_found_rows'    => true,
    'suppress_filters' => false,
    'meta_key'         => '_wb_email',
    'meta_value'       => $email,
  ));
  if($existing) wb_subscribe_finish('dupe',$ajax,$from);

  $source = wp_get_referer();
  $id = wp_insert_post(array(
    'post_type'   => 'wb_subscriber',
    'post_status' => 'publish',
    'post_title'  => $email,
    'meta_input'  => array(
      '_wb_email'  => $email,
      '_wb_source' => $source ? esc_url_raw($source) : '',
    ),
  ), true);

  if(is_wp_error($id) || !$id) wb_subscribe_finish('error',$ajax,$from);

  $to = apply_filters('wb_subscribe_notify_email', get_option('admin_email'));
  if($to){
    wp_mail(
      $to,
      'New blog subscriber: '.$email,
      "A new reader subscribed to the Axiora Labs blog.\n\n"
        ."Email:  ".$email."\n"
        ."Page:   ".($source ? $source : 'unknown')."\n"
        ."Date:   ".current_time('j M Y, H:i')."\n\n"
        ."All subscribers: ".admin_url('edit.php?post_type=wb_subscriber')."\n"
    );
  }

  wb_subscribe_finish('ok',$ajax,$from);
}
add_action('admin_post_wb_subscribe','wb_handle_subscribe');
add_action('admin_post_nopriv_wb_subscribe','wb_handle_subscribe');
