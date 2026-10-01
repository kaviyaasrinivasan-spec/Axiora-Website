<?php
/**
 * The portal's own sign-in screen. Expects $error and $username from
 * Axiora_Leads_Portal::render_login().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$error    = isset( $error ) ? $error : '';
$username = isset( $username ) ? $username : '';
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in — Axiora Labs Client Dashboard</title>
<link rel="icon" href="<?php echo esc_url( get_template_directory_uri() . '/assets/img/favicon.png' ); ?>" type="image/png">
<?php wp_head(); ?>
</head>
<body class="axi-portal axi-login-body">
<?php include AXI_LEADS_DIR . 'templates/portal-icons.php'; ?>

<main class="axi-login">
	<div class="axi-login-card">

		<div class="axi-login-brand">
			<span class="axi-logo">AXIORA <b>LABS</b></span>
			<span class="axi-logo-sub">Client Dashboard</span>
		</div>

		<h1>Sign in</h1>
		<p class="axi-login-lead">Admin access to client leads and their status.</p>

		<?php if ( $error ) : ?>
			<div class="axi-login-error" role="alert">
				<svg class="ico" aria-hidden="true"><use href="#p-alert"/></svg>
				<span><?php echo esc_html( $error ); ?></span>
			</div>
		<?php endif; ?>

		<form method="post" action="<?php echo esc_url( axi_leads_portal_url( 'login' ) ); ?>" class="axi-login-form">
			<?php wp_nonce_field( 'axi_leads_login', '_axi_nonce' ); ?>
			<input type="hidden" name="axi_login" value="1">

			<div class="axi-field">
				<label for="axi-log">Username or email</label>
				<input type="text" id="axi-log" name="log" value="<?php echo esc_attr( $username ); ?>"
					autocomplete="username" autocapitalize="off" spellcheck="false" required autofocus>
			</div>

			<div class="axi-field">
				<label for="axi-pwd">Password</label>
				<div class="axi-pwd">
					<input type="password" id="axi-pwd" name="pwd" autocomplete="current-password" required>
					<button type="button" class="axi-pwd-toggle" data-axi-pwd aria-label="Show password">Show</button>
				</div>
			</div>

			<label class="axi-remember">
				<input type="checkbox" name="rememberme" value="1"> Keep me signed in
			</label>

			<button type="submit" class="axi-btn axi-btn-primary axi-btn-block">Sign in</button>
		</form>

		<p class="axi-login-foot">
			Lost your password? Reset it from the
			<a href="<?php echo esc_url( wp_lostpassword_url( axi_leads_portal_url() ) ); ?>">WordPress password reset</a> page.
		</p>
	</div>

	<p class="axi-login-copy">Axiora Labs AI (OPC) Private Limited · Chennai, India</p>
</main>

<?php wp_footer(); ?>
</body>
</html>
