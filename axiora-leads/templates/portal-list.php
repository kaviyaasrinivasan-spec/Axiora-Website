<?php
/**
 * All leads: search, filter, sort, bulk status change, pagination.
 * Expects $args and $data from Axiora_Leads_Portal::render_list().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axi_statuses  = axi_leads_statuses();
$axi_processes = Axiora_Leads_DB::distinct_processes();
$axi_filtered  = ( '' !== $args['search'] || '' !== $args['status'] || '' !== $args['process'] || '' !== $args['from'] || '' !== $args['to'] );

$axi_title = ( '' !== $args['status'] && isset( $axi_statuses[ $args['status'] ] ) )
	? $axi_statuses[ $args['status'] ]['label']
	: 'All Leads';

$axi_subtitle = sprintf(
	/* translators: %s: formatted number of leads. */
	_n( '%s lead', '%s leads', $data['total'], 'axiora-leads' ),
	number_format_i18n( $data['total'] )
) . ( $axi_filtered ? ' matching your filters' : '' );

$axi_nav     = 'leads';
$axi_actions = '<a class="axi-btn axi-btn-ghost" href="' . esc_url( Axiora_Leads_Portal::export_url( $args ) ) . '">'
	. '<svg class="ico" aria-hidden="true"><use href="#p-download"/></svg> Export CSV</a>';

/** Build a sortable column header link. */
if ( ! function_exists( 'axi_leads_sort_link' ) ) :
function axi_leads_sort_link( $column, $label, $args ) {
	$is_current = ( $args['orderby'] === $column );
	$next_order = ( $is_current && 'desc' === strtolower( $args['order'] ) ) ? 'asc' : 'desc';

	$url = add_query_arg(
		array(
			'orderby' => $column,
			'order'   => $next_order,
			's'       => $args['search'],
			'status'  => $args['status'],
			'process' => $args['process'],
			'from'    => $args['from'],
			'to'      => $args['to'],
		),
		axi_leads_portal_url( 'leads' )
	);

	printf(
		'<a class="axi-sort%1$s" href="%2$s">%3$s<svg class="ico" aria-hidden="true"><use href="#p-chev"/></svg></a>',
		$is_current ? ( ' is-active is-' . esc_attr( strtolower( $args['order'] ) ) ) : '',
		esc_url( $url ),
		esc_html( $label )
	);
}
endif;

include AXI_LEADS_DIR . 'templates/portal-header.php';
?>

<form class="axi-filters" method="get" action="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">
	<div class="axi-filter axi-filter-search">
		<svg class="ico" aria-hidden="true"><use href="#p-search"/></svg>
		<input type="search" name="s" value="<?php echo esc_attr( $args['search'] ); ?>"
			placeholder="Search name, email, phone, company or reference…">
	</div>

	<div class="axi-filter">
		<select name="status" aria-label="Filter by status">
			<option value="">All statuses</option>
			<?php foreach ( $axi_statuses as $axi_key => $axi_meta ) : ?>
				<option value="<?php echo esc_attr( $axi_key ); ?>" <?php selected( $args['status'], $axi_key ); ?>>
					<?php echo esc_html( $axi_meta['label'] ); ?>
				</option>
			<?php endforeach; ?>
		</select>
	</div>

	<div class="axi-filter">
		<select name="process" aria-label="Filter by biggest repetitive process">
			<option value="">All processes</option>
			<?php foreach ( $axi_processes as $axi_process ) : ?>
				<option value="<?php echo esc_attr( $axi_process ); ?>" <?php selected( $args['process'], $axi_process ); ?>>
					<?php echo esc_html( $axi_process ); ?>
				</option>
			<?php endforeach; ?>
		</select>
	</div>

	<div class="axi-filter axi-filter-dates">
		<label>From <input type="date" name="from" value="<?php echo esc_attr( $args['from'] ); ?>"></label>
		<label>To <input type="date" name="to" value="<?php echo esc_attr( $args['to'] ); ?>"></label>
	</div>

	<button type="submit" class="axi-btn axi-btn-primary">Apply</button>
	<?php if ( $axi_filtered ) : ?>
		<a class="axi-btn axi-btn-ghost" href="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">Reset</a>
	<?php endif; ?>
</form>

<?php if ( empty( $data['rows'] ) ) : ?>

	<div class="axi-card">
		<div class="axi-empty">
			<svg class="ico" aria-hidden="true"><use href="#p-search"/></svg>
			<h3><?php echo esc_html( $axi_filtered ? 'No matching leads' : 'No leads yet' ); ?></h3>
			<p>
				<?php if ( $axi_filtered ) : ?>
					Try widening your filters, or <a href="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>">clear them</a>.
				<?php else : ?>
					Submissions from <a href="<?php echo esc_url( axi_leads_contact_page_url() ); ?>" target="_blank" rel="noopener">the contact page</a> will appear here.
				<?php endif; ?>
			</p>
		</div>
	</div>

