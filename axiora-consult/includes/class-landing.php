<?php
/**
 * The public "Book a Free AI Consultation" landing page and its form handler.
 *
 * The page is a normal WordPress page (slug AXC_PAGE_SLUG) so Yoast, analytics
 * and permalinks treat it like any other page; this class swaps in the
 * standalone landing layout for it and stores each submission in the
 * dashboard's table, then emails an alert.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Consult_Landing {

	/** Max submissions per IP per hour before the form politely refuses. */
	const RATE_LIMIT = 5;

	public static function init() {
		add_filter( 'template_include', array( __CLASS__, 'template' ), 99 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ), 100 );
		// The form posts to the landing page itself, not admin-post.php: for a
		// logged-in visitor admin-post.php runs every plugin's admin_init, and
		// Hostinger's onboarding hooks redirect there before the form is handled.
		add_action( 'init', array( __CLASS__, 'maybe_handle_submit' ), 20 );
	}

	public static function maybe_handle_submit() {
		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';
		if ( 'POST' === $method && isset( $_POST['axc_action'] ) && 'axc_submit' === $_POST['axc_action'] ) {
			self::handle_submit();
		}
	}

	public static function is_landing() {
		$id = (int) get_option( 'axc_page_id' );
		return $id ? is_page( $id ) : is_page( AXC_PAGE_SLUG );
	}

	public static function template( $template ) {
		if ( self::is_landing() ) {
			// Submissions must never be served from a page cache.
			nocache_headers();
			return AXC_DIR . 'templates/landing.php';
		}
		return $template;
	}

	/** Standalone layout: drop the theme's marketing CSS/JS, load only ours. */
	public static function assets() {
		if ( ! self::is_landing() ) {
			return;
		}

		wp_dequeue_style( 'wb-base' );
		wp_dequeue_style( 'wb-page' );
		wp_dequeue_script( 'wb-main' );

		wp_enqueue_style( 'axc-landing', AXC_URL . 'assets/css/landing.css', array(), AXC_VERSION );
		wp_enqueue_script( 'axc-landing', AXC_URL . 'assets/js/landing.js', array(), AXC_VERSION, true );
	}

	/* ---------------------------------------------------------------------
	 * Form
	 * ------------------------------------------------------------------ */

	/** Visitor-facing messages, keyed so the no-JS redirect can carry them. */
	public static function messages() {
		return array(
			'ok'       => 'We have received your request. One of our AI specialists will review your requirements and contact you within 24 business hours to schedule your free consultation.',
			'invalid'  => 'Please check the highlighted fields and try again.',
			'expired'  => 'Your session expired. Please refresh the page and try again.',
			'limited'  => 'You have sent several requests already. Please try again in an hour, or email sales@axioralabs.ai.',
			'failed'   => 'We could not save your request just now. Please try again, or email sales@axioralabs.ai.',
		);
	}

	public static function handle_submit() {
		$ajax = ! empty( $_POST['axc_ajax'] );

		// Honeypot: bots fill it, people never see it. Answer as if it worked.
		if ( ! empty( $_POST['axc_website'] ) ) {
			self::finish( 'ok', $ajax );
		}

		// Nonce only for logged-in users: a page cache can hand anonymous
		// visitors a stale nonce, and for them it proves nothing anyway. The
		// honeypot and the per-IP limit protect the anonymous path.
		if ( is_user_logged_in() ) {
			$nonce = isset( $_POST['axc_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['axc_nonce'] ) ) : '';
			if ( ! wp_verify_nonce( $nonce, 'axc_submit' ) ) {
				self::finish( 'expired', $ajax );
			}
		}

		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$key = 'axc_rl_' . md5( $ip );
		if ( (int) get_transient( $key ) >= self::RATE_LIMIT ) {
			self::finish( 'limited', $ajax );
		}

		$f = array(
			'full_name'   => self::field( 'name', 150 ),
			'email'       => sanitize_email( self::field( 'email', 190 ) ),
			'phone'       => self::field( 'phone', 32 ),
			'company'     => self::field( 'company', 190 ),
			'city'        => self::field( 'city', 120 ),
			'requirement' => isset( $_POST['requirement'] )
				? mb_substr( sanitize_textarea_field( wp_unslash( $_POST['requirement'] ) ), 0, 4000 )
				: '',
		);

		$errors = array();
		if ( '' === $f['full_name'] ) {
			$errors['name'] = 'Please enter your name.';
		}
		if ( '' === $f['email'] || ! is_email( $f['email'] ) ) {
			$errors['email'] = 'Please enter a valid work email.';
		}
		$digits = preg_replace( '/[^0-9]/', '', $f['phone'] );
		if ( strlen( $digits ) < 7 || strlen( $digits ) > 15 ) {
			$errors['phone'] = 'Please enter a valid phone or WhatsApp number.';
		}
		if ( '' === $f['company'] ) {
			$errors['company'] = 'Please enter your company name.';
		}
		if ( '' === $f['city'] ) {
			$errors['city'] = 'Please enter your city.';
		}
		if ( '' === trim( $f['requirement'] ) ) {
			$errors['requirement'] = 'Please tell us briefly what you want to automate.';
		}

		if ( $errors ) {
			self::finish( 'invalid', $ajax, $errors );
		}

		// "chennai " and "Chennai" should group together on the dashboard.
		$f['city'] = mb_convert_case( preg_replace( '/\s+/', ' ', $f['city'] ), MB_CASE_TITLE, 'UTF-8' );

		$f['source_url'] = wp_get_referer() ? esc_url_raw( wp_get_referer() ) : '';
		$f['ip']         = $ip;
		$f['user_agent'] = isset( $_SERVER['HTTP_USER_AGENT'] )
			? mb_substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 )
			: '';

		$id = Axiora_Consult_DB::insert( $f );
		if ( is_wp_error( $id ) ) {
			self::finish( 'failed', $ajax );
		}

		set_transient( $key, (int) get_transient( $key ) + 1, HOUR_IN_SECONDS );

		// The enquiry is already saved, so a failed email loses nothing.
		self::notify( $id );

		self::finish( 'ok', $ajax );
	}

	protected static function field( $name, $max ) {
		if ( ! isset( $_POST[ $name ] ) ) {
			return '';
		}
		return mb_substr( trim( sanitize_text_field( wp_unslash( $_POST[ $name ] ) ) ), 0, $max );
	}

	/** Email the sales inbox about a new enquiry, with a link into the dashboard. */
	protected static function notify( $id ) {
		$lead = Axiora_Consult_DB::get( $id );
		if ( ! $lead ) {
			return;
		}

		$to = apply_filters( 'axc_notify_email', AXC_NOTIFY_TO );

		$body = "New AI consultation request ({$lead->ref_code})\n\n"
			. 'Name:      ' . $lead->full_name . "\n"
			. 'Email:     ' . $lead->email . "\n"
			. 'Phone:     ' . $lead->phone . "\n"
			. 'Company:   ' . $lead->company . "\n"
			. 'City:      ' . $lead->city . "\n\n"
			. "What they want to automate:\n" . $lead->requirement . "\n\n"
			. 'Open in dashboard: ' . axc_portal_url( 'lead/' . (int) $lead->id ) . "\n";

		$headers = array( 'Reply-To: ' . $lead->full_name . ' <' . $lead->email . '>' );

		wp_mail( $to, 'New AI consultation request: ' . $lead->full_name . ' - ' . $lead->company, $body, $headers );
	}

	/**
	 * JSON for the fetch() submit; a redirect back to the page otherwise.
	 *
	 * @param string $code   Key into messages().
	 * @param bool   $ajax
	 * @param array  $errors field => message
	 */
	protected static function finish( $code, $ajax, $errors = array() ) {
		$messages = self::messages();
		$text     = isset( $messages[ $code ] ) ? $messages[ $code ] : $messages['failed'];

		if ( $ajax ) {
			wp_send_json(
				array(
					'ok'      => ( 'ok' === $code ),
					'message' => $text,
					'errors'  => (object) $errors,
				)
			);
		}

		wp_safe_redirect( add_query_arg( 'axc', $code, axc_landing_url() ) . '#consult' );
		exit;
	}
}
