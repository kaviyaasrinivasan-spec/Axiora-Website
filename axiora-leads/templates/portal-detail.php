<?php
/**
 * Single lead: everything submitted, plus status control, internal notes
 * and the full activity trail. Expects $lead and $history.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! $lead ) {
	$axi_title    = 'Lead not found';
	$axi_subtitle = 'It may have been deleted';
	$axi_nav      = 'leads';
	include AXI_LEADS_DIR . 'templates/portal-header.php';
	?>
	<div class="axi-card">
		<div class="axi-empty">
			<svg class="ico" aria-hidden="true"><use href="#p-alert"/></svg>
			<h3>We couldn't find that lead</h3>
			<p><a href="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">Back to all leads</a></p>
		</div>
	</div>
	<?php
	include AXI_LEADS_DIR . 'templates/portal-footer.php';
	return;
}

$axi_statuses = axi_leads_statuses();
$axi_reviewer = $lead->reviewed_by ? get_userdata( $lead->reviewed_by ) : null;
$axi_dupes    = Axiora_Leads_DB::count_by_email( $lead->email );

$axi_title    = $lead->full_name;
$axi_subtitle = $lead->ref_code . ' · submitted ' . axi_leads_date( $lead->created_at );
$axi_nav      = 'leads';
$axi_actions  = '<a class="axi-btn axi-btn-ghost" href="' . esc_url( axi_leads_portal_url( 'leads' ) ) . '">'
	. '<svg class="ico" aria-hidden="true"><use href="#p-left"/></svg> Back to list</a>';

include AXI_LEADS_DIR . 'templates/portal-header.php';
?>

<section class="axi-profile">
	<span class="axi-avatar axi-avatar-lg" style="--a:<?php echo esc_attr( axi_leads_avatar_hue( $lead->full_name ) ); ?>">
		<?php echo esc_html( axi_leads_initials( $lead->full_name ) ); ?>
	</span>
	<div class="axi-profile-meta">
		<h2><?php echo esc_html( $lead->full_name ); ?></h2>
		<div class="axi-profile-tags">
			<?php axi_leads_status_badge( $lead->status ); ?>
			<span class="axi-chip"><?php echo esc_html( $lead->ref_code ); ?></span>
			<?php if ( $lead->company ) : ?>
				<span class="axi-chip"><svg class="ico" aria-hidden="true"><use href="#p-building"/></svg><?php echo esc_html( $lead->company ); ?></span>
			<?php endif; ?>
			<?php if ( $axi_dupes > 1 ) : ?>
				<span class="axi-chip axi-chip-warn">
					<svg class="ico" aria-hidden="true"><use href="#p-alert"/></svg>
					<?php echo esc_html( sprintf( '%d leads from this email', $axi_dupes ) ); ?>
				</span>
			<?php endif; ?>
		</div>
		<div class="axi-profile-contact">
			<a href="mailto:<?php echo esc_attr( $lead->email ); ?>">
				<svg class="ico" aria-hidden="true"><use href="#p-mail"/></svg><?php echo esc_html( $lead->email ); ?>
			</a>
			<?php if ( $lead->phone ) : ?>
				<a href="tel:+91<?php echo esc_attr( preg_replace( '/[^0-9]/', '', $lead->phone ) ); ?>">
					<svg class="ico" aria-hidden="true"><use href="#p-phone"/></svg>+91 <?php echo esc_html( $lead->phone ); ?>
				</a>
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
					<div><dt>Full name</dt><dd><?php echo esc_html( $lead->full_name ); ?></dd></div>
					<div><dt>Email address</dt><dd><?php echo esc_html( $lead->email ); ?></dd></div>
					<div><dt>Phone number</dt><dd><?php echo esc_html( $lead->phone ? '+91 ' . $lead->phone : '—' ); ?></dd></div>
					<div><dt>Company</dt><dd><?php echo esc_html( axi_leads_display_or_dash( $lead->company ) ); ?></dd></div>
					<div><dt>Number of employees</dt><dd><?php echo esc_html( axi_leads_display_or_dash( $lead->employee_count ) ); ?></dd></div>
					<div><dt>Implementation timeline</dt><dd><?php echo esc_html( axi_leads_display_or_dash( $lead->timeline ) ); ?></dd></div>
					<div><dt>Biggest repetitive process</dt><dd><?php echo esc_html( axi_leads_display_or_dash( $lead->process ) ); ?></dd></div>
					<div><dt>Submitted on</dt><dd><?php echo esc_html( axi_leads_date( $lead->created_at ) ); ?></dd></div>
					<div><dt>Last updated</dt><dd><?php echo esc_html( axi_leads_date( $lead->updated_at ) ); ?></dd></div>
					<?php if ( $axi_reviewer ) : ?>
						<div><dt>Last actioned by</dt><dd><?php echo esc_html( $axi_reviewer->display_name ); ?></dd></div>
					<?php endif; ?>
				</dl>
			</div>
		</article>

		<?php if ( trim( (string) $lead->notes ) ) : ?>
			<article class="axi-card">
				<header class="axi-card-head"><div><h2>Automation needs</h2></div></header>
				<div class="axi-card-body">
					<blockquote class="axi-quote"><?php echo nl2br( esc_html( $lead->notes ) ); ?></blockquote>
				</div>
			</article>
		<?php endif; ?>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Activity</h2><p>Every change made to this lead</p></div></header>
			<div class="axi-card-body">
				<?php if ( empty( $history ) ) : ?>
					<p class="axi-chart-empty">Nothing recorded yet.</p>
				<?php else : ?>
					<ol class="axi-timeline">
						<?php foreach ( array_reverse( $history ) as $axi_entry ) : ?>
							<?php
							$axi_who   = $axi_entry->user_id ? get_userdata( $axi_entry->user_id ) : null;
							$axi_actor = $axi_who ? $axi_who->display_name : 'System';
							$axi_dot   = $axi_entry->to_status ? axi_leads_status_color( $axi_entry->to_status ) : '#8a91a8';
							?>
							<li>
								<span class="axi-tl-dot" style="--s:<?php echo esc_attr( $axi_dot ); ?>"></span>
								<div class="axi-tl-body">
									<p class="axi-tl-title">
										<?php if ( 'created' === $axi_entry->action ) : ?>
											Lead captured from the website contact form
										<?php elseif ( 'status' === $axi_entry->action ) : ?>
											Status changed from
											<strong><?php echo esc_html( axi_leads_status_label( $axi_entry->from_status ) ); ?></strong>
											to <strong><?php echo esc_html( axi_leads_status_label( $axi_entry->to_status ) ); ?></strong>
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
										<span title="<?php echo esc_attr( axi_leads_date( $axi_entry->created_at ) ); ?>">
											<?php echo esc_html( axi_leads_ago( $axi_entry->created_at ) ); ?>
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
			<header class="axi-card-head"><div><h2>Status</h2><p>Move this lead along the pipeline</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_leads_portal_url( 'lead/' . (int) $lead->id ) ); ?>">
					<?php wp_nonce_field( 'axi_leads_action_set_status' ); ?>
					<input type="hidden" name="axi_action" value="set_status">
					<input type="hidden" name="lead_id" value="<?php echo esc_attr( $lead->id ); ?>">

					<div class="axi-status-picker">
						<?php foreach ( $axi_statuses as $axi_key => $axi_meta ) : ?>
							<label class="axi-status-opt<?php echo ( $lead->status === $axi_key ) ? ' is-current' : ''; ?>"
								style="--s:<?php echo esc_attr( $axi_meta['color'] ); ?>;--t:<?php echo esc_attr( $axi_meta['tint'] ); ?>">
								<input type="radio" name="status" value="<?php echo esc_attr( $axi_key ); ?>"
									<?php checked( $lead->status, $axi_key ); ?>>
								<i class="axi-dot"></i>
								<span><?php echo esc_html( $axi_meta['label'] ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>

					<div class="axi-field">
						<label for="axi-note">Add a note <span class="axi-opt">Optional</span></label>
						<textarea id="axi-note" name="note" rows="3"
							placeholder="e.g. Called, scheduled a demo for Friday."></textarea>
					</div>

					<button type="submit" class="axi-btn axi-btn-primary axi-btn-block">Save status</button>
				</form>
			</div>
		</article>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Internal notes</h2><p>Only visible to portal users</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_leads_portal_url( 'lead/' . (int) $lead->id ) ); ?>">
					<?php wp_nonce_field( 'axi_leads_action_save_notes' ); ?>
					<input type="hidden" name="axi_action" value="save_notes">
					<input type="hidden" name="lead_id" value="<?php echo esc_attr( $lead->id ); ?>">

					<div class="axi-field">
						<label class="axi-sr" for="axi-notes">Internal notes</label>
						<textarea id="axi-notes" name="admin_notes" rows="6"
							placeholder="Call notes, next steps, follow-ups…"><?php echo esc_textarea( $lead->admin_notes ); ?></textarea>
					</div>

					<button type="submit" class="axi-btn axi-btn-ghost axi-btn-block">Save notes</button>
				</form>
			</div>
		</article>

		<article class="axi-card">
			<header class="axi-card-head"><div><h2>Submission source</h2></div></header>
			<div class="axi-card-body">
				<dl class="axi-dl axi-dl-tight">
					<div><dt>Page</dt><dd class="axi-break"><?php echo esc_html( axi_leads_display_or_dash( $lead->source_url ) ); ?></dd></div>
					<div><dt>IP address</dt><dd><?php echo esc_html( axi_leads_display_or_dash( $lead->ip ) ); ?></dd></div>
					<div><dt>Device</dt><dd class="axi-break axi-muted"><?php echo esc_html( axi_leads_display_or_dash( $lead->user_agent ) ); ?></dd></div>
				</dl>
			</div>
		</article>

		<article class="axi-card axi-card-danger">
			<header class="axi-card-head"><div><h2>Delete lead</h2><p>Removes the record and its history</p></div></header>
			<div class="axi-card-body">
				<form method="post" action="<?php echo esc_url( axi_leads_portal_url( 'lead/' . (int) $lead->id ) ); ?>"
					data-axi-confirm="Delete this lead permanently?">
					<?php wp_nonce_field( 'axi_leads_action_delete_lead' ); ?>
					<input type="hidden" name="axi_action" value="delete_lead">
					<input type="hidden" name="lead_id" value="<?php echo esc_attr( $lead->id ); ?>">
					<button type="submit" class="axi-btn axi-btn-danger axi-btn-block">
						<svg class="ico" aria-hidden="true"><use href="#p-trash"/></svg> Delete permanently
					</button>
				</form>
			</div>
		</article>

	</div>

</section>

<?php include AXI_LEADS_DIR . 'templates/portal-footer.php'; ?>
