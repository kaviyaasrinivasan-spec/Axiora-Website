<?php
/**
 * Runs when the plugin is deleted from wp-admin.
 *
 * Deliberately conservative: it removes the plugin's option and the custom
 * role, but it does NOT drop the leads tables. Those are real prospects'
 * contact details; losing them to a mis-click would be unrecoverable. To
 * remove them, drop the wp_axiora_leads and wp_axiora_leads_log tables by hand.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'axi_leads_version' );

remove_role( 'axiora_leads_admin' );

foreach ( array( 'administrator', 'editor' ) as $axi_role_name ) {
	$axi_role = get_role( $axi_role_name );
	if ( $axi_role ) {
		$axi_role->remove_cap( 'manage_axiora_leads' );
	}
}
