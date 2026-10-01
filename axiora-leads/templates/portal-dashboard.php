<?php
/**
 * Dashboard. Expects $counts, $total, $trend, $today, $week, $prev, $processes,
 * $recent from Axiora_Leads_Portal::render_dashboard().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Statuses are filterable, so never assume a key is present. */
$axi_count = static function ( $key ) use ( $counts ) {
	return isset( $counts[ $key ] ) ? (int) $counts[ $key ] : 0;
};

$axi_in_progress = $axi_count( 'contacted' ) + $axi_count( 'meeting_scheduled' );

// Week-on-week change. With no prior week there is nothing to compare against.
$axi_delta_pct = null;
if ( $prev > 0 ) {
	$axi_delta_pct = ( ( $week - $prev ) / $prev ) * 100;
}

$axi_title    = 'Dashboard';
$axi_subtitle = 'Client leads at a glance';
$axi_nav      = 'dashboard';
$axi_actions  = '<a class="axi-btn axi-btn-ghost" href="' . esc_url( Axiora_Leads_Portal::export_url() ) . '">'
	. '<svg class="ico" aria-hidden="true"><use href="#p-download"/></svg> Export CSV</a>'
	. '<a class="axi-btn axi-btn-primary" href="' . esc_url( axi_leads_portal_url( 'leads' ) ) . '">'
	. 'View all leads</a>';

include AXI_LEADS_DIR . 'templates/portal-header.php';
?>

<section class="axi-kpis" aria-label="Key numbers">

	<div class="axi-kpi">
		<span class="axi-kpi-label">Total leads</span>
		<strong class="axi-kpi-value"><?php echo esc_html( number_format_i18n( $total ) ); ?></strong>
		<span class="axi-kpi-sub">All time</span>
	</div>

	<div class="axi-kpi">
		<span class="axi-kpi-label">Last 7 days</span>
		<strong class="axi-kpi-value"><?php echo esc_html( number_format_i18n( $week ) ); ?></strong>
		<span class="axi-kpi-sub">
			<?php if ( null === $axi_delta_pct ) : ?>
				<?php echo esc_html( $week ? 'First leads this week' : 'None this week' ); ?>
			<?php elseif ( $axi_delta_pct >= 0 ) : ?>
				<span class="axi-delta axi-delta-up">&#9650; <?php echo esc_html( number_format_i18n( abs( $axi_delta_pct ), 0 ) ); ?>%</span> vs previous week
			<?php else : ?>
				<span class="axi-delta axi-delta-down">&#9660; <?php echo esc_html( number_format_i18n( abs( $axi_delta_pct ), 0 ) ); ?>%</span> vs previous week
			<?php endif; ?>
		</span>
	</div>

	<div class="axi-kpi">
		<span class="axi-kpi-label">Awaiting contact</span>
		<strong class="axi-kpi-value"><?php echo esc_html( number_format_i18n( $axi_count( 'new' ) ) ); ?></strong>
		<span class="axi-kpi-sub">
			<a href="<?php echo esc_url( axi_leads_portal_url( 'leads', array( 'status' => 'new' ) ) ); ?>">New leads not yet contacted</a>
		</span>
	</div>

	<div class="axi-kpi">
		<span class="axi-kpi-label">In progress</span>
		<strong class="axi-kpi-value"><?php echo esc_html( number_format_i18n( $axi_in_progress ) ); ?></strong>
		<span class="axi-kpi-sub">Contacted or meeting scheduled</span>
	</div>

	<div class="axi-kpi axi-kpi-accent">
		<span class="axi-kpi-label">Completed</span>
		<strong class="axi-kpi-value"><?php echo esc_html( number_format_i18n( $axi_count( 'completed' ) ) ); ?></strong>
		<span class="axi-kpi-sub"><?php echo esc_html( number_format_i18n( $today ) ); ?> received today</span>
	</div>

</section>