<?php else : ?>

	<form method="post" action="<?php echo esc_url( axi_leads_portal_url( 'leads' ) ); ?>" class="axi-card axi-list-form">
		<?php wp_nonce_field( 'axi_leads_action_bulk_status' ); ?>
		<input type="hidden" name="axi_action" value="bulk_status">

		<div class="axi-bulk" data-axi-bulk hidden>
			<span class="axi-bulk-count"><strong>0</strong> selected</span>
			<select name="status" aria-label="Set status for selected">
				<option value="">Move to…</option>
				<?php foreach ( $axi_statuses as $axi_key => $axi_meta ) : ?>
					<option value="<?php echo esc_attr( $axi_key ); ?>"><?php echo esc_html( $axi_meta['label'] ); ?></option>
				<?php endforeach; ?>
			</select>
			<button type="submit" class="axi-btn axi-btn-primary axi-btn-sm">Update</button>
			<button type="button" class="axi-btn axi-btn-ghost axi-btn-sm" data-axi-bulk-clear>Clear</button>
		</div>

		<div class="axi-table-wrap">
			<table class="axi-table axi-table-full">
				<thead>
					<tr>
						<th class="axi-col-check">
							<input type="checkbox" data-axi-check-all aria-label="Select all on this page">
						</th>
						<th><?php axi_leads_sort_link( 'full_name', 'Client', $args ); ?></th>
						<th>Contact</th>
						<th><?php axi_leads_sort_link( 'company', 'Company', $args ); ?></th>
						<th><?php axi_leads_sort_link( 'status', 'Status', $args ); ?></th>
						<th><?php axi_leads_sort_link( 'created_at', 'Submitted', $args ); ?></th>
						<th class="axi-col-go"><span class="axi-sr">Open</span></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $data['rows'] as $axi_row ) : ?>
						<tr>
							<td class="axi-col-check">
								<input type="checkbox" name="ids[]" value="<?php echo esc_attr( $axi_row->id ); ?>"
									data-axi-check aria-label="<?php echo esc_attr( sprintf( 'Select %s', $axi_row->full_name ) ); ?>">
							</td>
							<td>
								<span class="axi-person">
									<span class="axi-avatar" style="--a:<?php echo esc_attr( axi_leads_avatar_hue( $axi_row->full_name ) ); ?>"><?php echo esc_html( axi_leads_initials( $axi_row->full_name ) ); ?></span>
									<span class="axi-person-meta">
										<strong><?php echo esc_html( $axi_row->full_name ); ?></strong>
										<small><?php echo esc_html( $axi_row->ref_code ); ?></small>
									</span>
								</span>
							</td>
							<td>
								<a class="axi-inline-link" href="mailto:<?php echo esc_attr( $axi_row->email ); ?>"><?php echo esc_html( $axi_row->email ); ?></a>
								<small class="axi-muted axi-block"><?php echo esc_html( axi_leads_display_or_dash( $axi_row->phone ) ); ?></small>
							</td>
							<td>
								<?php echo esc_html( axi_leads_display_or_dash( $axi_row->company ) ); ?>
								<small class="axi-muted axi-block"><?php echo esc_html( axi_leads_display_or_dash( $axi_row->process ) ); ?></small>
							</td>
							<td><?php axi_leads_status_badge( $axi_row->status ); ?></td>
							<td class="axi-muted" title="<?php echo esc_attr( axi_leads_date( $axi_row->created_at ) ); ?>">
								<?php echo esc_html( axi_leads_date( $axi_row->created_at, 'j M Y' ) ); ?>
								<small class="axi-block"><?php echo esc_html( axi_leads_ago( $axi_row->created_at ) ); ?></small>
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
	</form>

	<?php if ( $data['pages'] > 1 ) : ?>
		<?php
		$axi_base = add_query_arg(
			array_filter(
				array(
					's'       => $args['search'],
					'status'  => $args['status'],
					'process' => $args['process'],
					'from'    => $args['from'],
					'to'      => $args['to'],
					'orderby' => $args['orderby'],
					'order'   => $args['order'],
				),
				static function ( $value ) {
					return '' !== (string) $value;
				}
			),
			axi_leads_portal_url( 'leads' )
		);
		?>
		<nav class="axi-pager" aria-label="Pagination">
			<?php if ( $data['page'] > 1 ) : ?>
				<a class="axi-page" href="<?php echo esc_url( add_query_arg( 'paged', $data['page'] - 1, $axi_base ) ); ?>">
					<svg class="ico" aria-hidden="true"><use href="#p-left"/></svg> Previous
				</a>
			<?php endif; ?>

			<span class="axi-page-info">
				Page <strong><?php echo esc_html( number_format_i18n( $data['page'] ) ); ?></strong>
				of <?php echo esc_html( number_format_i18n( $data['pages'] ) ); ?>
			</span>

			<?php if ( $data['page'] < $data['pages'] ) : ?>
				<a class="axi-page" href="<?php echo esc_url( add_query_arg( 'paged', $data['page'] + 1, $axi_base ) ); ?>">
					Next <svg class="ico" aria-hidden="true"><use href="#p-right"/></svg>
				</a>
			<?php endif; ?>
		</nav>
	<?php endif; ?>

<?php endif; ?>

<?php include AXI_LEADS_DIR . 'templates/portal-footer.php'; ?>
