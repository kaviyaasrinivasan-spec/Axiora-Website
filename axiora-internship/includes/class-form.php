<?php
/**
 * The public side: the /genai-internship and /apply pages, the
 * form markup and the submission handlers (validation, spam guards, private
 * resume upload).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Internship_Form {

	const TEMPLATE_KEY    = 'axiora-internship-page';
	const QA_TEMPLATE_KEY = 'axiora-qa-internship-page';
	const MAX_RESUME      = 5242880; // 5 MB
	const NONCE           = 'axi_int_submit';

	public static function init() {
		add_filter( 'theme_page_templates', array( __CLASS__, 'register_template' ) );
		add_filter( 'template_include', array( __CLASS__, 'maybe_use_template' ) );

		add_shortcode( 'axiora_internship_form', array( __CLASS__, 'shortcode' ) );
		add_shortcode( 'axiora_qa_internship_form', array( __CLASS__, 'qa_shortcode' ) );

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ) );

		add_action( 'wp_ajax_axi_int_submit', array( __CLASS__, 'ajax_submit' ) );
		add_action( 'wp_ajax_nopriv_axi_int_submit', array( __CLASS__, 'ajax_submit' ) );
		add_action( 'wp_ajax_axi_int_submit_qa', array( __CLASS__, 'ajax_submit_qa' ) );
		add_action( 'wp_ajax_nopriv_axi_int_submit_qa', array( __CLASS__, 'ajax_submit_qa' ) );
	}

	/* ---------------------------------------------------------------------
	 * Page template
	 * ------------------------------------------------------------------ */

	public static function register_template( $templates ) {
		$templates[ self::TEMPLATE_KEY ]    = __( 'Axiora — GenAI Internship', 'axiora-internship' );
		$templates[ self::QA_TEMPLATE_KEY ] = __( 'Axiora — Job Application', 'axiora-internship' );
		return $templates;
	}

	public static function maybe_use_template( $template ) {
		if ( ! is_page() ) {
			return $template;
		}
		$slug = get_page_template_slug( get_queried_object_id() );
		if ( self::TEMPLATE_KEY === $slug ) {
			return AXI_INT_DIR . 'templates/page-form.php';
		}
		if ( self::QA_TEMPLATE_KEY === $slug ) {
			return AXI_INT_DIR . 'templates/page-qa-form.php';
		}
		return $template;
	}

	/** True when the current request should load the form CSS/JS. */
	protected static function is_form_page() {
		if ( ! is_singular() ) {
			return false;
		}
		$slug = get_page_template_slug( get_queried_object_id() );
		if ( self::TEMPLATE_KEY === $slug || self::QA_TEMPLATE_KEY === $slug ) {
			return true;
		}
		$post = get_post();
		return $post && (
			has_shortcode( (string) $post->post_content, 'axiora_internship_form' )
			|| has_shortcode( (string) $post->post_content, 'axiora_qa_internship_form' )
		);
	}

	public static function assets() {
		if ( ! self::is_form_page() ) {
			return;
		}

		wp_enqueue_style( 'axi-int-form', AXI_INT_URL . 'assets/css/form.css', array(), AXI_INT_VERSION );
		wp_enqueue_script( 'axi-int-form', AXI_INT_URL . 'assets/js/form.js', array(), AXI_INT_VERSION, true );
		wp_localize_script(
			'axi-int-form',
			'AXI_INT',
			array(
				'ajax'      => admin_url( 'admin-ajax.php' ),
				'nonce'     => wp_create_nonce( self::NONCE ),
				'maxSize'   => self::MAX_RESUME,
				'maxSizeMB' => 5,
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Markup
	 * ------------------------------------------------------------------ */

	public static function shortcode( $atts = array() ) {
		ob_start();
		include AXI_INT_DIR . 'templates/form-fields.php';
		return ob_get_clean();
	}

	public static function qa_shortcode( $atts = array() ) {
		ob_start();
		include AXI_INT_DIR . 'templates/form-qa.php';
		return ob_get_clean();
	}

	/* ---------------------------------------------------------------------
	 * Submission
	 * ------------------------------------------------------------------ */

	/**
	 * Checks shared by every form: nonce, honeypot, time trap, per-IP rate
	 * limit. Ends the request with a JSON error when one fails.
	 *
	 * @return array{ip:string,key:string,hits:int}
	 */
	protected static function guard_request() {
		if ( ! check_ajax_referer( self::NONCE, 'nonce', false ) ) {
			wp_send_json_error(
				array( 'message' => __( 'Your session expired. Please refresh the page and try again.', 'axiora-internship' ) ),
				403
			);
		}

		// Honeypot — a real person never fills a hidden field.
		if ( ! empty( $_POST['axi_website'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Submission blocked.', 'axiora-internship' ) ), 400 );
		}

		// Time trap — the form cannot honestly be completed in under 3 seconds.
		$rendered = isset( $_POST['axi_t'] ) ? (int) $_POST['axi_t'] : 0;
		if ( $rendered && ( time() - $rendered ) < 3 ) {
			wp_send_json_error( array( 'message' => __( 'Submission blocked.', 'axiora-internship' ) ), 400 );
		}

		$ip  = self::client_ip();
		$key = 'axi_int_rl_' . md5( $ip );
		$hits = (int) get_transient( $key );
		if ( $hits >= 5 ) {
			wp_send_json_error(
				array( 'message' => __( 'Too many submissions from this device. Please try again later.', 'axiora-internship' ) ),
				429
			);
		}

		return array(
			'ip'   => $ip,
			'key'  => $key,
			'hits' => $hits,
		);
	}

	public static function ajax_submit() {
		$guard = self::guard_request();
		$ip    = $guard['ip'];
		$key   = $guard['key'];
		$hits  = $guard['hits'];

		$fields = self::validate( $_POST );
		if ( is_wp_error( $fields ) ) {
			wp_send_json_error(
				array(
					'message' => $fields->get_error_message(),
					'errors'  => $fields->get_error_data(),
				),
				422
			);
		}

		// One application per email per day.
		if ( self::has_recent_duplicate( $fields['email'] ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'We already have an application from this email address. Our team will be in touch.', 'axiora-internship' ),
					'errors'  => array( 'email' => __( 'Already applied', 'axiora-internship' ) ),
				),
				409
			);
		}

		$resume = self::handle_resume();
		if ( is_wp_error( $resume ) ) {
			wp_send_json_error(
				array(
					'message' => $resume->get_error_message(),
					'errors'  => array( 'resume' => $resume->get_error_message() ),
				),
				422
			);
		}

		$fields['resume_file'] = $resume['file'];
		$fields['resume_name'] = $resume['name'];
		$fields['resume_size'] = $resume['size'];
		$fields['source_url']  = esc_url_raw( wp_get_referer() ? wp_get_referer() : axi_int_application_url() );
		$fields['ip']          = $ip;
		$fields['user_agent']  = isset( $_SERVER['HTTP_USER_AGENT'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 )
			: '';

		$id = Axiora_Internship_DB::insert( $fields );

		if ( is_wp_error( $id ) ) {
			// Do not leave an orphan file behind.
			if ( $resume['file'] ) {
				@unlink( trailingslashit( axi_int_upload_dir() ) . $resume['file'] );
			}
			wp_send_json_error( array( 'message' => $id->get_error_message() ), 500 );
		}

		set_transient( $key, $hits + 1, HOUR_IN_SECONDS );

		$app = Axiora_Internship_DB::get( $id );
		Axiora_Internship_Mailer::notify_team( $app );

		if ( get_option( 'axi_int_send_confirmation', 1 ) ) {
			Axiora_Internship_Mailer::confirm_applicant( $app );
		}

		do_action( 'axiora_internship_submitted', $id, $app );

		wp_send_json_success(
			array(
				'message' => __( 'Application received.', 'axiora-internship' ),
				'ref'     => $app ? $app->ref_code : '',
				'name'    => $fields['full_name'],
			)
		);
	}

	/**
	 * General job application: name, phone, city, gender, resume. Lands in the
	 * same table as GenAI applications with programme = 'qa', so it shows up
	 * in the existing portal with no extra wiring.
	 */
	public static function ajax_submit_qa() {
		$guard = self::guard_request();

		$fields = self::validate_qa( $_POST );
		if ( is_wp_error( $fields ) ) {
			wp_send_json_error(
				array(
					'message' => $fields->get_error_message(),
					'errors'  => $fields->get_error_data(),
				),
				422
			);
		}

		// One QA application per phone number per day.
		if ( self::has_recent_qa_duplicate( $fields['phone'] ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'We already have an application from this phone number. Our team will be in touch.', 'axiora-internship' ),
					'errors'  => array( 'phone' => __( 'Already applied', 'axiora-internship' ) ),
				),
				409
			);
		}

		$resume = self::handle_resume();
		if ( is_wp_error( $resume ) ) {
			wp_send_json_error(
				array(
					'message' => $resume->get_error_message(),
					'errors'  => array( 'resume' => $resume->get_error_message() ),
				),
				422
			);
		}

		$fields['programme']   = 'qa';
		$fields['resume_file'] = $resume['file'];
		$fields['resume_name'] = $resume['name'];
		$fields['resume_size'] = $resume['size'];
		$fields['source_url']  = esc_url_raw( wp_get_referer() ? wp_get_referer() : axi_int_qa_application_url() );
		$fields['ip']          = $guard['ip'];
		$fields['user_agent']  = isset( $_SERVER['HTTP_USER_AGENT'] )
			? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 )
			: '';

		$id = Axiora_Internship_DB::insert( $fields );

		if ( is_wp_error( $id ) ) {
			@unlink( trailingslashit( axi_int_upload_dir() ) . $resume['file'] );
			wp_send_json_error( array( 'message' => $id->get_error_message() ), 500 );
		}

		set_transient( $guard['key'], $guard['hits'] + 1, HOUR_IN_SECONDS );

		$app = Axiora_Internship_DB::get( $id );
		Axiora_Internship_Mailer::notify_team( $app );

		do_action( 'axiora_internship_submitted', $id, $app );

		wp_send_json_success(
			array(
				'message' => __( 'Thank you for applying! Your application has been submitted successfully.', 'axiora-internship' ),
				'ref'     => $app ? $app->ref_code : '',
			)
		);
	}

	/**
	 * @return array|WP_Error Sanitised QA field values, or an error carrying a
	 *                        field => message map as its error data.
	 */
	protected static function validate_qa( $post ) {
		$errors = array();
		$out    = array();

		$out['full_name'] = sanitize_text_field( wp_unslash( isset( $post['full_name'] ) ? $post['full_name'] : '' ) );
		if ( mb_strlen( $out['full_name'] ) < 2 || ! preg_match( '/\p{L}/u', $out['full_name'] ) ) {
			$errors['full_name'] = __( 'Please enter your full name.', 'axiora-internship' );
		} elseif ( mb_strlen( $out['full_name'] ) > 150 ) {
			$errors['full_name'] = __( 'That name is too long.', 'axiora-internship' );
		}

		$out['phone'] = sanitize_text_field( wp_unslash( isset( $post['phone'] ) ? $post['phone'] : '' ) );
		$digits       = preg_replace( '/\D+/', '', $out['phone'] );
		if ( ! preg_match( '/^\+?[0-9\s\-().]+$/', $out['phone'] ) || strlen( $digits ) < 10 || strlen( $digits ) > 15 ) {
			$errors['phone'] = __( 'Please enter a valid phone number (10 to 15 digits).', 'axiora-internship' );
		}

		$out['city'] = sanitize_text_field( wp_unslash( isset( $post['city'] ) ? $post['city'] : '' ) );
		if ( mb_strlen( $out['city'] ) < 2 || ! preg_match( '/\p{L}/u', $out['city'] ) ) {
			$errors['city'] = __( 'Please enter your city.', 'axiora-internship' );
		} elseif ( mb_strlen( $out['city'] ) > 120 ) {
			$errors['city'] = __( 'That city name is too long.', 'axiora-internship' );
		}

		$out['gender'] = sanitize_text_field( wp_unslash( isset( $post['gender'] ) ? $post['gender'] : '' ) );
		if ( '' !== $out['gender'] && ! in_array( $out['gender'], axi_int_genders(), true ) ) {
			$errors['gender'] = __( 'Please select a valid option.', 'axiora-internship' );
		}

		if ( $errors ) {
			return new WP_Error(
				'validation',
				__( 'Please check the highlighted fields and try again.', 'axiora-internship' ),
				$errors
			);
		}

		return $out;
	}

	/** Same phone digits on a QA application in the last 24 hours. */
	protected static function has_recent_qa_duplicate( $phone ) {
		global $wpdb;

		$since  = gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - DAY_IN_SECONDS );
		$digits = preg_replace( '/\D+/', '', $phone );

		$recent = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT phone FROM ' . Axiora_Internship_DB::table() . " WHERE programme = 'qa' AND created_at >= %s",
				$since
			)
		);

		foreach ( (array) $recent as $one ) {
			if ( preg_replace( '/\D+/', '', $one ) === $digits ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array|WP_Error Sanitised field values, or an error carrying a
	 *                        field => message map as its error data.
	 */
	protected static function validate( $post ) {
		$errors = array();
		$out    = array();

		$out['full_name'] = sanitize_text_field( wp_unslash( isset( $post['full_name'] ) ? $post['full_name'] : '' ) );
		if ( mb_strlen( $out['full_name'] ) < 2 ) {
			$errors['full_name'] = __( 'Please enter your full name.', 'axiora-internship' );
		} elseif ( mb_strlen( $out['full_name'] ) > 150 ) {
			$errors['full_name'] = __( 'That name is too long.', 'axiora-internship' );
		}

		$out['email'] = sanitize_email( wp_unslash( isset( $post['email'] ) ? $post['email'] : '' ) );
		if ( ! is_email( $out['email'] ) ) {
			$errors['email'] = __( 'Please enter a valid email address.', 'axiora-internship' );
		}

		$out['phone'] = sanitize_text_field( wp_unslash( isset( $post['phone'] ) ? $post['phone'] : '' ) );
		$digits       = preg_replace( '/\D+/', '', $out['phone'] );
		if ( strlen( $digits ) < 7 || strlen( $digits ) > 15 ) {
			$errors['phone'] = __( 'Please enter a valid phone number.', 'axiora-internship' );
		}

		$out['college'] = sanitize_text_field( wp_unslash( isset( $post['college'] ) ? $post['college'] : '' ) );
		if ( mb_strlen( $out['college'] ) < 2 ) {
			$errors['college'] = __( 'Please enter your college or university.', 'axiora-internship' );
		}

		$out['course'] = sanitize_text_field( wp_unslash( isset( $post['course'] ) ? $post['course'] : '' ) );
		if ( ! in_array( $out['course'], axi_int_courses(), true ) ) {
			$errors['course'] = __( 'Please select your course.', 'axiora-internship' );
		}

		$out['grad_year'] = sanitize_text_field( wp_unslash( isset( $post['grad_year'] ) ? $post['grad_year'] : '' ) );
		if ( '' !== $out['grad_year'] && ! in_array( $out['grad_year'], axi_int_grad_years(), true ) ) {
			$errors['grad_year'] = __( 'Please select a valid year.', 'axiora-internship' );
		}

		$out['track'] = sanitize_text_field( wp_unslash( isset( $post['track'] ) ? $post['track'] : '' ) );
		if ( '' !== $out['track'] && ! in_array( $out['track'], axi_int_tracks(), true ) ) {
			$errors['track'] = __( 'Please select a valid track.', 'axiora-internship' );
		}

		$out['city']    = sanitize_text_field( wp_unslash( isset( $post['city'] ) ? $post['city'] : '' ) );
		$out['message'] = sanitize_textarea_field( wp_unslash( isset( $post['message'] ) ? $post['message'] : '' ) );
		if ( mb_strlen( $out['message'] ) > 2000 ) {
			$out['message'] = mb_substr( $out['message'], 0, 2000 );
		}

		if ( empty( $post['consent'] ) ) {
			$errors['consent'] = __( 'Please accept the privacy terms to continue.', 'axiora-internship' );
		}

		if ( $errors ) {
			return new WP_Error(
				'validation',
				__( 'Please check the highlighted fields and try again.', 'axiora-internship' ),
				$errors
			);
		}

		return $out;
	}

	protected static function has_recent_duplicate( $email ) {
		global $wpdb;

		$since = gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) ) - DAY_IN_SECONDS );

		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . Axiora_Internship_DB::table() . ' WHERE email = %s AND created_at >= %s LIMIT 1',
				$email,
				$since
			)
		);
	}

	/**
	 * Moves the uploaded resume into the private plugin directory.
	 *
	 * @return array{file:string,name:string,size:int}|WP_Error
	 */
	protected static function handle_resume() {
		if ( empty( $_FILES['resume'] ) || ! isset( $_FILES['resume']['error'] ) || UPLOAD_ERR_NO_FILE === $_FILES['resume']['error'] ) {
			return new WP_Error( 'resume_required', __( 'Please attach your resume (PDF or Word, up to 5 MB).', 'axiora-internship' ) );
		}

		$file = $_FILES['resume'];

		if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
			return new WP_Error( 'resume_upload', __( 'The file could not be uploaded. Please try again.', 'axiora-internship' ) );
		}
		if ( (int) $file['size'] > self::MAX_RESUME ) {
			return new WP_Error( 'resume_size', __( 'Your resume is larger than 5 MB. Please upload a smaller file.', 'axiora-internship' ) );
		}

		$allowed = array(
			'pdf'  => 'application/pdf',
			'doc'  => 'application/msword',
			'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		);

		$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], $allowed );
		if ( empty( $check['ext'] ) || empty( $check['type'] ) || ! isset( $allowed[ $check['ext'] ] ) ) {
			return new WP_Error( 'resume_type', __( 'Only PDF, DOC and DOCX files are accepted.', 'axiora-internship' ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';

		if ( ! axi_int_upload_dir() ) {
			return new WP_Error( 'resume_dir', __( 'The server could not store your file. Please contact us.', 'axiora-internship' ) );
		}

		add_filter( 'upload_dir', array( __CLASS__, 'private_upload_dir' ) );
		$moved = wp_handle_upload(
			$file,
			array(
				'test_form'                => false,
				'mimes'                    => $allowed,
				'unique_filename_callback' => array( __CLASS__, 'resume_filename' ),
			)
		);
		remove_filter( 'upload_dir', array( __CLASS__, 'private_upload_dir' ) );

		if ( isset( $moved['error'] ) ) {
			return new WP_Error( 'resume_move', $moved['error'] );
		}

		return array(
			'file' => basename( $moved['file'] ),
			'name' => sanitize_file_name( $file['name'] ),
			'size' => (int) $file['size'],
		);
	}

	/** Point wp_handle_upload at the private resume folder. */
	public static function private_upload_dir( $dirs ) {
		/*
		 * Use the paths WordPress already passed in. Calling wp_upload_dir()
		 * here would re-fire the `upload_dir` filter this callback is attached
		 * to — infinite recursion, stack exhaustion, HTTP 500. WordPress caches
		 * the computed paths but re-applies the filters on every call, so the
		 * cache does not break the loop.
		 */
		if ( empty( $dirs['basedir'] ) ) {
			return $dirs;
		}

		$dirs['path']   = trailingslashit( $dirs['basedir'] ) . 'axiora-internship';
		$dirs['url']    = trailingslashit( $dirs['baseurl'] ) . 'axiora-internship';
		$dirs['subdir'] = '/axiora-internship';

		return $dirs;
	}

	/**
	 * Unguessable filename: applicant name + random token. Even if the directory
	 * deny rules were ever lost, the URL cannot be guessed from the name.
	 */
	public static function resume_filename( $dir, $name, $ext ) {
		$base = sanitize_title( pathinfo( $name, PATHINFO_FILENAME ) );
		$base = $base ? substr( $base, 0, 40 ) : 'resume';
		return $base . '-' . wp_generate_password( 12, false, false ) . $ext;
	}

	protected static function client_ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		return substr( $ip, 0, 64 );
	}
}
