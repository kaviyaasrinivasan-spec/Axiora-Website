<?php
/**
 * Contact / audit lead form.
 *
 * Posts to admin-post.php (wb_handle_lead below); contact.js upgrades it to a
 * fetch() submit so the page does not reload. This function itself is still
 * email-only and stores nothing — every valid submission fires the
 * 'wb_lead_captured' action (see below) so a plugin (e.g. axiora-leads) can
 * persist it separately; with no listener attached this is a no-op and the
 * behaviour here is unchanged. If the email send fails the visitor is told so
 * and pointed at the phone number, because this function has no saved copy of
 * its own to recover the lead from later.
 *
 * Recipient is filterable:
 *   add_filter('wb_lead_notify_email', function(){ return 'someone@example.com'; });
 */
if(!defined('ABSPATH'))exit;

define('WB_LEAD_TO','sales@axioralabs.ai');

/**
 * The select options, keyed by the value the form posts.
 *
 * Options carry explicit ASCII values in the markup so this whitelist never has
 * to compare against display text containing an en-dash. The label is what goes
 * into the notification email.
 */
function wb_lead_choices(){
  return array(
    'employeeCount' => array(
      '1-10'=>'1–10','11-25'=>'11–25','26-50'=>'26–50','51-100'=>'51–100','100plus'=>'100+'
    ),
    'timeline' => array(
      'immediately'=>'Immediately','1month'=>'Within 1 Month',
      '3months'=>'Within 3 Months','exploring'=>'Just Exploring'
    ),
    'repetitiveProcess' => array(
      'data-entry'=>'Data Entry','follow-ups'=>'Customer Follow-ups',
      'service-verification'=>'Service Verification','invoice'=>'Invoice Processing',
      'reports'=>'Report Generation','approvals'=>'Approval Workflow',
      'document-verification'=>'Document Verification','other'=>'Other'
    ),
  );
}

/**
 * Log a line about a submission to wp-content/debug.log.
 *
 * wp_mail() returning true only means the mail was handed off, not delivered, so
 * "the visitor saw Thanks" is not evidence the mail left the building. These lines
 * are what tell a honeypot trip, a validation bounce, a failed handoff and an
 * apparently-fine send apart from each other.
 *
 * Needs WP_DEBUG and WP_DEBUG_LOG on in wp-config.php to write anywhere.
 */
function wb_lead_log($line){
  if(!defined('WP_DEBUG') || !WP_DEBUG) return;
  error_log('[wb_lead] '.$line);
}

/* Always record a hard send failure: wp_mail() only reports false, never why. */
add_action('wp_mail_failed',function($err){
  if(is_wp_error($err)) error_log('[wb_lead] wp_mail failed: '.$err->get_error_message());
});

function wb_lead_messages(){
  return array(
    'ok'        => array('ok'=>true, 'text'=>'Thanks — we have your request. Our team will call you within 24 business hours.'),
    'name'      => array('ok'=>false,'text'=>'Please enter your full name.'),
    'company'   => array('ok'=>false,'text'=>'Please enter your company name.'),
    'email'     => array('ok'=>false,'text'=>'Please enter a valid email address.'),
    'mobile'    => array('ok'=>false,'text'=>'Please enter a valid 10-digit mobile number.'),
    'choice'    => array('ok'=>false,'text'=>'Please choose an option in each dropdown.'),
    'expired'   => array('ok'=>false,'text'=>'That form expired. Please reload the page and try again.'),
    'throttled' => array('ok'=>false,'text'=>'We already have a few requests from you. Please call +91 8122784236 instead.'),
    'sendfail'  => array('ok'=>false,'text'=>'We could not send that just now. Please call +91 8122784236 or email sales@axioralabs.ai.'),
    'error'     => array('ok'=>false,'text'=>'Something went wrong. Please try again.'),
  );
}

/** Notice for a non-JS submit, read back off the redirect. Null when there is nothing to show. */
function wb_lead_notice(){
  if(empty($_GET['wb_lead'])) return null;
  $code = sanitize_key(wp_unslash($_GET['wb_lead']));
  $all  = wb_lead_messages();
  if(!isset($all[$code])) return null;
  return array('ok'=>$all[$code]['ok'],'text'=>$all[$code]['text']);
}

/** Send the outcome back — JSON for the fetch() path, a redirect for plain POST. */
function wb_lead_finish($code,$ajax){
  $all = wb_lead_messages();
  $msg = isset($all[$code]) ? $all[$code] : $all['error'];

  if($ajax){
    wp_send_json(array('ok'=>$msg['ok'],'code'=>$code,'message'=>$msg['text']));
  }

  $back = wp_get_referer();
  if(!$back) $back = home_url('/');
  $back = remove_query_arg(array('wb_lead'),$back);
  $back = add_query_arg(array('wb_lead'=>$code),$back);
  wp_safe_redirect($back.'#book');
  exit;
}

