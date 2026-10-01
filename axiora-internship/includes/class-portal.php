<?php
/**
 * The admin portal at /internship-admin/ — its own branded login, dashboard,
 * application list and detail view, entirely separate from wp-admin.
 *
 * Authentication is WordPress's own (hashing, sessions, cookies); what is
 * "separate" is the login screen and the workspace. Access is gated on the
 * AXI_INT_CAP capability, which the "Internship Admin" role carries.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Internship_Portal {

	/** Populated during render so templates can read them. */
	public static $route  = 'dashboard';
	public static $notice = array();

	public static function init() {
		// Priority 1 so the portal renders before WordPress's canonical redirect
		// or 404 handling get a chance to act on these non-post URLs.
		add_action( 'template_redirect', array( __CLASS__, 'maybe_render' ), 1 );
		add_filter( 'redirect_canonical', array( __CLASS__, 'block_canonical' ), 10, 1 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ), 100 );
		add_action( 'admin_post_axi_int_resume', array( __CLASS__, 'download_resume' ) );
		add_action( 'admin_post_axi_int_export', array( __CLASS__, 'export_csv' ) );
	}

	/**
	 * The portal is a standalone workspace, not a themed page — drop the theme's
	 * marketing CSS/JS and load only the portal stylesheet.
	 */
	public static function assets() {
		if ( ! self::is_portal_request() ) {
			return;
		}

		wp_dequeue_style( 'wb-base' );
		wp_dequeue_style( 'wb-page' );
		wp_dequeue_style( 'wb-audit' );
		wp_dequeue_script( 'wb-main' );

		wp_enqueue_style( 'axi-int-portal', AXI_INT_URL . 'assets/css/portal.css', array(), AXI_INT_VERSION );
		wp_enqueue_script( 'axi-int-portal', AXI_INT_URL . 'assets/js/portal.js', array(), AXI_INT_VERSION, true );
	}

	public static function is_portal_request() {
		return (bool) get_query_var( 'axiora_portal' );
	}

	/** Portal URLs are not posts — never let canonical redirection rewrite them. */
	public static function block_canonical( $redirect_url ) {
		return self::is_portal_request() ? false : $redirect_url;
	}

	public static function can_manage() {
		return is_user_logged_in() && current_user_can( AXI_INT_CAP );
	}

	/* ---------------------------------------------------------------------
	 * Routing
	 * ------------------------------------------------------------------ */

	public static function maybe_render() {
		if ( ! self::is_portal_request() ) {
			return;
		}

		nocache_headers();
		status_header( 200 );

		// The portal renders its own document: no WordPress admin bar over the
		// layout, and no second <title> from the theme's title-tag support.
		add_filter( 'show_admin_bar', '__return_false' );
		remove_action( 'wp_head', '_wp_render_title_tag', 1 );

		$route       = get_query_var( 'axiora_route' );
		self::$route = $route ? sanitize_key( $route ) : 'dashboard';

		if ( 'logout' === self::$route ) {
			self::handle_logout();
			return;
		}

		if ( ! self::can_manage() ) {
			self::render_login();
			return;
		}

		self::handle_actions();

		switch ( self::$route ) {
			case 'application':
				self::render_detail();
				break;
			case 'applications':
				self::render_list();
				break;
			case 'login':
				wp_safe_redirect( axi_int_portal_url() );
				exit;
			default:
				self::render_dashboard();
		}
	}

	/* ---------------------------------------------------------------------
	 * Authentication
	 * ------------------------------------------------------------------ */

	protected static function render_login() {
		$error    = '';
		$username = '';

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';

		if ( 'POST' === $method && isset( $_POST['axi_login'] ) ) {
			if ( ! isset( $_POST['_axi_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_axi_nonce'] ) ), 'axi_int_login' ) ) {
				$error = __( 'Your session expired. Please try again.', 'axiora-internship' );
			} else {
				$username = sanitize_user( wp_unslash( isset( $_POST['log'] ) ? $_POST['log'] : '' ) );

				$user = wp_signon(
					array(
						'user_login'    => $username,
						'user_password' => isset( $_POST['pwd'] ) ? (string) wp_unslash( $_POST['pwd'] ) : '',
						'remember'      => ! empty( $_POST['rememberme'] ),
					),
					is_ssl()
				);

				if ( is_wp_error( $user ) ) {
					$error = __( 'Incorrect username or password.', 'axiora-internship' );
				} elseif ( ! user_can( $user, AXI_INT_CAP ) ) {
					wp_logout();
					$error = __( 'That account does not have access to the internship portal.', 'axiora-internship' );
				} else {
					wp_set_current_user( $user->ID );
					wp_safe_redirect( axi_int_portal_url() );
					exit;
				}
			}
		}

		// Signed in, but without the capability.
		if ( ! $error && is_user_logged_in() ) {
			$error = __( 'You are signed in as a user without internship portal access.', 'axiora-internship' );
		}

		include AXI_INT_DIR . 'templates/portal-login.php';
		exit;
	}

	protected static function handle_logout() {
		check_admin_referer( 'axi_int_logout' );
		wp_logout();
		wp_safe_redirect( axi_int_portal_url() );
		exit;
	}

	/* ---------------------------------------------------------------------
	 * Write actions (POST → redirect → GET)
	 * ------------------------------------------------------------------ */

	protected static function handle_actions() {
		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';

		if ( 'POST' !== $method || empty( $_POST['axi_action'] ) ) {
			self::read_notice();
			return;
		}

		$action = sanitize_key( wp_unslash( $_POST['axi_action'] ) );
		$id     = isset( $_POST['app_id'] ) ? (int) $_POST['app_id'] : 0;

		check_admin_referer( 'axi_int_action_' . $action );

		if ( ! current_user_can( AXI_INT_CAP ) ) {
			wp_die( esc_html__( 'You are not allowed to do that.', 'axiora-internship' ), 403 );
		}

		$user_id = get_current_user_id();

		// Single-record actions return to that record; list actions return to the
		// list the admin was looking at, filters and page intact.
		if ( $id && in_array( $action, array( 'set_status', 'save_notes' ), true ) ) {
			$back = axi_int_portal_url( 'application/' . $id );
		} else {
			$back = wp_get_referer() ? wp_get_referer() : axi_int_portal_url();
		}

		switch ( $action ) {

			case 'set_status':
				$status = sanitize_key( wp_unslash( isset( $_POST['status'] ) ? $_POST['status'] : '' ) );
				$note   = sanitize_textarea_field( wp_unslash( isset( $_POST['note'] ) ? $_POST['note'] : '' ) );

				$result = Axiora_Internship_DB::update_status( $id, $status, $note, $user_id );
				if ( is_wp_error( $result ) ) {
					$back = add_query_arg( 'axi_msg', 'error', $back );
					break;
				}

				if ( ! empty( $_POST['notify_applicant'] ) ) {
					$app = Axiora_Internship_DB::get( $id );
					Axiora_Internship_Mailer::status_update( $app, $note );
					$back = add_query_arg( 'axi_msg', 'status-mailed', $back );
				} else {
					$back = add_query_arg( 'axi_msg', 'status-updated', $back );
				}
				break;

			case 'save_notes':
				$notes = sanitize_textarea_field( wp_unslash( isset( $_POST['admin_notes'] ) ? $_POST['admin_notes'] : '' ) );
				Axiora_Internship_DB::update_notes( $id, $notes, $user_id );
				$back = add_query_arg( 'axi_msg', 'notes-saved', $back );
				break;

			case 'bulk_status':
				$ids    = isset( $_POST['ids'] ) ? array_map( 'intval', (array) $_POST['ids'] ) : array();
				$status = sanitize_key( wp_unslash( isset( $_POST['status'] ) ? $_POST['status'] : '' ) );
				$done   = 0;
				foreach ( $ids as $one ) {
					if ( ! is_wp_error( Axiora_Internship_DB::update_status( $one, $status, '', $user_id ) ) ) {
						$done++;
					}
				}
				$back = add_query_arg(
					array(
						'axi_msg'   => 'bulk-updated',
						'axi_count' => $done,
					),
					$back
				);
				break;

			case 'delete_app':
				Axiora_Internship_DB::delete( $id );
				$back = add_query_arg( 'axi_msg', 'deleted', axi_int_portal_url( 'applications' ) );
				break;
		}

		wp_safe_redirect( $back );
		exit;
	}

	/** Turn ?axi_msg=… into a renderable notice. */
	protected static function read_notice() {
		if ( empty( $_GET['axi_msg'] ) ) {
			return;
		}

		$key   = sanitize_key( wp_unslash( $_GET['axi_msg'] ) );
		$count = isset( $_GET['axi_count'] ) ? (int) $_GET['axi_count'] : 0;

		$map = array(
			'status-updated' => array( 'ok', __( 'Status updated.', 'axiora-internship' ) ),
			'status-mailed'  => array( 'ok', __( 'Status updated and the applicant was emailed.', 'axiora-internship' ) ),
			'notes-saved'    => array( 'ok', __( 'Notes saved.', 'axiora-internship' ) ),
			'bulk-updated'   => array( 'ok', sprintf( _n( '%d application updated.', '%d applications updated.', $count, 'axiora-internship' ), $count ) ),
			'deleted'        => array( 'ok', __( 'Application deleted.', 'axiora-internship' ) ),
			'error'          => array( 'bad', __( 'That change could not be saved.', 'axiora-internship' ) ),
		);

		if ( isset( $map[ $key ] ) ) {
			self::$notice = array(
				'type' => $map[ $key ][0],
				'text' => $map[ $key ][1],
			);
		}
	}

	/* ---------------------------------------------------------------------
	 * Views
	 * ------------------------------------------------------------------ */

	protected static function render_dashboard() {
		$counts   = Axiora_Internship_DB::counts_by_status();
		$total    = Axiora_Internship_DB::total();
		$trend    = Axiora_Internship_DB::trend( 14 );
		$today    = Axiora_Internship_DB::count_since_days( 0 );
		$week     = Axiora_Internship_DB::count_since_days( 6 );
		$prev     = max( 0, Axiora_Internship_DB::count_since_days( 13 ) - $week );
		$colleges = Axiora_Internship_DB::top_colleges( 5 );
		$recent   = Axiora_Internship_DB::query( array( 'per_page' => 8 ) );

		include AXI_INT_DIR . 'templates/portal-dashboard.php';
		exit;
	}

	protected static function render_list() {
		$args = self::list_args_from_request();
		$data = Axiora_Internship_DB::query( $args );

		include AXI_INT_DIR . 'templates/portal-list.php';
		exit;
	}

	protected static function render_detail() {
		$id  = (int) get_query_var( 'axiora_app' );
		$app = Axiora_Internship_DB::get( $id );

		if ( ! $app ) {
			$app = null;
		}

		$history = $app ? Axiora_Internship_DB::get_log( $app->id ) : array();

		include AXI_INT_DIR . 'templates/portal-detail.php';
		exit;
	}

	/** Read list filters off the query string. */
	public static function list_args_from_request() {
		return array(
			'search'   => isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : '',
			'status'   => isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : '',
			'course'   => isset( $_GET['course'] ) ? sanitize_text_field( wp_unslash( $_GET['course'] ) ) : '',
			'from'     => isset( $_GET['from'] ) ? sanitize_text_field( wp_unslash( $_GET['from'] ) ) : '',
			'to'       => isset( $_GET['to'] ) ? sanitize_text_field( wp_unslash( $_GET['to'] ) ) : '',
			'orderby'  => isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( $_GET['orderby'] ) ) : 'created_at',
			'order'    => isset( $_GET['order'] ) ? sanitize_key( wp_unslash( $_GET['order'] ) ) : 'desc',
			'per_page' => 20,
			'page'     => isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1,
		);
	}

	/* ---------------------------------------------------------------------
	 * Resume download & CSV export
	 * ------------------------------------------------------------------ */

	public static function download_resume() {
		if ( ! self::can_manage() ) {
			wp_die( esc_html__( 'You are not allowed to view this file.', 'axiora-internship' ), 403 );
		}

		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'axi_int_resume_' . $id );

		$app = Axiora_Internship_DB::get( $id );
		if ( ! $app || ! $app->resume_file ) {
			wp_die( esc_html__( 'No resume on file for this application.', 'axiora-internship' ), 404 );
		}

		$dir  = axi_int_upload_dir();
		$path = trailingslashit( $dir ) . basename( $app->resume_file );

		// Never let a stored value escape the resume directory.
		$real_dir  = realpath( $dir );
		$real_path = realpath( $path );
		if ( ! $real_dir || ! $real_path || 0 !== strpos( $real_path, $real_dir ) || ! is_file( $real_path ) ) {
			wp_die( esc_html__( 'The file could not be found on the server.', 'axiora-internship' ), 404 );
		}

		$download_name = sanitize_file_name(
			$app->ref_code . '-' . sanitize_title( $app->full_name ) . '.' . pathinfo( $real_path, PATHINFO_EXTENSION )
		);

		$type = wp_check_filetype( $real_path );
		$mime = $type['type'] ? $type['type'] : 'application/octet-stream';

		nocache_headers();
		header( 'Content-Type: ' . $mime );
		header( 'Content-Disposition: attachment; filename="' . $download_name . '"' );
		header( 'Content-Length: ' . filesize( $real_path ) );
		header( 'X-Content-Type-Options: nosniff' );

		readfile( $real_path );
		exit;
	}

	public static function export_csv() {
		if ( ! self::can_manage() ) {
			wp_die( esc_html__( 'You are not allowed to export this data.', 'axiora-internship' ), 403 );
		}
		check_admin_referer( 'axi_int_export' );

		$args = self::list_args_from_request();
		$rows = Axiora_Internship_DB::query_all( $args );

		$filename = 'axiora-internship-applications-' . current_time( 'Y-m-d' ) . '.csv';

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );

		$out = fopen( 'php://output', 'w' );

		// BOM so Excel opens UTF-8 names correctly.
		fwrite( $out, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );

		fputcsv(
			$out,
			array(
				'Reference', 'Submitted', 'Status', 'Full name', 'Email', 'Phone',
				'College / University', 'Course', 'Graduation year', 'Preferred track',
				'City', 'Message', 'Resume file', 'Last updated', 'Internal notes',
			)
		);

		foreach ( $rows as $row ) {
			fputcsv(
				$out,
				array(
					$row->ref_code,
					$row->created_at,
					axi_int_status_label( $row->status ),
					$row->full_name,
					$row->email,
					// Leading apostrophe keeps "+91…" from being eaten as a formula.
					"'" . $row->phone,
					$row->college,
					$row->course,
					$row->grad_year,
					$row->track,
					$row->city,
					$row->message,
					$row->resume_name,
					$row->updated_at,
					$row->admin_notes,
				)
			);
		}

		fclose( $out );
		exit;
	}

	/* ---------------------------------------------------------------------
	 * Small helpers for the templates
	 * ------------------------------------------------------------------ */

	public static function resume_url( $app ) {
		return wp_nonce_url(
			admin_url( 'admin-post.php?action=axi_int_resume&id=' . (int) $app->id ),
			'axi_int_resume_' . (int) $app->id
		);
	}

	/**
	 * Export link that carries the list's current filters, so "Export CSV"
	 * exports exactly what the admin is looking at.
	 *
	 * @param array $args The list args (as returned by list_args_from_request()).
	 */
	public static function export_url( $args = array() ) {
		$query = array( 'action' => 'axi_int_export' );

		$map = array(
			'search'  => 's',
			'status'  => 'status',
			'course'  => 'course',
			'from'    => 'from',
			'to'      => 'to',
			'orderby' => 'orderby',
			'order'   => 'order',
		);

		foreach ( $map as $arg_key => $query_key ) {
			if ( isset( $args[ $arg_key ] ) && '' !== (string) $args[ $arg_key ] ) {
				$query[ $query_key ] = (string) $args[ $arg_key ];
			}
		}

		return wp_nonce_url( add_query_arg( $query, admin_url( 'admin-post.php' ) ), 'axi_int_export' );
	}

	public static function logout_url() {
		return wp_nonce_url( axi_int_portal_url( 'logout' ), 'axi_int_logout' );
	}
}
