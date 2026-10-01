<?php
/**
 * Portal shell — opening half. Expects:
 *   $axi_title     string  Page heading.
 *   $axi_subtitle  string  Small line under the heading.
 *   $axi_nav       string  Which sidebar item is current: dashboard | leads.
 *   $axi_actions   string  Optional HTML for the top-right action area.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axi_title    = isset( $axi_title ) ? $axi_title : 'Dashboard';
$axi_subtitle = isset( $axi_subtitle ) ? $axi_subtitle : '';
$axi_nav      = isset( $axi_nav ) ? $axi_nav : 'dashboard';
$axi_actions  = isset( $axi_actions ) ? $axi_actions : '';

$axi_user         = wp_get_current_user();
$axi_side_counts  = Axiora_Leads_DB::counts_by_status();
$axi_side_total   = array_sum( $axi_side_counts );
$axi_current_stat = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : '';
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?php echo esc_html( $axi_title ); ?> — Axiora Labs Client Dashboard</title>
<link rel="icon" href="<?php echo esc_url( get_template_directory_uri() . '/assets/img/favicon.png' ); ?>" type="image/png">
<?php wp_head(); ?>
</head>
<body class="axi-portal">
<?php include AXI_LEADS_DIR . 'templates/portal-icons.php'; ?>

<div class="axi-shell">

	<aside class="axi-side" id="axi-side">
		<div class="axi-side-brand">
			<a href="<?php echo esc_url( axi_leads_portal_url() ); ?>">
				<span class="axi-logo">AXIORA <b>LABS</b></span>
				<span class="axi-logo-sub">Client Dashboard</span>
			</a>
			<button type="button" class="axi-side-close" data-axi-toggle-nav aria-label="Close menu">
				<svg class="ico" aria-hidden="true"><use href="#p-x"/></svg>
			</button>
		</div>

		<nav class="axi-nav" aria-label="Portal">
			<span class="axi-nav-label">Overview</span>
			<a class="axi-nav-item<?php echo ( 'dashboard' === $axi_nav ) ? ' is-current' : ''; ?>"
				href="<?php echo esc_url( axi_leads_portal_url() ); ?>">
				<svg class="ico" aria-hidden="true"><use href="#p-grid"/></svg> Dashboard
			</a>
			<a class="axi-nav-item<?php echo ( 'leads' === $axi_nav && '' === $axi_current_stat ) ? ' is-current' : ''; ?>"
				href="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">
				<svg class="ico" aria-hidden="true"><use href="#p-inbox"/></svg> All Leads
				<span class="axi-nav-count"><?php echo esc_html( number_format_i18n( $axi_side_total ) ); ?></span>
			</a>

			<span class="axi-nav-label">Pipeline</span>
			<?php foreach ( axi_leads_statuses() as $axi_key => $axi_meta ) : ?>
				<a class="axi-nav-item axi-nav-status<?php echo ( 'leads' === $axi_nav && $axi_current_stat === $axi_key ) ? ' is-current' : ''; ?>"
					href="<?php echo esc_url( axi_leads_portal_url( 'leads', array( 'status' => $axi_key ) ) ); ?>">
					<i class="axi-dot" style="--s:<?php echo esc_attr( $axi_meta['color'] ); ?>"></i>
					<?php echo esc_html( $axi_meta['label'] ); ?>
					<span class="axi-nav-count"><?php echo esc_html( number_format_i18n( $axi_side_counts[ $axi_key ] ) ); ?></span>
				</a>
			<?php endforeach; ?>

			<span class="axi-nav-label">Site</span>
			<a class="axi-nav-item" href="<?php echo esc_url( axi_leads_contact_page_url() ); ?>" target="_blank" rel="noopener">
				<svg class="ico" aria-hidden="true"><use href="#p-file"/></svg> View Contact Page
			</a>
			<?php if ( current_user_can( 'manage_options' ) ) : ?>
				<a class="axi-nav-item" href="<?php echo esc_url( admin_url() ); ?>">
					<svg class="ico" aria-hidden="true"><use href="#p-lock"/></svg> WordPress Admin
				</a>
			<?php endif; ?>
		</nav>

		<div class="axi-side-foot">
			<div class="axi-side-user">
				<span class="axi-avatar" style="--a:#3c59e7"><?php echo esc_html( axi_leads_initials( $axi_user->display_name ) ); ?></span>
				<span class="axi-side-user-meta">
					<strong><?php echo esc_html( $axi_user->display_name ); ?></strong>
					<small><?php echo esc_html( $axi_user->user_email ); ?></small>
				</span>
			</div>
			<a class="axi-signout" href="<?php echo esc_url( Axiora_Leads_Portal::logout_url() ); ?>">
				<svg class="ico" aria-hidden="true"><use href="#p-logout"/></svg> Sign out
			</a>
		</div>
	</aside>

	<div class="axi-side-scrim" data-axi-toggle-nav hidden></div>

	<div class="axi-main">
		<header class="axi-top">
			<button type="button" class="axi-burger" data-axi-toggle-nav aria-label="Open menu">
				<svg class="ico" aria-hidden="true"><use href="#p-menu"/></svg>
			</button>
			<div class="axi-top-title">
				<h1><?php echo esc_html( $axi_title ); ?></h1>
				<?php if ( $axi_subtitle ) : ?>
					<p><?php echo esc_html( $axi_subtitle ); ?></p>
				<?php endif; ?>
			</div>
			<?php if ( $axi_actions ) : ?>
				<div class="axi-top-actions"><?php echo $axi_actions; // phpcs:ignore WordPress.Security.EscapeOutput -- built from escaped parts by the calling template. ?></div>
			<?php endif; ?>
		</header>

		<div class="axi-content">

		<?php if ( ! empty( Axiora_Leads_Portal::$notice ) ) : ?>
			<div class="axi-notice axi-notice-<?php echo esc_attr( Axiora_Leads_Portal::$notice['type'] ); ?>" role="status">
				<svg class="ico" aria-hidden="true"><use href="#<?php echo ( 'ok' === Axiora_Leads_Portal::$notice['type'] ) ? 'p-check' : 'p-alert'; ?>"/></svg>
				<?php echo esc_html( Axiora_Leads_Portal::$notice['text'] ); ?>
			</div>
		<?php endif; ?>
