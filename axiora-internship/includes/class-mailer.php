<?php
/**
 * Outgoing email: team alert on a new application, applicant acknowledgement,
 * and an optional status-update note the admin can choose to send.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Internship_Mailer {

	/** Where new-application alerts go. */
	public static function team_address() {
		$default = get_option( 'axi_int_notify_email' );
		if ( ! $default ) {
			$default = 'sales@axioralabs.ai';
		}
		return apply_filters( 'axiora_internship_notify_email', $default );
	}

	protected static function headers() {
		return array( 'Content-Type: text/html; charset=UTF-8' );
	}

	/** Shared branded HTML wrapper. */
	protected static function wrap( $heading, $body_html, $footnote = '', $subtitle = 'GenAI Internship Programme' ) {
		$logo_color = '#3c59e7';

		$html  = '<div style="margin:0;padding:24px;background:#f5f7fd;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">';
		$html .= '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e9f4;border-radius:14px;overflow:hidden;">';
		$html .= '<div style="background:linear-gradient(90deg,#0b1440,#131f4e);padding:20px 26px;">';
		$html .= '<div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">AXIORA <span style="color:#8ea2e8;">LABS</span></div>';
		$html .= '<div style="color:#c7d2f5;font-size:12px;margin-top:2px;">' . esc_html( $subtitle ) . '</div>';
		$html .= '</div>';
		$html .= '<div style="padding:26px;">';
		$html .= '<h2 style="margin:0 0 14px;font-size:19px;color:#0f1730;">' . esc_html( $heading ) . '</h2>';
		$html .= $body_html;
		$html .= '</div>';

		if ( $footnote ) {
			$html .= '<div style="padding:14px 26px;background:#f5f7fd;border-top:1px solid #e6e9f4;color:#6b7490;font-size:12px;line-height:1.6;">'
				. $footnote . '</div>';
		}

		$html .= '</div>';
		$html .= '<div style="max-width:600px;margin:14px auto 0;text-align:center;color:#8a91a8;font-size:11px;">'
			. 'Axiora Labs AI (OPC) Private Limited · Chennai, India</div>';
		$html .= '</div>';

		unset( $logo_color );
		return $html;
	}

	/** Definition-list row used in both emails. */
	protected static function row( $label, $value ) {
		if ( '' === trim( (string) $value ) ) {
			return '';
		}
		return '<tr>'
			. '<td style="padding:7px 0;color:#6b7490;font-size:13px;width:170px;vertical-align:top;">' . esc_html( $label ) . '</td>'
			. '<td style="padding:7px 0;color:#0f1730;font-size:13px;font-weight:600;">' . esc_html( $value ) . '</td>'
			. '</tr>';
	}

	/**
	 * Alert the team that a new application landed.
	 */
	public static function notify_team( $app ) {
		if ( ! $app ) {
			return false;
		}

		$programme = isset( $app->programme ) ? $app->programme : 'genai';
		$is_genai  = ( 'genai' === $programme );
		$label     = axi_int_programme_label( $programme );

		$body  = '<p style="margin:0 0 16px;color:#475069;font-size:14px;line-height:1.65;">'
			. ( $is_genai
				? 'A new GenAI internship application was submitted on the website.'
				: 'A new job application was submitted on the website.' ) . '</p>';
		$body .= '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">';
		$body .= self::row( 'Reference', $app->ref_code );
		$body .= self::row( 'Programme', $label );
		$body .= self::row( 'Name', $app->full_name );
		$body .= self::row( 'Gender', isset( $app->gender ) ? $app->gender : '' );
		$body .= self::row( 'Email', $app->email );
		$body .= self::row( 'Phone', $app->phone );
		$body .= self::row( 'College / University', $app->college );
		$body .= self::row( 'Course', $app->course );
		$body .= self::row( 'Graduation year', $app->grad_year );
		$body .= self::row( 'Preferred track', $app->track );
		$body .= self::row( 'City', $app->city );
		$body .= self::row( 'Submitted', axi_int_date( $app->created_at ) );
		$body .= '</table>';

		if ( trim( (string) $app->message ) ) {
			$body .= '<div style="margin-top:16px;padding:14px 16px;background:#f5f7fd;border-left:3px solid #3c59e7;border-radius:6px;'
				. 'color:#475069;font-size:13px;line-height:1.65;white-space:pre-wrap;">'
				. esc_html( $app->message ) . '</div>';
		}

		$body .= '<p style="margin:22px 0 0;">'
			. '<a href="' . esc_url( axi_int_portal_url( 'application/' . (int) $app->id ) ) . '" '
			. 'style="display:inline-block;background:#3c59e7;color:#ffffff;text-decoration:none;font-weight:600;'
			. 'font-size:14px;padding:12px 22px;border-radius:10px;">Open in the admin portal</a></p>';

		$subject = $is_genai
			? sprintf( '[%s] New internship application — %s', $app->ref_code, $app->full_name )
			: sprintf( '[%s] New job application — %s', $app->ref_code, $app->full_name );

		return wp_mail(
			self::team_address(),
			$subject,
			self::wrap(
				$is_genai ? 'New internship application' : 'New job application',
				$body,
				'The resume is attached to the record and can be downloaded from the admin portal.',
				$is_genai ? 'GenAI Internship Programme' : 'Careers'
			),
			self::headers()
		);
	}

	/**
	 * Acknowledge the applicant.
	 */
	public static function confirm_applicant( $app ) {
		if ( ! $app || ! is_email( $app->email ) ) {
			return false;
		}

		$first = explode( ' ', trim( $app->full_name ) );
		$first = $first ? $first[0] : 'there';

		$body  = '<p style="margin:0 0 14px;color:#475069;font-size:14px;line-height:1.7;">Hi ' . esc_html( $first ) . ',</p>';
		$body .= '<p style="margin:0 0 14px;color:#475069;font-size:14px;line-height:1.7;">'
			. 'Thanks for applying to the Axiora Labs GenAI Internship. We have received your application and our team will '
			. 'review it shortly. If your profile matches, we will reach out on the phone number or email you shared.</p>';
		$body .= '<div style="margin:18px 0;padding:14px 16px;background:#eef2fe;border-radius:10px;">'
			. '<div style="color:#6b7490;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Your reference number</div>'
			. '<div style="color:#0f1730;font-size:20px;font-weight:700;margin-top:4px;letter-spacing:-0.01em;">'
			. esc_html( $app->ref_code ) . '</div></div>';
		$body .= '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">';
		$body .= self::row( 'Course', $app->course );
		$body .= self::row( 'College / University', $app->college );
		$body .= self::row( 'Preferred track', $app->track );
		$body .= self::row( 'Resume', $app->resume_name );
		$body .= '</table>';
		$body .= '<p style="margin:18px 0 0;color:#475069;font-size:14px;line-height:1.7;">'
			. 'Please keep this reference number handy for any follow-up.</p>';

		return wp_mail(
			$app->email,
			'We received your Axiora Labs internship application (' . $app->ref_code . ')',
			self::wrap( 'Application received', $body, 'This is an automated confirmation — no reply is needed.' ),
			self::headers()
		);
	}

	/**
	 * Optional note to the applicant when the admin moves their status.
	 */
	public static function status_update( $app, $note = '' ) {
		if ( ! $app || ! is_email( $app->email ) ) {
			return false;
		}

		$first = explode( ' ', trim( $app->full_name ) );
		$first = $first ? $first[0] : 'there';

		$body  = '<p style="margin:0 0 14px;color:#475069;font-size:14px;line-height:1.7;">Hi ' . esc_html( $first ) . ',</p>';
		$body .= '<p style="margin:0 0 16px;color:#475069;font-size:14px;line-height:1.7;">'
			. 'There is an update on your Axiora Labs GenAI Internship application '
			. '<strong>' . esc_html( $app->ref_code ) . '</strong>.</p>';
		$body .= '<div style="margin:0 0 16px;padding:14px 16px;background:' . esc_attr( axi_int_status_tint( $app->status ) ) . ';'
			. 'border-left:3px solid ' . esc_attr( axi_int_status_color( $app->status ) ) . ';border-radius:8px;">'
			. '<div style="color:#6b7490;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Current status</div>'
			. '<div style="color:#0f1730;font-size:17px;font-weight:700;margin-top:3px;">'
			. esc_html( axi_int_status_label( $app->status ) ) . '</div></div>';

		if ( trim( (string) $note ) ) {
			$body .= '<p style="margin:0 0 8px;color:#475069;font-size:14px;line-height:1.7;white-space:pre-wrap;">'
				. esc_html( $note ) . '</p>';
		}

		return wp_mail(
			$app->email,
			'Update on your Axiora Labs internship application (' . $app->ref_code . ')',
			self::wrap( 'Application update', $body ),
			self::headers()
		);
	}
}
