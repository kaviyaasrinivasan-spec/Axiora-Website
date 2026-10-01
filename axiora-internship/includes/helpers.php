<?php
/**
 * Shared vocabulary: statuses, courses, paths, small formatters.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The application pipeline.
 *
 * Colours are deliberate, not decorative. The four in-flight stages use a single
 * blue ramp light -> dark so "further along" reads as "darker" at a glance; the
 * three terminal states use the reserved status hues (good / warning / critical).
 * Every place a colour appears it is paired with the status label, so the state
 * is never carried by colour alone.
 *
 * Filter `axiora_internship_statuses` to add or rename stages.
 *
 * @return array<string,array{label:string,color:string,tint:string,terminal:bool}>
 */
function axi_int_statuses() {
	$statuses = array(
		'new'         => array( 'label' => 'New',                'color' => '#86b6ef', 'tint' => '#eef4fd', 'terminal' => false ),
		'in_review'   => array( 'label' => 'In Review',          'color' => '#5598e7', 'tint' => '#e9f1fc', 'terminal' => false ),
		'shortlisted' => array( 'label' => 'Shortlisted',        'color' => '#2a78d6', 'tint' => '#e6eefa', 'terminal' => false ),
		'interview'   => array( 'label' => 'Interview Scheduled','color' => '#1c5cab', 'tint' => '#e4ebf6', 'terminal' => false ),
		'selected'    => array( 'label' => 'Selected',           'color' => '#0ca30c', 'tint' => '#e6f6e6', 'terminal' => true ),
		'on_hold'     => array( 'label' => 'On Hold',            'color' => '#fab219', 'tint' => '#fdf4e2', 'terminal' => false ),
		'rejected'    => array( 'label' => 'Not Selected',       'color' => '#d03b3b', 'tint' => '#fbeaea', 'terminal' => true ),
	);

	return apply_filters( 'axiora_internship_statuses', $statuses );
}

function axi_int_default_status() {
	return 'new';
}

function axi_int_status_exists( $key ) {
	return array_key_exists( $key, axi_int_statuses() );
}

function axi_int_status_label( $key ) {
	$all = axi_int_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['label'] : ucfirst( str_replace( '_', ' ', (string) $key ) );
}

function axi_int_status_color( $key ) {
	$all = axi_int_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['color'] : '#6b7490';
}

function axi_int_status_tint( $key ) {
	$all = axi_int_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['tint'] : '#f1f2f6';
}

/**
 * Status pill: coloured dot + the label in ink. Colour is never the only signal.
 */
function axi_int_status_badge( $key ) {
	printf(
		'<span class="axi-badge" style="--s:%1$s;--t:%2$s"><i></i>%3$s</span>',
		esc_attr( axi_int_status_color( $key ) ),
		esc_attr( axi_int_status_tint( $key ) ),
		esc_html( axi_int_status_label( $key ) )
	);
}

/**
 * Courses offered in the dropdown. Filter `axiora_internship_courses` to change.
 */
function axi_int_courses() {
	return apply_filters(
		'axiora_internship_courses',
		array(
			'B.E / B.Tech — Computer Science',
			'B.E / B.Tech — Information Technology',
			'B.E / B.Tech — Electronics & Communication',
			'B.E / B.Tech — Electrical & Electronics',
			'B.E / B.Tech — Mechanical',
			'B.E / B.Tech — Civil',
			'B.E / B.Tech — Other',
			'B.Sc — Computer Science',
			'B.Sc — Other',
			'BCA',
			'MCA',
			'M.E / M.Tech',
			'M.Sc',
			'MBA',
			'Other',
		)
	);
}

/**
 * Internship tracks the applicant can pick.
 */
function axi_int_tracks() {
	return apply_filters(
		'axiora_internship_tracks',
		array(
			'Generative AI & LLM Applications',
			'AI Agents & Automation',
			'Data Engineering for AI',
			'AI Product / Full-Stack Engineering',
			'Not sure yet — guide me',
		)
	);
}

/** Graduation years offered, current year onwards. */
function axi_int_grad_years() {
	$now   = (int) current_time( 'Y' );
	$years = array();
	for ( $y = $now - 2; $y <= $now + 5; $y++ ) {
		$years[] = (string) $y;
	}
	return $years;
}

/* -------------------------------------------------------------------------
 * Paths & URLs
 * ---------------------------------------------------------------------- */

/** Absolute path of the private resume directory (created on demand). */
function axi_int_upload_dir() {
	$uploads = wp_upload_dir();
	if ( ! empty( $uploads['error'] ) ) {
		return '';
	}
	$dir = trailingslashit( $uploads['basedir'] ) . 'axiora-internship';
	if ( ! file_exists( $dir ) ) {
		wp_mkdir_p( $dir );
	}
	return $dir;
}

function axi_int_portal_url( $route = '', $args = array() ) {
	$base = home_url( '/' . AXI_INT_PORTAL_SLUG . '/' );
	if ( $route ) {
		$base .= ltrim( $route, '/' ) . '/';
	}
	return $args ? add_query_arg( $args, $base ) : $base;
}

function axi_int_application_url() {
	$page_id = (int) get_option( 'axi_int_page_id' );
	if ( $page_id && 'publish' === get_post_status( $page_id ) ) {
		return get_permalink( $page_id );
	}
	return home_url( '/' . AXI_INT_PAGE_SLUG . '/' );
}

/* -------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------- */

/** "12 Aug 2026, 4:20 pm" in site timezone. */
function axi_int_date( $mysql_datetime, $format = 'j M Y, g:i a' ) {
	if ( ! $mysql_datetime || '0000-00-00 00:00:00' === $mysql_datetime ) {
		return '—';
	}
	$ts = strtotime( $mysql_datetime );
	return $ts ? date_i18n( $format, $ts ) : '—';
}

/** "3 hours ago" */
function axi_int_ago( $mysql_datetime ) {
	if ( ! $mysql_datetime || '0000-00-00 00:00:00' === $mysql_datetime ) {
		return '—';
	}
	// Rows are stored in site-local time, so compare against site-local "now".
	$ts  = strtotime( $mysql_datetime );
	$now = (int) current_time( 'timestamp' );
	if ( ! $ts ) {
		return '—';
	}
	if ( $ts > $now - 60 ) {
		return 'just now';
	}
	return sprintf( '%s ago', human_time_diff( $ts, $now ) );
}

/** Two-letter avatar initials. */
function axi_int_initials( $name ) {
	$parts = preg_split( '/\s+/', trim( (string) $name ) );
	$first = isset( $parts[0] ) ? mb_substr( $parts[0], 0, 1 ) : '?';
	$last  = ( count( $parts ) > 1 ) ? mb_substr( end( $parts ), 0, 1 ) : '';
	return mb_strtoupper( $first . $last );
}

/** Stable pastel avatar colour derived from the name. */
function axi_int_avatar_hue( $name ) {
	$hues = array( '#3c59e7', '#6b7cef', '#2a78d6', '#52259b', '#1baf7a', '#eb6834', '#d03b3b', '#0ca30c' );
	return $hues[ abs( crc32( (string) $name ) ) % count( $hues ) ];
}

function axi_int_display_or_dash( $value ) {
	$value = trim( (string) $value );
	return '' === $value ? '—' : $value;
}
