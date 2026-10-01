<?php
/**
 * Shared vocabulary: statuses, paths, small formatters.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The lead pipeline.
 *
 * Colours are deliberate, not decorative: three in-flight stages use a single
 * blue ramp light -> dark so "further along" reads as "darker" at a glance,
 * "Completed" uses the reserved "good" hue and "Not Interested" a neutral grey. Every place a colour
 * appears it is paired with the status label, so the state is never carried
 * by colour alone.
 *
 * Filter `axiora_consult_statuses` to add or rename stages.
 *
 * @return array<string,array{label:string,color:string,tint:string,terminal:bool}>
 */
function axc_statuses() {
	$statuses = array(
		'new'               => array( 'label' => 'New',               'color' => '#86b6ef', 'tint' => '#eef4fd', 'terminal' => false ),
		'contacted'         => array( 'label' => 'Contacted',          'color' => '#2a78d6', 'tint' => '#e6eefa', 'terminal' => false ),
		'meeting_scheduled' => array( 'label' => 'Meeting Scheduled',  'color' => '#1c5cab', 'tint' => '#e4ebf6', 'terminal' => false ),
		'completed'         => array( 'label' => 'Completed',          'color' => '#0ca30c', 'tint' => '#e6f6e6', 'terminal' => true ),
		'not_interested'    => array( 'label' => 'Not Interested',     'color' => '#8a91a8', 'tint' => '#f1f2f6', 'terminal' => true ),
	);

	return apply_filters( 'axiora_consult_statuses', $statuses );
}

function axc_default_status() {
	return 'new';
}

function axc_status_exists( $key ) {
	return array_key_exists( $key, axc_statuses() );
}

function axc_status_label( $key ) {
	$all = axc_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['label'] : ucfirst( str_replace( '_', ' ', (string) $key ) );
}

function axc_status_color( $key ) {
	$all = axc_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['color'] : '#6b7490';
}

function axc_status_tint( $key ) {
	$all = axc_statuses();
	return isset( $all[ $key ] ) ? $all[ $key ]['tint'] : '#f1f2f6';
}

/**
 * Status pill: coloured dot + the label in ink. Colour is never the only signal.
 */
function axc_status_badge( $key ) {
	printf(
		'<span class="axi-badge" style="--s:%1$s;--t:%2$s"><i></i>%3$s</span>',
		esc_attr( axc_status_color( $key ) ),
		esc_attr( axc_status_tint( $key ) ),
		esc_html( axc_status_label( $key ) )
	);
}

/* -------------------------------------------------------------------------
 * Paths & URLs
 * ---------------------------------------------------------------------- */

function axc_portal_url( $route = '', $args = array() ) {
	$base = home_url( '/' . AXC_PORTAL_SLUG . '/' );
	if ( $route ) {
		$base .= ltrim( $route, '/' ) . '/';
	}
	return $args ? add_query_arg( $args, $base ) : $base;
}

/** The public landing page — surfaced as a sidebar link. */
function axc_landing_url() {
	$id = (int) get_option( 'axc_page_id' );
	return $id ? get_permalink( $id ) : home_url( '/' . AXC_PAGE_SLUG . '/' );
}

/* -------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------- */

/** "12 Aug 2026, 4:20 pm" in site timezone. */
function axc_date( $mysql_datetime, $format = 'j M Y, g:i a' ) {
	if ( ! $mysql_datetime || '0000-00-00 00:00:00' === $mysql_datetime ) {
		return '—';
	}
	$ts = strtotime( $mysql_datetime );
	return $ts ? date_i18n( $format, $ts ) : '—';
}

/** "3 hours ago" */
function axc_ago( $mysql_datetime ) {
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
function axc_initials( $name ) {
	$parts = preg_split( '/\s+/', trim( (string) $name ) );
	$first = isset( $parts[0] ) ? mb_substr( $parts[0], 0, 1 ) : '?';
	$last  = ( count( $parts ) > 1 ) ? mb_substr( end( $parts ), 0, 1 ) : '';
	return mb_strtoupper( $first . $last );
}

/** Stable pastel avatar colour derived from the name. */
function axc_avatar_hue( $name ) {
	$hues = array( '#3c59e7', '#6b7cef', '#2a78d6', '#52259b', '#1baf7a', '#eb6834', '#d03b3b', '#0ca30c' );
	return $hues[ abs( crc32( (string) $name ) ) % count( $hues ) ];
}

function axc_display_or_dash( $value ) {
	$value = trim( (string) $value );
	return '' === $value ? '—' : $value;
}

/**
 * Phone as typed ("098765 43210", "+971 50 123 4567") -> dialable "+<digits>"
 * for tel: and wa.me links. A bare 10-digit number is taken as Indian (+91),
 * matching where most enquiries come from; anything with a + is left as-is.
 */
function axc_phone_dial( $phone ) {
	$phone  = trim( (string) $phone );
	$digits = preg_replace( '/[^0-9]/', '', $phone );

	if ( '' === $digits ) {
		return '';
	}
	if ( 0 === strpos( $phone, '+' ) ) {
		return '+' . $digits;
	}
	if ( 0 === strpos( $digits, '00' ) ) {
		return '+' . substr( $digits, 2 );
	}
	$digits = ltrim( $digits, '0' );
	return '+' . ( 10 === strlen( $digits ) ? '91' . $digits : $digits );
}

/* -------------------------------------------------------------------------
 * Sources — which form an enquiry came from
 * ---------------------------------------------------------------------- */

function axc_sources() {
	return array(
		'landing' => 'AI consultation page',
		'contact' => 'Contact page',
	);
}

function axc_source_label( $key ) {
	$all = axc_sources();
	return isset( $all[ $key ] ) ? $all[ $key ] : ucfirst( (string) $key );
}
