<?php
/**
 * Page template: the public GenAI internship page.
 *
 * Registered by the plugin as "Axiora — GenAI Internship", so it is selectable
 * on any page under Page Attributes → Template. Uses the theme's header, footer
 * and icon sprite so the page is indistinguishable from the rest of the site.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>
<main id="top" class="axi-internship">

	<section class="axi-hero">
		<div class="wrap axi-hero-inner">
			<span class="eyebrow reveal">Internship Programme</span>
			<h1 class="reveal">Build Real <span class="grad">GenAI Products</span> as an Intern</h1>
			<p class="reveal">Work alongside our engineering team on the same LLM applications, AI agents and automation
				pipelines we ship for enterprise clients — not sample projects.</p>
			<div class="axi-hero-cta reveal">
				<a class="btn btn-primary" href="#apply">Apply Now <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>
				<a class="btn btn-ghost" href="<?php echo esc_url( home_url( '/about/' ) ); ?>">About Axiora Labs</a>
			</div>
		</div>
	</section>

	<section class="section">
		<div class="wrap">
			<div class="section-head reveal">
				<span class="eyebrow">What you'll do</span>
				<h2>Hands-on From Week One</h2>
				<p>You will be paired with an engineer and given real scope on live work.</p>
			</div>
			<div class="axi-cards">
				<div class="axi-card reveal" style="--c1:#3c59e7;--c2:#6b7cef">
					<div class="axi-card-ico"><svg class="icon" aria-hidden="true"><use href="#i-brain"/></svg></div>
					<h3>LLM Applications</h3>
					<p>Prompting, retrieval, evaluation and the plumbing that makes a model useful in a real product.</p>
				</div>
				<div class="axi-card reveal" style="--c1:#a855f7;--c2:#ec4899">
					<div class="axi-card-ico"><svg class="icon" aria-hidden="true"><use href="#i-bot"/></svg></div>
					<h3>AI Agents &amp; Automation</h3>
					<p>Build agents and workflows that take manual business processes off people's desks.</p>
				</div>
				<div class="axi-card reveal" style="--c1:#10b981;--c2:#34d399">
					<div class="axi-card-ico"><svg class="icon" aria-hidden="true"><use href="#i-database"/></svg></div>
					<h3>Data for AI</h3>
					<p>Pipelines, extraction and the unglamorous data work that decides whether an AI feature works.</p>
				</div>
				<div class="axi-card reveal" style="--c1:#f59e0b;--c2:#f97316"><div class="axi-card-ico"><svg class="icon" aria-hidden="true"><use href="#i-code"/></svg></div>
					<h3>Product Engineering</h3>
					<p>Ship the interface around the intelligence — APIs, dashboards and everything users touch.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="section bg-soft axi-apply-section">
		<div class="wrap">
			<div class="section-head reveal">
				<span class="eyebrow">Application</span>
				<h2>Send Us Your Details</h2>
				<p>It takes about two minutes. Every application is read by our team.</p>
			</div>
			<?php echo do_shortcode( '[axiora_internship_form]' ); ?>
		</div>
	</section>

	<section class="section axi-steps-section">
		<div class="wrap">
			<div class="section-head reveal">
				<span class="eyebrow">What happens next</span>
				<h2>Your Application, Step by Step</h2>
			</div>
			<ol class="axi-steps">
				<li class="reveal"><span class="axi-step-n">1</span><div><h3>You apply</h3><p>Your details are saved and you get a reference number by email immediately.</p></div></li>
				<li class="reveal"><span class="axi-step-n">2</span><div><h3>We review</h3><p>Our team goes through your profile and resume and marks your application as reviewed.</p></div></li>
				<li class="reveal"><span class="axi-step-n">3</span><div><h3>We talk</h3><p>Shortlisted candidates are contacted for a conversation about the work and the fit.</p></div></li>
				<li class="reveal"><span class="axi-step-n">4</span><div><h3>You start</h3><p>Selected interns are onboarded onto a live project with a named mentor.</p></div></li>
			</ol>
		</div>
	</section>

</main>
<?php
get_footer();
