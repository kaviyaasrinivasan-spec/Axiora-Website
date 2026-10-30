<?php
/**
 * Plugin Name: Axiora Labs — GenAI Internship
 * Plugin URI:  https://axioralabs.ai/genai-internship/
 * Description: Public GenAI internship and general job application forms + a separate branded admin portal to view, track and update the status of every submission.
 * Version:     1.1.5
 * Author:      Axiora Labs
 * Author URI:  https://axioralabs.ai
 * License:     GPL-2.0-or-later
 * Text Domain: axiora-internship
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AXI_INT_VERSION', '1.1.5' );
define( 'AXI_INT_FILE', __FILE__ );
define( 'AXI_INT_DIR', plugin_dir_path( __FILE__ ) );
define( 'AXI_INT_URL', plugin_dir_url( __FILE__ ) );

/** Capability that unlocks the admin portal. */
define( 'AXI_INT_CAP', 'manage_internship_apps' );

/** Slug of the public application page (auto-created on activation). */
define( 'AXI_INT_PAGE_SLUG', 'genai-internship' );

/** Slug of the general job application page (auto-created on activation / upgrade). */
define( 'AXI_INT_QA_PAGE_SLUG', 'apply' );

/** Earlier address of that page; 301-redirected so shared links keep working. */
define( 'AXI_INT_QA_LEGACY_SLUG', 'qaengineer-internship' );

/** Base path of the admin portal, e.g. https://axioralabs.ai/internship-admin/ */
define( 'AXI_INT_PORTAL_SLUG', 'internship-admin' );

require_once AXI_INT_DIR . 'includes/helpers.php';
require_once AXI_INT_DIR . 'includes/charts.php';
require_once AXI_INT_DIR . 'includes/class-db.php';
require_once AXI_INT_DIR . 'includes/class-mailer.php';
require_once AXI_INT_DIR . 'includes/class-form.php';
require_once AXI_INT_DIR . 'includes/class-portal.php';
require_once AXI_INT_DIR . 'includes/class-settings.php';

/**
 * Boot.
 */
function axi_int_boot() {
	Axiora_Internship_Form::init();
	Axiora_Internship_Portal::init();
	Axiora_Internship_Settings::init();
}
add_action( 'plugins_loaded', 'axi_int_boot' );

/**
 * /qaengineer-internship/ → /apply/. WordPress keeps no old-slug redirect for
 * pages, so do it here; the query string (e.g. UTM tags) is carried over.
 */
function axi_int_legacy_redirect() {
	$path = wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '', PHP_URL_PATH );
	if ( AXI_INT_QA_LEGACY_SLUG !== trim( (string) $path, '/' ) ) {
		return;
	}
	$query = wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_QUERY );
	wp_safe_redirect( axi_int_qa_application_url() . ( $query ? '?' . $query : '' ), 301 );
	exit;
}
add_action( 'template_redirect', 'axi_int_legacy_redirect', 0 );

/* -------------------------------------------------------------------------
 * Rewrite rules for the admin portal
 * ---------------------------------------------------------------------- */

function axi_int_rewrites() {
	add_rewrite_rule(
		'^' . AXI_INT_PORTAL_SLUG . '/?$',
		'index.php?axiora_portal=1&axiora_route=dashboard',
		'top'
	);
	add_rewrite_rule(
		'^' . AXI_INT_PORTAL_SLUG . '/([a-z0-9\-]+)/?$',
		'index.php?axiora_portal=1&axiora_route=$matches[1]',
		'top'
	);
	add_rewrite_rule(
		'^' . AXI_INT_PORTAL_SLUG . '/application/([0-9]+)/?$',
		'index.php?axiora_portal=1&axiora_route=application&axiora_app=$matches[1]',
		'top'
	);
}
add_action( 'init', 'axi_int_rewrites' );

function axi_int_query_vars( $vars ) {
	$vars[] = 'axiora_portal';
	$vars[] = 'axiora_route';
	$vars[] = 'axiora_app';
	return $vars;
}
add_filter( 'query_vars', 'axi_int_query_vars' );

/* -------------------------------------------------------------------------
 * Activation / deactivation
 * ---------------------------------------------------------------------- */

