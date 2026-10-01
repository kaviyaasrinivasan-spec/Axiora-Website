<?php
/**
 * "Book a Free AI Consultation" landing page — a standalone layout (no site
 * nav), so every visitor's only path forward is the form.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axc_theme    = get_template_directory_uri();
$axc_messages = Axiora_Consult_Landing::messages();
$axc_state    = isset( $_GET['axc'] ) ? sanitize_key( wp_unslash( $_GET['axc'] ) ) : '';
$axc_state    = isset( $axc_messages[ $axc_state ] ) ? $axc_state : '';

$axc_services = array( 'Custom AI Development', 'AI Automation', 'AI Agents', 'GenAI', 'Document AI' );
$axc_build    = array( 'AI Automation', 'AI Agents', 'Custom AI Software', 'GenAI', 'Document AI', 'RAG' );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MK5NX4R3');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-16746237443">
</script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-16746237443');
</script>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="<?php echo esc_url( $axc_theme . '/assets/img/favicon.png' ); ?>" type="image/png">
<link rel="preload" href="<?php echo esc_url( $axc_theme . '/assets/fonts/outfit.woff2' ); ?>" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:'Outfit';src:url(<?php echo esc_url( $axc_theme . '/assets/fonts/outfit.woff2' ); ?>) format('woff2');font-weight:100 900;font-display:swap;}
@font-face{font-family:'Inter';src:url(<?php echo esc_url( $axc_theme . '/assets/fonts/inter.woff2' ); ?>) format('woff2');font-weight:100 900;font-display:swap;}
</style>
<?php wp_head(); ?>
</head>
<body class="axc-landing">
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MK5NX4R3"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<header class="axc-top">
	<div class="axc-wrap axc-top-in">
		<a class="axc-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">
			<img src="<?php echo esc_url( $axc_theme . '/assets/img/logo.png' ); ?>" alt="Axiora Labs" width="1792" height="300">
		</a>
	</div>
</header>

<main>
	<section class="axc-hero">
		<div class="axc-wrap axc-hero-grid">

			<div class="axc-hero-copy">
				<h1>AI Solutions That Automate Your Business</h1>
				<p class="axc-sub">Automate repetitive work. Reduce manual effort. Build smarter with AI.</p>

				<ul class="axc-services" aria-label="What we build">
					<?php foreach ( $axc_services as $axc_item ) : ?>
						<li><?php echo esc_html( $axc_item ); ?></li>
					<?php endforeach; ?>
				</ul>

				<a class="axc-btn axc-btn-light axc-hero-cta" href="#consult">
					Book a Free AI Consultation
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
				</a>
			</div>

			<div class="axc-card" id="consult">
				<h2 data-axc-heading <?php echo ( 'ok' === $axc_state ) ? 'hidden' : ''; ?>>Tell Us What You Want to Automate</h2>

				<div class="axc-done" data-axc-done <?php echo ( 'ok' === $axc_state ) ? '' : 'hidden'; ?> role="status" tabindex="-1">
					<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>
					<h2>Thank You for Reaching Out</h2>
					<p><?php echo esc_html( $axc_messages['ok'] ); ?></p>
				</div>

				<form class="axc-form" method="post" action="<?php echo esc_url( axc_landing_url() ); ?>"
					data-axc-form novalidate <?php echo ( 'ok' === $axc_state ) ? 'hidden' : ''; ?>>
					<input type="hidden" name="axc_action" value="axc_submit">
					<?php if ( is_user_logged_in() ) : ?>
						<?php wp_nonce_field( 'axc_submit', 'axc_nonce' ); ?>
					<?php endif; ?>

					<div class="axc-hp" aria-hidden="true">
						<label for="axc-website">Leave this empty</label>
						<input type="text" id="axc-website" name="axc_website" tabindex="-1" autocomplete="off">
					</div>

					<div class="axc-alert" data-axc-alert role="alert" <?php echo ( $axc_state && 'ok' !== $axc_state ) ? '' : 'hidden'; ?>>
						<?php echo ( $axc_state && 'ok' !== $axc_state ) ? esc_html( $axc_messages[ $axc_state ] ) : ''; ?>
					</div>

					<div class="axc-fields">
						<div class="axc-field">
							<label for="axc-name">Name <span aria-hidden="true">*</span></label>
							<input id="axc-name" name="name" type="text" placeholder="Your Name" autocomplete="name" maxlength="150" required>
							<small class="axc-err" data-for="name"></small>
						</div>

						<div class="axc-field">
							<label for="axc-email">Work Email <span aria-hidden="true">*</span></label>
							<input id="axc-email" name="email" type="email" placeholder="Business Email" autocomplete="email" maxlength="190" required>
							<small class="axc-err" data-for="email"></small>
						</div>

						<div class="axc-field">
							<label for="axc-phone">Phone / WhatsApp <span aria-hidden="true">*</span></label>
							<input id="axc-phone" name="phone" type="tel" placeholder="Phone Number" autocomplete="tel" inputmode="tel" maxlength="32" required>
							<small class="axc-err" data-for="phone"></small>
						</div>

						<div class="axc-field">
							<label for="axc-company">Company <span aria-hidden="true">*</span></label>
							<input id="axc-company" name="company" type="text" placeholder="Company Name" autocomplete="organization" maxlength="190" required>
							<small class="axc-err" data-for="company"></small>
						</div>

						<div class="axc-field axc-field-full">
							<label for="axc-city">City <span aria-hidden="true">*</span></label>
							<input id="axc-city" name="city" type="text" placeholder="City Name" autocomplete="address-level2" maxlength="120" required>
							<small class="axc-err" data-for="city"></small>
						</div>

						<div class="axc-field axc-field-full">
							<label for="axc-req">What do you want to automate? <span aria-hidden="true">*</span></label>
							<textarea id="axc-req" name="requirement" rows="4" placeholder="Briefly describe your requirement" maxlength="4000" required></textarea>
							<small class="axc-err" data-for="requirement"></small>
						</div>
					</div>

					<button type="submit" class="axc-btn axc-btn-block" data-axc-submit>
						<span>Get Free Consultation</span>
					</button>

					<p class="axc-note">Our AI team will contact you to discuss your requirement.</p>
				</form>
			</div>

		</div>
	</section>

	<section class="axc-build">
		<div class="axc-wrap">
			<h2>Build AI for Your Business</h2>
			<ul class="axc-build-list">
				<?php foreach ( $axc_build as $axc_item ) : ?>
					<li><?php echo esc_html( $axc_item ); ?></li>
				<?php endforeach; ?>
			</ul>
			<a class="axc-btn" href="#consult">Book a Free AI Consultation</a>
		</div>
	</section>
</main>

<footer class="axc-foot">
	<div class="axc-wrap axc-foot-in">
		<strong class="axc-foot-brand">AXIORA LABS AI</strong>
		<span>&copy; <?php echo esc_html( date_i18n( 'Y' ) ); ?> Axiora Labs AI (OPC) Private Limited</span>
		<a href="<?php echo esc_url( home_url( '/privacy-policy/' ) ); ?>">Privacy Policy</a>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
