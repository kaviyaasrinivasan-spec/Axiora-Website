<?php
/**
 * A small settings screen in wp-admin: where alerts are sent, and the links an
 * administrator needs (public page, portal, how to create a portal login).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Internship_Settings {

	const PAGE  = 'axiora-internship';
	const GROUP = 'axi_int_settings';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( AXI_INT_FILE ), array( __CLASS__, 'action_links' ) );
	}

	public static function menu() {
		add_menu_page(
			__( 'Internship Applications', 'axiora-internship' ),
			__( 'Internship', 'axiora-internship' ),
			AXI_INT_CAP,
			self::PAGE,
			array( __CLASS__, 'render' ),
			'dashicons-groups',
			26
		);
	}

	public static function register() {
		register_setting(
			self::GROUP,
			'axi_int_notify_email',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( __CLASS__, 'sanitize_emails' ),
				'default'           => get_option( 'admin_email' ),
			)
		);
		register_setting(
			self::GROUP,
			'axi_int_send_confirmation',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => static function ( $value ) {
					return $value ? 1 : 0;
				},
				'default'           => 1,
			)
		);
	}

	/** Accepts one address or a comma-separated list. */
	public static function sanitize_emails( $value ) {
		$parts = array_filter( array_map( 'trim', explode( ',', (string) $value ) ) );
		$clean = array();

		foreach ( $parts as $part ) {
			$email = sanitize_email( $part );
			if ( is_email( $email ) ) {
				$clean[] = $email;
			}
		}

		if ( ! $clean ) {
			add_settings_error( 'axi_int_notify_email', 'invalid', __( 'Please enter at least one valid email address.', 'axiora-internship' ) );
			return get_option( 'axi_int_notify_email' );
		}

		return implode( ',', $clean );
	}

	public static function action_links( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::PAGE ) ) . '">' . esc_html__( 'Settings', 'axiora-internship' ) . '</a>',
			'<a href="' . esc_url( axi_int_portal_url() ) . '">' . esc_html__( 'Open portal', 'axiora-internship' ) . '</a>'
		);
		return $links;
	}

	public static function render() {
		if ( ! current_user_can( AXI_INT_CAP ) ) {
			return;
		}

		$total  = Axiora_Internship_DB::total();
		$counts = Axiora_Internship_DB::counts_by_status();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Axiora Labs — GenAI Internship', 'axiora-internship' ); ?></h1>

			<div class="notice notice-info inline" style="margin:16px 0;padding:12px 14px;">
				<p style="margin:0 0 6px;"><strong><?php esc_html_e( 'Applications so far:', 'axiora-internship' ); ?></strong>
					<?php echo esc_html( number_format_i18n( $total ) ); ?>
					(<?php echo esc_html( number_format_i18n( isset( $counts['new'] ) ? $counts['new'] : 0 ) ); ?> <?php esc_html_e( 'new', 'axiora-internship' ); ?>)</p>
				<p style="margin:0;">
					<a class="button button-primary" href="<?php echo esc_url( axi_int_portal_url() ); ?>"><?php esc_html_e( 'Open the admin portal', 'axiora-internship' ); ?></a>
					<a class="button" href="<?php echo esc_url( axi_int_application_url() ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'View the public form', 'axiora-internship' ); ?></a>
				</p>
			</div>

			<form method="post" action="options.php">
				<?php settings_fields( self::GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="axi_int_notify_email"><?php esc_html_e( 'Send new applications to', 'axiora-internship' ); ?></label></th>
						<td>
							<input type="text" class="regular-text" id="axi_int_notify_email" name="axi_int_notify_email"
								value="<?php echo esc_attr( Axiora_Internship_Mailer::team_address() ); ?>">
							<p class="description"><?php esc_html_e( 'One address, or several separated by commas.', 'axiora-internship' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Applicant confirmation', 'axiora-internship' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="axi_int_send_confirmation" value="1"
									<?php checked( (int) get_option( 'axi_int_send_confirmation', 1 ), 1 ); ?>>
								<?php esc_html_e( 'Email applicants a confirmation with their reference number', 'axiora-internship' ); ?>
							</label>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>

			<hr>

			<h2><?php esc_html_e( 'Giving someone portal access', 'axiora-internship' ); ?></h2>
			<p>
				<?php
				printf(
					/* translators: 1: opening link tag, 2: closing link tag. */
					esc_html__( 'Create the person a user under %1$sUsers → Add New%2$s and set their role to %3$s. They then sign in at the portal address below — they never need the WordPress dashboard.', 'axiora-internship' ),
					'<a href="' . esc_url( admin_url( 'user-new.php' ) ) . '">',
					'</a>',
					'<strong>' . esc_html__( 'Internship Admin', 'axiora-internship' ) . '</strong>'
				);
				?>
			</p>
			<p><code><?php echo esc_html( axi_int_portal_url() ); ?></code></p>
			<p class="description">
				<?php esc_html_e( 'Administrators already have access. Resumes are stored outside the media library and can only be downloaded by signed-in portal users.', 'axiora-internship' ); ?>
			</p>
		</div>
		<?php
	}
}
