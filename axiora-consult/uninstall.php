<?php
/**
 * Runs when the plugin is deleted from wp-admin.
 *
 * Deliberately conservative: it removes the plugin's options and the custom
 * role, but it does NOT drop the enquiries tables or the landing page. Those
 * are real prospects' contact details; losing them to a mis-click would be
 * unrecoverable. To remove them, drop the wp_axiora_consults and
 * wp_axiora_consults_log tables by hand.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'axc_version' );
delete_option( 'axc_page_id' );

remove_role( 'axiora_consult_admin' );

foreach ( array( 'administrator', 'editor' ) as $axc_role_name ) {
	$axc_role = get_role( $axc_role_name );
	if ( $axc_role ) {
		$axc_role->remove_cap( 'manage_axiora_consults' );
	}
}
