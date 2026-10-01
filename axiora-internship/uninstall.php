<?php
/**
 * Runs when the plugin is deleted from wp-admin.
 *
 * Deliberately conservative: it removes the plugin's settings and the custom
 * role, but it does NOT drop the application tables or delete resume files.
 * Those are real people's applications — losing them to a mis-click would be
 * unrecoverable. To remove them, drop the two tables and the
 * wp-content/uploads/axiora-internship folder by hand.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'axi_int_version' );
delete_option( 'axi_int_page_id' );
delete_option( 'axi_int_notify_email' );
delete_option( 'axi_int_send_confirmation' );

remove_role( 'internship_admin' );

foreach ( array( 'administrator', 'editor' ) as $axi_role_name ) {
	$axi_role = get_role( $axi_role_name );
	if ( $axi_role ) {
		$axi_role->remove_cap( 'manage_internship_apps' );
	}
}
