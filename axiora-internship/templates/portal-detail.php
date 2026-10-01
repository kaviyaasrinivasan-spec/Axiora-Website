<?php
/**
 * Single application: everything submitted, plus status control, internal notes
 * and the full activity trail. Expects $app and $history.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! $app ) {
	$axi_title    = 'Application not found';
	$axi_subtitle = 'It may have been deleted';
	$axi_nav      = 'applications';
	include AXI_INT_DIR . 'templates/portal-header.php';
	?>
	<div class="axi-card">
		<div class="axi-empty">
			<svg class="ico" aria-hidden="true"><use href="#p-alert"/></svg>
			<h3>We couldn't find that application</h3>
			<p><a href="<?php echo esc_url( axi_int_portal_url( 'applications' ) ); ?>">Back to all applications</a></p>
		</div>
	</div>
	<?php
	include AXI_INT_DIR . 'templates/portal-footer.php';
	return;
}

$axi_statuses  = axi_int_statuses();
$axi_reviewer  = $app->reviewed_by ? get_userdata( $app->reviewed_by ) : null;
$axi_dupes     = Axiora_Internship_DB::count_by_email( $app->email );

$axi_title    = $app->full_name;
$axi_subtitle = $app->ref_code . ' · submitted ' . axi_int_date( $app->created_at );
$axi_nav      = 'applications';
$axi_actions  = '<a class="axi-btn axi-btn-ghost" href="' . esc_url( axi_int_portal_url( 'applications' ) ) . '">'
	. '<svg class="ico" aria-hidden="true"><use href="#p-left"/></svg> Back to list</a>';

if ( $app->resume_file ) {
	$axi_actions .= '<a class="axi-btn axi-btn-primary" href="' . esc_url( Axiora_Internship_Portal::resume_url( $app ) ) . '">'
		. '<svg class="ico" aria-hidden="true"><use href="#p-download"/></svg> Download resume</a>';
}

include AXI_INT_DIR . 'templates/portal-header.php';
?>

<section class="axi-profile">
	<span class="axi-avatar axi-avatar-lg" style="--a:<?php echo esc_attr( axi_int_avatar_hue( $app->full_name ) ); ?>">
		<?php echo esc_html( axi_int_initials( $app->full_name ) ); ?>
	</span>
	<div class="axi-profile-meta">
		<h2><?php echo esc_html( $app->full_name ); ?></h2>
		<div class="axi-profile-tags">
			<?php axi_int_status_badge( $app->status ); ?>
			<span class="axi-chip"><?php echo esc_html( $app->ref_code ); ?></span>
			<?php if ( $app->track ) : ?>
				<span class="axi-chip"><?php echo esc_html( $app->track ); ?></span>
			<?php endif; ?>
			<?php if ( $axi_dupes > 1 ) : ?>
				<span class="axi-chip axi-chip-warn">
					<svg class="ico" aria-hidden="true"><use href="#p-alert"/></svg>
					<?php echo esc_html( sprintf( '%d applications from this email', $axi_dupes ) ); ?>
				</span>
			<?php endif; ?>
		</div>
		<div class="axi-profile-contact">
			<a href="mailto:<?php echo esc_attr( $app->email ); ?>">
				<svg class="ico" aria-hidden="true"><use href="#p-mail"/></svg><?php echo esc_html( $app->email ); ?>
			</a>
			<?php if ( $app->phone ) : ?>
				<a href="tel:<?php echo esc_attr( preg_replace( '/[^0-9+]/', '', $app->phone ) ); ?>">
					<svg class="ico" aria-hidden="true"><use href="#p-phone"/></svg><?php echo esc_html( $app->phone ); ?>
				</a>
			<?php endif; ?>
			<?php if ( $app->city ) : ?>
				<span><svg class="ico" aria-hidden="true"><use href="#p-pin"/></svg><?php echo esc_html( $app->city ); ?></span>
			<?php endif; ?>
		</div>
	</div>
</section>

<section class="axi-grid-detail">

	<div class="axi-col">

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Submitted details</h2></div></header>
			<div class="axi-card-body">
				<dl class="axi-dl">
					<div><dt>Full name</dt><dd><?php echo esc_html( $app->full_name ); ?></dd></div>
					<div><dt>Email address</dt><dd><?php echo esc_html( $app->email ); ?></dd></div>
					<div><dt>Phone number</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->phone ) ); ?></dd></div>
					<div><dt>College / University</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->college ) ); ?></dd></div>
					<div><dt>Course</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->course ) ); ?></dd></div>
					<div><dt>Graduation year</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->grad_year ) ); ?></dd></div>
					<div><dt>Preferred track</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->track ) ); ?></dd></div>
					<div><dt>City</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->city ) ); ?></dd></div>
					<div><dt>Submitted</dt><dd><?php echo esc_html( axi_int_date( $app->created_at ) ); ?></dd></div>
					<div><dt>Last updated</dt><dd><?php echo esc_html( axi_int_date( $app->updated_at ) ); ?></dd></div>
					<?php if ( $axi_reviewer ) : ?>
						<div><dt>Last actioned by</dt><dd><?php echo esc_html( $axi_reviewer->display_name ); ?></dd></div>
					<?php endif; ?>
				</dl>
			</div>
		</article>

		<?php if ( trim( (string) $app->message ) ) : ?>
			<article class="axi-card">
				<header class="axi-card-head"><div><h2>Why they want to join</h2></div></header>
				<div class="axi-card-body">
					<blockquote class="axi-quote"><?php echo nl2br( esc_html( $app->message ) ); ?></blockquote>
				</div>
			</article>
		<?php endif; ?>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Resume</h2></div></header>
			<div class="axi-card-body">
				<?php if ( $app->resume_file ) : ?>
					<a class="axi-resume" href="<?php echo esc_url( Axiora_Internship_Portal::resume_url( $app ) ); ?>">
						<span class="axi-resume-ico"><svg class="ico" aria-hidden="true"><use href="#p-file"/></svg></span>
						<span class="axi-resume-meta">
							<strong><?php echo esc_html( $app->resume_name ); ?></strong>
							<small><?php
								$axi_size = $app->resume_size ? size_format( (int) $app->resume_size, 1 ) : '';
								echo esc_html( $axi_size ? $axi_size . ' · click to download' : 'Click to download' );
							?></small>
						</span>
						<svg class="ico axi-resume-go" aria-hidden="true"><use href="#p-download"/></svg>
					</a>
					<p class="axi-hint">Resumes are stored outside the public media library and can only be downloaded by signed-in portal users.</p>
				<?php else : ?>
					<p class="axi-chart-empty">No resume was attached to this application.</p>
				<?php endif; ?>
			</div>
		</article>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Activity</h2><p>Every change made to this application</p></div></header>
			<div class="axi-card-body">
				<?php if ( empty( $history ) ) : ?>
					<p class="axi-chart-empty">Nothing recorded yet.</p>
				<?php else : ?>
					<ol class="axi-timeline">
						<?php foreach ( array_reverse( $history ) as $axi_entry ) : ?>
							<?php
							$axi_who   = $axi_entry->user_id ? get_userdata( $axi_entry->user_id ) : null;
							$axi_actor = $axi_who ? $axi_who->display_name : 'Applicant';
							$axi_dot   = $axi_entry->to_status ? axi_int_status_color( $axi_entry->to_status ) : '#8a91a8';
							?>
							<li>
								<span class="axi-tl-dot" style="--s:<?php echo esc_attr( $axi_dot ); ?>"></span>
								<div class="axi-tl-body">
									<p class="axi-tl-title">
										<?php if ( 'created' === $axi_entry->action ) : ?>
											Application submitted from the website
										<?php elseif ( 'status' === $axi_entry->action ) : ?>
											Status changed from
											<strong><?php echo esc_html( axi_int_status_label( $axi_entry->from_status ) ); ?></strong>
											to <strong><?php echo esc_html( axi_int_status_label( $axi_entry->to_status ) ); ?></strong>
										<?php elseif ( 'note' === $axi_entry->action ) : ?>
											Internal notes updated
										<?php else : ?>
											<?php echo esc_html( ucfirst( $axi_entry->action ) ); ?>
										<?php endif; ?>
									</p>
									<?php if ( trim( (string) $axi_entry->note ) && 'note' !== $axi_entry->action ) : ?>
										<p class="axi-tl-note"><?php echo nl2br( esc_html( $axi_entry->note ) ); ?></p>
									<?php endif; ?>
									<p class="axi-tl-meta">
										<?php echo esc_html( $axi_actor ); ?> ·
										<span title="<?php echo esc_attr( axi_int_date( $axi_entry->created_at ) ); ?>">
											<?php echo esc_html( axi_int_ago( $axi_entry->created_at ) ); ?>
										</span>
									</p>
								</div>
							</li>
						<?php endforeach; ?>
					</ol>
				<?php endif; ?>
			</div>
		</article>

	</div>

	<div class="axi-col axi-col-side">

		<article class="axi-card axi-card-status">
			<header class="axi-card-head"><div><h2>Status</h2><p>Move this application along the pipeline</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_int_portal_url( 'application/' . (int) $app->id ) ); ?>">
					<?php wp_nonce_field( 'axi_int_action_set_status' ); ?>
					<input type="hidden" name="axi_action" value="set_status">
					<input type="hidden" name="app_id" value="<?php echo esc_attr( $app->id ); ?>">

					<div class="axi-status-picker">
						<?php foreach ( $axi_statuses as $axi_key => $axi_meta ) : ?>
							<label class="axi-status-opt<?php echo ( $app->status === $axi_key ) ? ' is-current' : ''; ?>"
								style="--s:<?php echo esc_attr( $axi_meta['color'] ); ?>;--t:<?php echo esc_attr( $axi_meta['tint'] ); ?>">
								<input type="radio" name="status" value="<?php echo esc_attr( $axi_key ); ?>"
									<?php checked( $app->status, $axi_key ); ?>>
								<i class="axi-dot"></i>
								<span><?php echo esc_html( $axi_meta['label'] ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>

					<div class="axi-field">
						<label for="axi-note">Add a note <span class="axi-opt">Optional</span></label>
						<textarea id="axi-note" name="note" rows="3"
							placeholder="e.g. Strong Python background, scheduled a call for Friday."></textarea>
					</div>

					<label class="axi-check">
						<input type="checkbox" name="notify_applicant" value="1">
						<span>Email the applicant about this update<small>Sends the new status and your note above.</small></span>
					</label>

					<button type="submit" class="axi-btn axi-btn-primary axi-btn-block">Save status</button>
				</form>
			</div>
		</article>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Internal notes</h2><p>Only visible to portal users</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_int_portal_url( 'application/' . (int) $app->id ) ); ?>">
					<?php wp_nonce_field( 'axi_int_action_save_notes' ); ?>
					<input type="hidden" name="axi_action" value="save_notes">
					<input type="hidden" name="app_id" value="<?php echo esc_attr( $app->id ); ?>">

					<div class="axi-field">
						<label class="axi-sr" for="axi-notes">Internal notes</label>
						<textarea id="axi-notes" name="admin_notes" rows="6"
							placeholder="Interview feedback, availability, follow-ups…"><?php echo esc_textarea( $app->admin_notes ); ?></textarea>
					</div>

					<button type="submit" class="axi-btn axi-btn-ghost axi-btn-block">Save notes</button>
				</form>
			</div>
		</article>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Submission source</h2></div></header>
			<div class="axi-card-body">
				<dl class="axi-dl axi-dl-tight">
					<div><dt>Page</dt><dd class="axi-break"><?php echo esc_html( axi_int_display_or_dash( $app->source_url ) ); ?></dd></div>
					<div><dt>IP address</dt><dd><?php echo esc_html( axi_int_display_or_dash( $app->ip ) ); ?></dd></div>
					<div><dt>Device</dt><dd class="axi-break axi-muted"><?php echo esc_html( axi_int_display_or_dash( $app->user_agent ) ); ?></dd></div>
				</dl>
			</div>
		</article>

		<article class="axi-card axi-card-danger">
			<header class="axi-card-head"><div><h2>Delete application</h2><p>Removes the record, its history and the resume file</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_int_portal_url( 'application/' . (int) $app->id ) ); ?>"
					data-axi-confirm="Delete this application permanently? The resume file will be removed too.">
					<?php wp_nonce_field( 'axi_int_action_delete_app' ); ?>
					<input type="hidden" name="axi_action" value="delete_app">
					<input type="hidden" name="app_id" value="<?php echo esc_attr( $app->id ); ?>">
					<button type="submit" class="axi-btn axi-btn-danger axi-btn-block">
						<svg class="ico" aria-hidden="true"><use href="#p-trash"/></svg> Delete permanently
					</button>
				</form>
			</div>
		</article>

	</div>

</section>

<?php include AXI_INT_DIR . 'templates/portal-footer.php'; ?>