function wb_handle_lead(){
  $ajax = !empty($_POST['wb_ajax']);

  /* honeypot - bots fill it, people never see it. Answer as if it worked.
     Logged, because a trip here shows the visitor the success message without any
     mail being sent - indistinguishable from a delivery failure unless recorded. */
  if(!empty($_POST['wb_hp_leaveblank'])){
    wb_lead_log('honeypot tripped, no mail sent (value: '.substr(sanitize_text_field(wp_unslash($_POST['wb_hp_leaveblank'])),0,40).')');
    wb_lead_finish('ok',$ajax);
  }

  /* The nonce is enforced for logged-in users only, matching wb_handle_subscribe:
     a page cache hands every anonymous visitor the same stale nonce, which would
     turn every real enquiry into "that form expired". Submitting grants no
     privilege, so the honeypot above and the throttle below carry the weight for
     logged-out visitors. */
  if(is_user_logged_in()){
    if(empty($_POST['wb_nonce']) || !wp_verify_nonce(wp_unslash($_POST['wb_nonce']),'wb_lead')){
      wb_lead_finish('expired',$ajax);
    }
  }

  /* light per-IP throttle */
  $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
  if($ip){
    $key   = 'wb_lead_'.md5($ip);
    $tries = (int) get_transient($key);
    if($tries >= 6) wb_lead_finish('throttled',$ajax);
    set_transient($key,$tries + 1,HOUR_IN_SECONDS);
  }

  $name    = isset($_POST['fullName'])     ? sanitize_text_field(wp_unslash($_POST['fullName']))     : '';
  $company = isset($_POST['companyName'])  ? sanitize_text_field(wp_unslash($_POST['companyName']))  : '';
  $email   = isset($_POST['email'])        ? sanitize_email(wp_unslash($_POST['email']))              : '';
  $mobile  = isset($_POST['mobileNumber']) ? sanitize_text_field(wp_unslash($_POST['mobileNumber'])) : '';

  if($name === '')    wb_lead_finish('name',$ajax);
  if($company === '') wb_lead_finish('company',$ajax);
  if($email === '' || !is_email($email)) wb_lead_finish('email',$ajax);

  /* Strip spaces, dashes and a pasted +91 before counting digits - people type
     their number every one of those ways. */
  $digits = preg_replace('/\D/','',$mobile);
  if(strlen($digits) === 12 && strpos($digits,'91') === 0) $digits = substr($digits,2);
  if(strlen($digits) !== 10) wb_lead_finish('mobile',$ajax);

  /* Selects: must be one of the offered values, so a tampered post cannot put
     arbitrary text into the notification email. */
  $labels = array();
  foreach(wb_lead_choices() as $field=>$options){
    $posted = isset($_POST[$field]) ? sanitize_text_field(wp_unslash($_POST[$field])) : '';
    if(!isset($options[$posted])) wb_lead_finish('choice',$ajax);
    $labels[$field] = $options[$posted];
  }

  $notes = isset($_POST['processDescription'])
    ? sanitize_textarea_field(wp_unslash($_POST['processDescription'])) : '';
  if(strlen($notes) > 4000) $notes = substr($notes,0,4000);

  $source = wp_get_referer();

  /**
   * Fires once per validated, non-honeypot, non-throttled submission — placed
   * BEFORE the notification email is attempted, so a failed or misconfigured
   * wp_mail() can never cause a lead to go uncaptured. Nothing here reads a
   * return value, so this is a no-op (and this function's behaviour is entirely
   * unchanged) if no plugin is listening.
   *
   * @param array $data {
   *     @type string $full_name      Sanitized full name.
   *     @type string $email          Sanitized email address.
   *     @type string $phone          10 normalized digits, no country code.
   *     @type string $company        Sanitized company name.
   *     @type string $employee_count Label, e.g. "11–25".
   *     @type string $timeline       Label, e.g. "Within 1 Month".
   *     @type string $process        Label, e.g. "Invoice Processing".
   *     @type string $notes          Free text, capped at 4000 chars, may be ''.
   *     @type string $source_url     wp_get_referer() result, may be ''.
   *     @type string $ip             REMOTE_ADDR.
   *     @type string $user_agent     Raw HTTP_USER_AGENT, sanitized.
   * }
   */
  do_action('wb_lead_captured', array(
    'full_name'      => $name,
    'email'          => $email,
    'phone'          => $digits,
    'company'        => $company,
    'employee_count' => $labels['employeeCount'],
    'timeline'       => $labels['timeline'],
    'process'        => $labels['repetitiveProcess'],
    'notes'          => $notes,
    'source_url'     => $source ? $source : '',
    'ip'             => $ip,
    'user_agent'     => isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '',
  ));

  $to     = apply_filters('wb_lead_notify_email',WB_LEAD_TO);
  if(!$to || !is_email($to)) wb_lead_finish('sendfail',$ajax);

  $body = "A new enquiry came in from the website.\n\n"
    ."Name:      ".$name."\n"
    ."Email:     ".$email."\n"
    ."Company:   ".$company."\n"
    ."Mobile:    +91 ".$digits."\n"
    ."Employees: ".$labels['employeeCount']."\n"
    ."Timeline:  ".$labels['timeline']."\n"
    ."Process:   ".$labels['repetitiveProcess']."\n\n"
    ."Notes:\n".($notes !== '' ? $notes : '(none given)')."\n\n"
    ."---\n"
    ."Page: ".($source ? $source : 'unknown')."\n"
    ."Date: ".current_time('j M Y, H:i')."\n";

  wb_lead_log('sending to '.$to.' for '.$name.' / '.$company);
  $sent = wp_mail($to,'New enquiry: '.$name.' - '.$company,$body);

  /* This function itself stores nothing, so as far as it's concerned a failed
     send means the lead is gone — say so rather than showing a success message
     over a message that never left. (A plugin listening on wb_lead_captured
     above may have already saved a copy; this function has no way to know.) */
  if(!$sent){
    wb_lead_log('wp_mail() returned false - lead NOT delivered');
    wb_lead_finish('sendfail',$ajax);
  }

  /* Handed off, not necessarily delivered. If this line appears but no mail
     arrives, the problem is downstream: no SMTP, SPF/DKIM, or a bad mailbox. */
  wb_lead_log('wp_mail() returned true - handed off to the mail transport');

  wb_lead_finish('ok',$ajax);
}
add_action('admin_post_wb_lead','wb_handle_lead');
add_action('admin_post_nopriv_wb_lead','wb_handle_lead');
