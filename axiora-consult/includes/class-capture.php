<?php
/**
 * Stores enquiries from the theme's Contact page form (/contact/) in the same
 * dashboard as the landing page, tagged source = 'contact'.
 *
 * The theme's wb_handle_lead() (axioralabs_wp/inc-contact.php) fires
 * 'wb_lead_captured' with a plain array once a submission has passed its own
 * validation, honeypot and throttle. That action is the only coupling: the
 * theme knows nothing about this plugin, so deactivating it never affects the
 * contact form, and the theme still sends its own email alert — this class
 * sends none.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Consult_Capture {

	public static function init() {
		add_action( 'wb_lead_captured', array( __CLASS__, 'handle' ), 10, 1 );
	}

	/**
	 * @param array $data See the do_action() call in inc-contact.php.
	 */
	public static function handle( $data ) {
		if ( ! is_array( $data ) ) {
			return;
		}

		// Re-sanitise: never trust a payload crossing a theme/plugin boundary.
		$name = isset( $data['full_name'] ) ? sanitize_text_field( $data['full_name'] ) : '';
		if ( '' === $name ) {
			return;
		}

		$phone = isset( $data['phone'] ) ? preg_replace( '/[^0-9]/', '', (string) $data['phone'] ) : '';

		Axiora_Consult_DB::insert(
			array(
				'source'         => 'contact',
				'full_name'      => mb_substr( $name, 0, 150 ),
				'email'          => isset( $data['email'] ) ? sanitize_email( $data['email'] ) : '',
				// The contact form only accepts 10-digit Indian mobiles.
				'phone'          => $phone ? '+91 ' . $phone : '',
				'company'        => isset( $data['company'] ) ? mb_substr( sanitize_text_field( $data['company'] ), 0, 190 ) : '',
				'employee_count' => isset( $data['employee_count'] ) ? mb_substr( sanitize_text_field( $data['employee_count'] ), 0, 40 ) : '',
				'timeline'       => isset( $data['timeline'] ) ? mb_substr( sanitize_text_field( $data['timeline'] ), 0, 40 ) : '',
				'process'        => isset( $data['process'] ) ? mb_substr( sanitize_text_field( $data['process'] ), 0, 80 ) : '',
				'requirement'    => isset( $data['notes'] ) ? mb_substr( sanitize_textarea_field( $data['notes'] ), 0, 4000 ) : '',
				'source_url'     => isset( $data['source_url'] ) ? esc_url_raw( $data['source_url'] ) : '',
				'ip'             => isset( $data['ip'] ) ? sanitize_text_field( $data['ip'] ) : '',
				'user_agent'     => isset( $data['user_agent'] ) ? mb_substr( sanitize_text_field( $data['user_agent'] ), 0, 255 ) : '',
			)
		);
	}
}
