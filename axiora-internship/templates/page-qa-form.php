<?php
/**
 * Page template: the public general job application page.
 *
 * Registered by the plugin as "Axiora — Job Application". Just the
 * application form — nothing else, so the form stays the focus. Uses
 * the theme's header, footer and icon sprite like the GenAI page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<main id="top" class="axi-internship axi-qa">

	<section class="section bg-soft axi-apply-section axi-qa-apply">
		<div class="wrap">
			<?php echo do_shortcode( '[axiora_qa_internship_form]' ); ?>
		</div>
	</section>

</main>
<?php
get_footer();
