<?php
/**
 * The general job application form (programme key 'qa', kept from when it
 * was the QA Engineer form). Rendered by [axiora_qa_internship_form] and
 * by the QA page template. Submits over AJAX to
 * Axiora_Internship_Form::ajax_submit_qa().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axi_form_id = 'axi-qa-' . wp_rand( 1000, 9999 );
?>
<div class="axi-form-wrap" id="apply">
	<div class="axi-form-card">

		<div class="axi-form-head">
			<?php /* The page has no hero, so this is the page's only h1. */ ?>
			<h1>Apply to Axiora Labs AI</h1>
			<p>Interested in working with us? Tell us about yourself and upload your resume. Fields marked <span class="axi-req">*</span> are required.</p>
		</div>

		<form class="axi-form" id="<?php echo esc_attr( $axi_form_id ); ?>" novalidate enctype="multipart/form-data"
			data-axi-programme="qa" data-axi-action="axi_int_submit_qa">

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-name">Full Name <span class="axi-req">*</span></label>
				<input type="text" id="<?php echo esc_attr( $axi_form_id ); ?>-name" name="full_name" placeholder="Your full name"
					autocomplete="name" maxlength="150" required>
				<span class="axi-err" data-err="full_name"></span>
			</div>

			<div class="axi-field-row">
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-phone">Phone Number <span class="axi-req">*</span></label>
					<input type="tel" id="<?php echo esc_attr( $axi_form_id ); ?>-phone" name="phone" placeholder="+91 98765 43210"
						autocomplete="tel" inputmode="tel" maxlength="20" required>
					<span class="axi-err" data-err="phone"></span>
				</div>
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-city">City <span class="axi-req">*</span></label>
					<input type="text" id="<?php echo esc_attr( $axi_form_id ); ?>-city" name="city" placeholder="Your city"
						autocomplete="address-level2" maxlength="120" required>
					<span class="axi-err" data-err="city"></span>
				</div>
			</div>

			<div class="axi-field">
				<span class="axi-field-label" id="<?php echo esc_attr( $axi_form_id ); ?>-gender">Gender</span>
				<div class="axi-choice" role="radiogroup" aria-labelledby="<?php echo esc_attr( $axi_form_id ); ?>-gender">
					<?php foreach ( axi_int_genders() as $axi_gender ) : ?>
						<label class="axi-choice-opt">
							<input type="radio" name="gender" value="<?php echo esc_attr( $axi_gender ); ?>">
							<span><?php echo esc_html( $axi_gender ); ?></span>
						</label>
					<?php endforeach; ?>
				</div>
				<span class="axi-err" data-err="gender"></span>
			</div>

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-resume">Resume <span class="axi-req">*</span></label>
				<label class="axi-file" for="<?php echo esc_attr( $axi_form_id ); ?>-resume">
					<span class="axi-file-ico"><svg class="icon" aria-hidden="true"><use href="#i-upload"/></svg></span>
					<span class="axi-file-text">
						<strong class="axi-file-name">Upload resume</strong>
						<span class="axi-file-hint">PDF, DOC or DOCX, up to 5 MB</span>
					</span>
					<span class="axi-file-btn">Choose file</span>
					<input type="file" id="<?php echo esc_attr( $axi_form_id ); ?>-resume" name="resume"
						accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>
				</label>
				<span class="axi-err" data-err="resume"></span>
			</div>

			<?php /* Spam guards: hidden from people, irresistible to bots. */ ?>
			<div class="axi-hp" aria-hidden="true">
				<label>Website<input type="text" name="axi_website" tabindex="-1" autocomplete="off"></label>
			</div>
			<input type="hidden" name="axi_t" value="<?php echo esc_attr( time() ); ?>">

			<button type="submit" class="btn btn-primary axi-submit">
				<span class="axi-submit-label">Apply Now</span>
				<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
			</button>

			<p class="axi-form-foot">Your details are stored securely and used only for this application.</p>

			<div class="axi-form-error" role="alert" hidden></div>
		</form>

		<div class="axi-success" hidden>
			<div class="axi-success-ico"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></div>
			<h3>Application submitted</h3>
			<p class="axi-success-msg">Thank you for applying! Your application has been submitted successfully.</p>
			<p class="axi-success-note">Our team reviews every application and will contact you on the phone number you shared.</p>
		</div>

	</div>
</div>