function axi_int_activate() {
	Axiora_Internship_DB::install();
	axi_int_register_role();
	axi_int_protect_upload_dir();
	axi_int_create_application_page();
	axi_int_create_qa_page();
	axi_int_rewrites();
	flush_rewrite_rules();
	update_option( 'axi_int_version', AXI_INT_VERSION );
}
register_activation_hook( __FILE__, 'axi_int_activate' );

function axi_int_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'axi_int_deactivate' );

/**
 * Run schema upgrades when the plugin files are updated without re-activation.
 * On init, not admin_init: portal staff never open wp-admin, and the public
 * form must not write to columns that do not exist yet.
 */
function axi_int_maybe_upgrade() {
	if ( get_option( 'axi_int_version' ) !== AXI_INT_VERSION ) {
		Axiora_Internship_DB::install();
		axi_int_register_role();
		axi_int_protect_upload_dir();
		axi_int_create_qa_page();
		update_option( 'axi_int_version', AXI_INT_VERSION );
	}
}
add_action( 'init', 'axi_int_maybe_upgrade', 20 );

/**
 * Dedicated role for portal-only staff, plus the capability for administrators.
 */
function axi_int_register_role() {
	remove_role( 'internship_admin' );
	add_role(
		'internship_admin',
		__( 'Internship Admin', 'axiora-internship' ),
		array(
			'read'       => true,
			AXI_INT_CAP  => true,
		)
	);

	foreach ( array( 'administrator', 'editor' ) as $role_name ) {
		$role = get_role( $role_name );
		if ( $role ) {
			$role->add_cap( AXI_INT_CAP );
		}
	}
}

/**
 * Resumes live outside the web-readable uploads listing: direct URL access is
 * denied and files are only ever served through the nonce + capability gated
 * download endpoint in class-portal.php.
 */
function axi_int_protect_upload_dir() {
	$dir = axi_int_upload_dir();
	if ( ! $dir ) {
		return;
	}
	if ( ! file_exists( $dir . '/.htaccess' ) ) {
		$rules  = "# Axiora Labs — resumes are private.\n";
		$rules .= "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
		$rules .= "<IfModule !mod_authz_core.c>\n  Order deny,allow\n  Deny from all\n</IfModule>\n";
		@file_put_contents( $dir . '/.htaccess', $rules );
	}
	if ( ! file_exists( $dir . '/index.html' ) ) {
		@file_put_contents( $dir . '/index.html', '' );
	}
	if ( ! file_exists( $dir . '/web.config' ) ) {
		$xml = "<?xml version=\"1.0\"?>\n<configuration><system.webServer><authorization>"
			. "<deny users=\"*\" /></authorization></system.webServer></configuration>\n";
		@file_put_contents( $dir . '/web.config', $xml );
	}
}

/**
 * Creates /genai-internship on activation and assigns the plugin page template,
 * so the page stops 404-ing without anyone touching the theme.
 */
function axi_int_create_application_page() {
	$existing = get_page_by_path( AXI_INT_PAGE_SLUG );

	if ( $existing ) {
		$page_id = $existing->ID;
	} else {
		$page_id = wp_insert_post(
			array(
				'post_title'   => 'GenAI Internship',
				'post_name'    => AXI_INT_PAGE_SLUG,
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '[axiora_internship_form]',
			)
		);
	}

	if ( $page_id && ! is_wp_error( $page_id ) ) {
		update_post_meta( $page_id, '_wp_page_template', 'axiora-internship-page' );
		update_option( 'axi_int_page_id', (int) $page_id );
	}
}

/**
 * Creates /qaengineer-internship with the QA page template. Reuses an existing
 * page at that slug rather than duplicating it.
 */
function axi_int_create_qa_page() {
	$existing = get_page_by_path( AXI_INT_QA_PAGE_SLUG );

	if ( $existing ) {
		$page_id = $existing->ID;
	} else {
		$page_id = wp_insert_post(
			array(
				'post_title'   => 'Job Application',
				'post_name'    => AXI_INT_QA_PAGE_SLUG,
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '[axiora_qa_internship_form]',
			)
		);
	}

	if ( $page_id && ! is_wp_error( $page_id ) ) {
		update_post_meta( $page_id, '_wp_page_template', 'axiora-qa-internship-page' );
		update_option( 'axi_int_qa_page_id', (int) $page_id );
	}
}