<section class="axi-grid-2">

	<article class="axi-card">
		<header class="axi-card-head">
			<div>
				<h2>Leads received</h2>
				<p>Daily total over the last 14 days</p>
			</div>
			<span class="axi-chip"><?php echo esc_html( number_format_i18n( array_sum( wp_list_pluck( $trend, 'count' ) ) ) ); ?> in period</span>
		</header>
		<div class="axi-card-body">
			<?php axi_leads_render_trend_chart( $trend ); ?>
		</div>
	</article>

	<article class="axi-card">
		<header class="axi-card-head">
			<div>
				<h2>Pipeline</h2>
				<p>Where every lead currently sits</p>
			</div>
		</header>
		<div class="axi-card-body">
			<?php axi_leads_render_pipeline( $counts, $total ); ?>
		</div>
	</article>

</section>

<section class="axi-grid-2 axi-grid-wide">

	<article class="axi-card">
		<header class="axi-card-head">
			<div>
				<h2>Latest leads</h2>
				<p>The eight most recent submissions</p>
			</div>
			<a class="axi-link" href="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">
				See all <svg class="ico" aria-hidden="true"><use href="#p-right"/></svg>
			</a>
		</header>

		<?php if ( empty( $recent['rows'] ) ) : ?>
			<div class="axi-empty">
				<svg class="ico" aria-hidden="true"><use href="#p-inbox"/></svg>
				<h3>No leads yet</h3>
				<p>Submissions from <a href="<?php echo esc_url( axi_leads_contact_page_url() ); ?>" target="_blank" rel="noopener">the contact page</a> will appear here.</p>
			</div>
		<?php else : ?>
			<div class="axi-table-wrap">
				<table class="axi-table">
					<thead>
						<tr>
							<th>Client</th>
							<th>Company</th>
							<th>Process</th>
							<th>Status</th>
							<th>Submitted</th>
							<th><span class="axi-sr">Open</span></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $recent['rows'] as $axi_row ) : ?>
							<tr onclick="window.location='<?php echo esc_url( axi_leads_portal_url( 'lead/' . (int) $axi_row->id ) ); ?>'">
								<td>
									<span class="axi-person">
										<span class="axi-avatar" style="--a:<?php echo esc_attr( axi_leads_avatar_hue( $axi_row->full_name ) ); ?>"><?php echo esc_html( axi_leads_initials( $axi_row->full_name ) ); ?></span>
										<span class="axi-person-meta">
											<strong><?php echo esc_html( $axi_row->full_name ); ?></strong>
											<small><?php echo esc_html( $axi_row->email ); ?></small>
										</span>
									</span>
								</td>
								<td><?php echo esc_html( axi_leads_display_or_dash( $axi_row->company ) ); ?></td>
								<td class="axi-muted"><?php echo esc_html( axi_leads_display_or_dash( $axi_row->process ) ); ?></td>
								<td><?php axi_leads_status_badge( $axi_row->status ); ?></td>
								<td class="axi-muted" title="<?php echo esc_attr( axi_leads_date( $axi_row->created_at ) ); ?>">
									<?php echo esc_html( axi_leads_ago( $axi_row->created_at ) ); ?>
								</td>
								<td class="axi-row-go">
									<a href="<?php echo esc_url( axi_leads_portal_url( 'lead/' . (int) $axi_row->id ) ); ?>"
										aria-label="<?php echo esc_attr( sprintf( 'Open lead from %s', $axi_row->full_name ) ); ?>">
										<svg class="ico" aria-hidden="true"><use href="#p-right"/></svg>
									</a>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		<?php endif; ?>
	</article>

	<article class="axi-card">
		<header class="axi-card-head">
			<div>
				<h2>Top Automation Needs</h2>
				<p>What prospects most want automated</p>
			</div>
		</header>
		<div class="axi-card-body">
			<?php if ( empty( $processes ) ) : ?>
				<p class="axi-chart-empty">No data yet.</p>
			<?php else : ?>
				<ul class="axi-rank">
					<?php foreach ( $processes as $axi_i => $axi_process ) : ?>
						<li>
							<span class="axi-rank-n"><?php echo esc_html( $axi_i + 1 ); ?></span>
							<span class="axi-rank-name"><?php echo esc_html( $axi_process->process ); ?></span>
							<span class="axi-rank-val"><?php echo esc_html( number_format_i18n( $axi_process->c ) ); ?></span>
						</li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>
		</div>
	</article>

</section>

<?php include AXI_LEADS_DIR . 'templates/portal-footer.php'; ?>
