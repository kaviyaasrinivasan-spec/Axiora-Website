<?php
/**
 * Plugin Name: Axiora Labs — AI Consultation Leads
 * Plugin URI:  https://axioralabs.ai/ai-consultation/
 * Description: "Book a Free AI Consultation" landing page with a lead form, plus a separate branded admin dashboard to view, track and manage every submission.
 * Version:     1.0.10
 * Author:      Axiora Labs
 * Author URI:  https://axioralabs.ai
 * License:     GPL-2.0-or-later
 * Text Domain: axiora-consult
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AXC_VERSION', '1.0.10' );
define( 'AXC_FILE', __FILE__ );
define( 'AXC_DIR', plugin_dir_path( __FILE__ ) );
define( 'AXC_URL', plugin_dir_url( __FILE__ ) );

/** Capability that unlocks the consultation dashboard. */
define( 'AXC_CAP', 'manage_axiora_consults' );

/** Slug of the public landing page (a real WP page, auto-created on activation). */
define( 'AXC_PAGE_SLUG', 'ai-consultation' );

/** Base path of the dashboard, e.g. https://axioralabs.ai/consultation-admin/ */
define( 'AXC_PORTAL_SLUG', 'consultation-admin' );

/** Where new-submission alerts go. Filter `axc_notify_email` to change. */
define( 'AXC_NOTIFY_TO', 'sales@axioralabs.ai' );

require_once AXC_DIR . 'includes/helpers.php';
require_once AXC_DIR . 'includes/charts.php';
require_once AXC_DIR . 'includes/class-db.php';
require_once AXC_DIR . 'includes/class-auth.php';
require_once AXC_DIR . 'includes/class-landing.php';
require_once AXC_DIR . 'includes/class-capture.php';
require_once AXC_DIR . 'includes/class-portal.php';

/**
 * Boot.
 */
function axc_boot() {
	Axiora_Consult_Auth::init();
	Axiora_Consult_Landing::init();
	Axiora_Consult_Capture::init();
	Axiora_Consult_Portal::init();
}
add_action( 'plugins_loaded', 'axc_boot' );

/* -------------------------------------------------------------------------
 * Rewrite rules for the dashboard
 * ---------------------------------------------------------------------- */

function axc_rewrites() {
	add_rewrite_rule(
		'^' . AXC_PORTAL_SLUG . '/?$',
		'index.php?axc_portal=1&axc_route=dashboard',
		'top'
	);
	add_rewrite_rule(
		'^' . AXC_PORTAL_SLUG . '/([a-z0-9\-]+)/?$',
		'index.php?axc_portal=1&axc_route=$matches[1]',
		'top'
	);
	add_rewrite_rule(
		'^' . AXC_PORTAL_SLUG . '/lead/([0-9]+)/?$',
		'index.php?axc_portal=1&axc_route=lead&axc_id=$matches[1]',
		'top'
	);
}
add_action( 'init', 'axc_rewrites' );

function axc_query_vars( $vars ) {
	$vars[] = 'axc_portal';
	$vars[] = 'axc_route';
	$vars[] = 'axc_id';
	return $vars;
}
add_filter( 'query_vars', 'axc_query_vars' );

/* -------------------------------------------------------------------------
 * Activation / deactivation
 * ---------------------------------------------------------------------- */

function axc_activate() {
	Axiora_Consult_DB::install();
	axc_register_role();
	axc_create_landing_page();
	axc_rewrites();
	flush_rewrite_rules();
	update_option( 'axc_version', AXC_VERSION );
}
register_activation_hook( __FILE__, 'axc_activate' );

function axc_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'axc_deactivate' );

/** Run schema upgrades when the plugin files are updated without re-activation. */
function axc_maybe_upgrade() {
	if ( get_option( 'axc_version' ) !== AXC_VERSION ) {
		Axiora_Consult_DB::install();
		axc_register_role();
		update_option( 'axc_version', AXC_VERSION );
	}
}
// On init, not admin_init: schema upgrades must not wait for someone to open wp-admin.
add_action( 'init', 'axc_maybe_upgrade' );

/**
 * Dedicated role for dashboard-only staff, plus the capability for
 * administrators and editors.
 */
function axc_register_role() {
	remove_role( 'axiora_consult_admin' );
	add_role(
		'axiora_consult_admin',
		__( 'Consultation Dashboard Admin', 'axiora-consult' ),
		array(
			'read'  => true,
			AXC_CAP => true,
		)
	);

	foreach ( array( 'administrator', 'editor' ) as $role_name ) {
		$role = get_role( $role_name );
		if ( $role ) {
			$role->add_cap( AXC_CAP );
		}
	}
}

/**
 * The landing page is a real WordPress page so Yoast SEO, analytics and the
 * page's URL all behave normally. Its body is ignored — the plugin renders the
 * landing layout itself (see class-landing.php). Re-uses an existing page with
 * the slug instead of creating a duplicate.
 */
function axc_create_landing_page() {
	$page = get_page_by_path( AXC_PAGE_SLUG );

	if ( $page ) {
		update_option( 'axc_page_id', (int) $page->ID );
		return;
	}

	$id = wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'AI Solutions That Automate Your Business',
			'post_name'    => AXC_PAGE_SLUG,
			'post_content' => '<!-- Rendered by the Axiora Labs — AI Consultation Leads plugin. -->',
		)
	);

	if ( $id && ! is_wp_error( $id ) ) {
		update_option( 'axc_page_id', (int) $id );
	}
}
