<?php
/**
 * Listens for the theme's 'wb_lead_captured' action (fired from wb_handle_lead()
 * in axioralabs_wp/inc-contact.php on every validated contact-form submission)
 * and stores it as a lead.
 *
 * This is the entire integration surface with the theme. The theme knows
 * nothing about this plugin — it fires a plain action with a plain array —
 * so deactivating this plugin can never break the live contact form, and a
 * future theme change that stops populating the payload fails safe rather
 * than filling the dashboard with junk (a blank full_name is simply skipped).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Leads_Capture {

	public static function init() {
		add_action( 'wb_lead_captured', array( __CLASS__, 'handle' ), 10, 1 );
	}

	/**
	 * @param array $data See the docblock on the do_action() call in inc-contact.php
	 *                    for the expected shape.
	 */
	public static function handle( $data ) {
		if ( ! is_array( $data ) ) {
			return;
		}

		// Never trust a payload crossing a theme/plugin boundary, even one this
		// same codebase also wrote — re-sanitize everything defensively.
		$full_name = isset( $data['full_name'] ) ? sanitize_text_field( $data['full_name'] ) : '';
		if ( '' === $full_name ) {
			return;
		}

		Axiora_Leads_DB::insert(
			array(
				'full_name'      => $full_name,
				'email'          => isset( $data['email'] ) ? sanitize_email( $data['email'] ) : '',
				'phone'          => isset( $data['phone'] ) ? sanitize_text_field( $data['phone'] ) : '',
				'company'        => isset( $data['company'] ) ? sanitize_text_field( $data['company'] ) : '',
				'employee_count' => isset( $data['employee_count'] ) ? sanitize_text_field( $data['employee_count'] ) : '',
				'timeline'       => isset( $data['timeline'] ) ? sanitize_text_field( $data['timeline'] ) : '',
				'process'        => isset( $data['process'] ) ? sanitize_text_field( $data['process'] ) : '',
				'notes'          => isset( $data['notes'] ) ? sanitize_textarea_field( $data['notes'] ) : '',
				'source_url'     => isset( $data['source_url'] ) ? esc_url_raw( $data['source_url'] ) : '',
				'ip'             => isset( $data['ip'] ) ? sanitize_text_field( $data['ip'] ) : '',
				'user_agent'     => isset( $data['user_agent'] ) ? sanitize_text_field( $data['user_agent'] ) : '',
			)
		);
	}
}
