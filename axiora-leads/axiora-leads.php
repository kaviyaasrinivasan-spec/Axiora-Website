<?php
/**
 * Plugin Name: Axiora Labs — Client Dashboard
 * Plugin URI:  https://axioralabs.ai/
 * Description: Captures leads from the website's contact form into a database and serves a separate branded portal to search, filter and track their status.
 * Version:     1.0.0
 * Author:      Axiora Labs
 * Author URI:  https://axioralabs.ai
 * License:     GPL-2.0-or-later
 * Text Domain: axiora-leads
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AXI_LEADS_VERSION', '1.0.0' );
define( 'AXI_LEADS_FILE', __FILE__ );
define( 'AXI_LEADS_DIR', plugin_dir_path( __FILE__ ) );
define( 'AXI_LEADS_URL', plugin_dir_url( __FILE__ ) );

/** Capability that unlocks the client dashboard portal. */
define( 'AXI_LEADS_CAP', 'manage_axiora_leads' );

/** Base path of the portal, e.g. https://axioralabs.ai/client-dashboard/ */
define( 'AXI_LEADS_PORTAL_SLUG', 'client-dashboard' );

require_once AXI_LEADS_DIR . 'includes/helpers.php';
require_once AXI_LEADS_DIR . 'includes/charts.php';
require_once AXI_LEADS_DIR . 'includes/class-db.php';
require_once AXI_LEADS_DIR . 'includes/class-capture.php';
require_once AXI_LEADS_DIR . 'includes/class-portal.php';

/**
 * Boot.
 */
function axi_leads_boot() {
	Axiora_Leads_Capture::init();
	Axiora_Leads_Portal::init();
}
add_action( 'plugins_loaded', 'axi_leads_boot' );

/* -------------------------------------------------------------------------
 * Rewrite rules for the portal
 * ---------------------------------------------------------------------- */

function axi_leads_rewrites() {
	add_rewrite_rule(
		'^' . AXI_LEADS_PORTAL_SLUG . '/?$',
		'index.php?axiora_leads_portal=1&axiora_leads_route=dashboard',
		'top'
	);
	add_rewrite_rule(
		'^' . AXI_LEADS_PORTAL_SLUG . '/([a-z0-9\-]+)/?$',
		'index.php?axiora_leads_portal=1&axiora_leads_route=$matches[1]',
		'top'
	);
	add_rewrite_rule(
		'^' . AXI_LEADS_PORTAL_SLUG . '/lead/([0-9]+)/?$',
		'index.php?axiora_leads_portal=1&axiora_leads_route=lead&axiora_leads_id=$matches[1]',
		'top'
	);
}
add_action( 'init', 'axi_leads_rewrites' );

function axi_leads_query_vars( $vars ) {
	$vars[] = 'axiora_leads_portal';
	$vars[] = 'axiora_leads_route';
	$vars[] = 'axiora_leads_id';
	return $vars;
}
add_filter( 'query_vars', 'axi_leads_query_vars' );

/* -------------------------------------------------------------------------
 * Activation / deactivation
 * ---------------------------------------------------------------------- */

function axi_leads_activate() {
	Axiora_Leads_DB::install();
	axi_leads_register_role();
	axi_leads_rewrites();
	flush_rewrite_rules();
	update_option( 'axi_leads_version', AXI_LEADS_VERSION );
}
register_activation_hook( __FILE__, 'axi_leads_activate' );

function axi_leads_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'axi_leads_deactivate' );

/** Run schema upgrades when the plugin files are updated without re-activation. */
function axi_leads_maybe_upgrade() {
	if ( get_option( 'axi_leads_version' ) !== AXI_LEADS_VERSION ) {
		Axiora_Leads_DB::install();
		axi_leads_register_role();
		update_option( 'axi_leads_version', AXI_LEADS_VERSION );
	}
}
add_action( 'admin_init', 'axi_leads_maybe_upgrade' );

/**
 * Dedicated role for portal-only staff, plus the capability for administrators
 * and editors.
 */
function axi_leads_register_role() {
	remove_role( 'axiora_leads_admin' );
	add_role(
		'axiora_leads_admin',
		__( 'Client Dashboard Admin', 'axiora-leads' ),
		array(
			'read'          => true,
			AXI_LEADS_CAP   => true,
		)
	);

	foreach ( array( 'administrator', 'editor' ) as $role_name ) {
		$role = get_role( $role_name );
		if ( $role ) {
			$role->add_cap( AXI_LEADS_CAP );
		}
	}
}
