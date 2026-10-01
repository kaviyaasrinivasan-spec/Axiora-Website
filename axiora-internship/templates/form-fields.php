<?php
/**
 * The application form itself. Rendered by [axiora_internship_form] and by the
 * page template. Submits over AJAX to Axiora_Internship_Form::ajax_submit().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axi_form_id = 'axi-form-' . wp_rand( 1000, 9999 );
?>
<div class="axi-form-wrap" id="apply">
	<div class="axi-form-card">

		<div class="axi-form-head">
			<h2>Apply for the GenAI Internship</h2>
			<p>Fill in your details below and save your application. You will get a reference number by email straight away.</p>
		</div>

		<form class="axi-form" id="<?php echo esc_attr( $axi_form_id ); ?>" novalidate enctype="multipart/form-data">

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-name">Full Name <span class="axi-req">*</span></label>
				<input type="text" id="<?php echo esc_attr( $axi_form_id ); ?>-name" name="full_name" placeholder="Your full name"
					autocomplete="name" required>
				<span class="axi-err" data-err="full_name"></span>
			</div>

			<div class="axi-field-row">
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-email">Email Address <span class="axi-req">*</span></label>
					<input type="email" id="<?php echo esc_attr( $axi_form_id ); ?>-email" name="email" placeholder="you@example.com"
						autocomplete="email" required>
					<span class="axi-err" data-err="email"></span>
				</div>
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-phone">Phone Number <span class="axi-req">*</span></label>
					<input type="tel" id="<?php echo esc_attr( $axi_form_id ); ?>-phone" name="phone" placeholder="+91 98765 43210"
						autocomplete="tel" required>
					<span class="axi-err" data-err="phone"></span>
				</div>
			</div>

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-college">College / University <span class="axi-req">*</span></label>
				<input type="text" id="<?php echo esc_attr( $axi_form_id ); ?>-college" name="college"
					placeholder="Your institution" autocomplete="organization" required>
				<span class="axi-err" data-err="college"></span>
			</div>

			<div class="axi-field-row">
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-course">Course <span class="axi-req">*</span></label>
					<select id="<?php echo esc_attr( $axi_form_id ); ?>-course" name="course" required>
						<option value="">Select your course</option>
						<?php foreach ( axi_int_courses() as $axi_course ) : ?>
							<option value="<?php echo esc_attr( $axi_course ); ?>"><?php echo esc_html( $axi_course ); ?></option>
						<?php endforeach; ?>
					</select>
					<span class="axi-err" data-err="course"></span>
				</div>
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-year">Graduation Year</label>
					<select id="<?php echo esc_attr( $axi_form_id ); ?>-year" name="grad_year">
						<option value="">Select year</option>
						<?php foreach ( axi_int_grad_years() as $axi_year ) : ?>
							<option value="<?php echo esc_attr( $axi_year ); ?>"><?php echo esc_html( $axi_year ); ?></option>
						<?php endforeach; ?>
					</select>
					<span class="axi-err" data-err="grad_year"></span>
				</div>
			</div>

			<div class="axi-field-row">
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-track">Preferred Track</label>
					<select id="<?php echo esc_attr( $axi_form_id ); ?>-track" name="track">
						<option value="">Select a track</option>
						<?php foreach ( axi_int_tracks() as $axi_track ) : ?>
							<option value="<?php echo esc_attr( $axi_track ); ?>"><?php echo esc_html( $axi_track ); ?></option>
						<?php endforeach; ?>
					</select>
					<span class="axi-err" data-err="track"></span>
				</div>
				<div class="axi-field">
					<label for="<?php echo esc_attr( $axi_form_id ); ?>-city">City</label>
					<input type="text" id="<?php echo esc_attr( $axi_form_id ); ?>-city" name="city" placeholder="Your city"
						autocomplete="address-level2">
					<span class="axi-err" data-err="city"></span>
				</div>
			</div>

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-resume">Resume <span class="axi-req">*</span></label>
				<label class="axi-file" for="<?php echo esc_attr( $axi_form_id ); ?>-resume">
					<span class="axi-file-ico"><svg class="icon" aria-hidden="true"><use href="#i-upload"/></svg></span>
					<span class="axi-file-text">
						<strong class="axi-file-name">Upload resume</strong>
						<span class="axi-file-hint">PDF or Word document, up to 5 MB</span>
					</span>
					<span class="axi-file-btn">Choose file</span>
					<input type="file" id="<?php echo esc_attr( $axi_form_id ); ?>-resume" name="resume"
						accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>
				</label>
				<span class="axi-err" data-err="resume"></span>
			</div>

			<div class="axi-field">
				<label for="<?php echo esc_attr( $axi_form_id ); ?>-message">Why do you want to join? <span class="axi-opt">Optional</span></label>
				<textarea id="<?php echo esc_attr( $axi_form_id ); ?>-message" name="message" rows="4" maxlength="2000"
					placeholder="Tell us briefly what you have built or what you want to learn."></textarea>
				<span class="axi-err" data-err="message"></span>
			</div>

			<label class="axi-consent">
				<input type="checkbox" name="consent" value="1" required>
				<span>I agree that Axiora Labs may store and process these details for the purpose of this internship application, in line with the
					<a href="<?php echo esc_url( home_url( '/privacy-policy/' ) ); ?>" target="_blank" rel="noopener">Privacy Policy</a>.</span>
			</label>
			<span class="axi-err" data-err="consent"></span>

			<?php /* Spam guards: hidden from people, irresistible to bots. */ ?>
			<div class="axi-hp" aria-hidden="true">
				<label>Website<input type="text" name="axi_website" tabindex="-1" autocomplete="off"></label>
			</div>
			<input type="hidden" name="axi_t" value="<?php echo esc_attr( time() ); ?>">

			<button type="submit" class="btn btn-primary axi-submit">
				<span class="axi-submit-label">Save Application</span>
				<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
			</button>

			<p class="axi-form-foot">Your details are stored securely and used only for this application.</p>

			<div class="axi-form-error" role="alert" hidden></div>
		</form>

		<div class="axi-success" hidden>
			<div class="axi-success-ico"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></div>
			<h3>Application saved</h3>
			<p class="axi-success-msg">Thanks — we have received your application and emailed you a confirmation.</p>
			<div class="axi-ref-box">
				<span class="axi-ref-label">Your reference number</span>
				<strong class="axi-ref-code"></strong>
			</div>
			<p class="axi-success-note">Keep this reference handy. Our team reviews every application and will contact you if your profile matches.</p>
		</div>

	</div>
</div>
