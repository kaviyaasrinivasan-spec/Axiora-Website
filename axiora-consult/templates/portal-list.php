<?php
/**
 * All leads: search, filter, sort, bulk status change, pagination.
 * Expects $args and $data from Axiora_Consult_Portal::render_list().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$axi_statuses  = axc_statuses();
$axi_cities    = Axiora_Consult_DB::distinct_cities();
$axi_filtered  = ( '' !== $args['search'] || '' !== $args['status'] || '' !== $args['city'] || '' !== $args['source'] || '' !== $args['from'] || '' !== $args['to'] );

$axi_title = ( '' !== $args['status'] && isset( $axi_statuses[ $args['status'] ] ) )
	? $axi_statuses[ $args['status'] ]['label']
	: 'All Enquiries';

$axi_subtitle = sprintf(
	/* translators: %s: formatted number of leads. */
	_n( '%s enquiry', '%s enquiries', $data['total'], 'axiora-consult' ),
	number_format_i18n( $data['total'] )
) . ( $axi_filtered ? ' matching your filters' : '' );

$axi_nav     = 'leads';
$axi_actions = '<a class="axi-btn axi-btn-ghost" href="' . esc_url( Axiora_Consult_Portal::export_url( $args ) ) . '">'
	. '<svg class="ico" aria-hidden="true"><use href="#p-download"/></svg> Export CSV</a>';

/** Build a sortable column header link. */
if ( ! function_exists( 'axc_sort_link' ) ) :
function axc_sort_link( $column, $label, $args ) {
	$is_current = ( $args['orderby'] === $column );
	$next_order = ( $is_current && 'desc' === strtolower( $args['order'] ) ) ? 'asc' : 'desc';

	$url = add_query_arg(
		array(
			'orderby' => $column,
			'order'   => $next_order,
			's'       => $args['search'],
			'status'  => $args['status'],
			'city'    => $args['city'],
			'source'  => $args['source'],
			'from'    => $args['from'],
			'to'      => $args['to'],
		),
		axc_portal_url( 'leads' )
	);

	printf(
		'<a class="axi-sort%1$s" href="%2$s">%3$s<svg class="ico" aria-hidden="true"><use href="#p-chev"/></svg></a>',
		$is_current ? ( ' is-active is-' . esc_attr( strtolower( $args['order'] ) ) ) : '',
		esc_url( $url ),
		esc_html( $label )
	);
}
endif;

include AXC_DIR . 'templates/portal-header.php';
?>

<form class="axi-filters" method="get" action="<?php echo esc_url( axc_portal_url( 'leads' ) ); ?>">
	<div class="axi-filter axi-filter-search">
		<svg class="ico" aria-hidden="true"><use href="#p-search"/></svg>
		<input type="search" name="s" value="<?php echo esc_attr( $args['search'] ); ?>"
			placeholder="Search name, email, phone, company, city, requirement or reference…">
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
		<select name="source" aria-label="Filter by form">
			<option value="">All forms</option>
			<?php foreach ( axc_sources() as $axi_key => $axi_label ) : ?>
				<option value="<?php echo esc_attr( $axi_key ); ?>" <?php selected( $args['source'], $axi_key ); ?>>
					<?php echo esc_html( $axi_label ); ?>
				</option>
			<?php endforeach; ?>
		</select>
	</div>

	<div class="axi-filter">
		<select name="city" aria-label="Filter by city">
			<option value="">All cities</option>
			<?php foreach ( $axi_cities as $axi_city ) : ?>
				<option value="<?php echo esc_attr( $axi_city ); ?>" <?php selected( $args['city'], $axi_city ); ?>>
					<?php echo esc_html( $axi_city ); ?>
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
		<a class="axi-btn axi-btn-ghost" href="<?php echo esc_url( axc_portal_url( 'leads' ) ); ?>">Reset</a>
	<?php endif; ?>
</form>

<?php if ( empty( $data['rows'] ) ) : ?>

	<div class="axi-card">
		<div class="axi-empty">
			<svg class="ico" aria-hidden="true"><use href="#p-search"/></svg>
			<h3><?php echo esc_html( $axi_filtered ? 'No matching enquiries' : 'No enquiries yet' ); ?></h3>
			<p>
				<?php if ( $axi_filtered ) : ?>
					Try widening your filters, or <a href="<?php echo esc_url( axc_portal_url( 'leads' ) ); ?>">clear them</a>.
				<?php else : ?>
					Submissions from <a href="<?php echo esc_url( axc_landing_url() ); ?>" target="_blank" rel="noopener">the AI consultation page</a> will appear here.
				<?php endif; ?>
			</p>
		</div>
	</div>

<?php else : ?>

	<form method="post" action="<?php echo esc_url( axc_portal_url( 'leads' ) ); ?>" class="axi-card axi-list-form">
		<?php wp_nonce_field( 'axc_action_bulk_status' ); ?>
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
						<th><?php axc_sort_link( 'full_name', 'Name', $args ); ?></th>
						<th>Contact</th>
						<th><?php axc_sort_link( 'company', 'Company', $args ); ?></th>
						<th><?php axc_sort_link( 'city', 'City', $args ); ?></th>
						<th><?php axc_sort_link( 'status', 'Status', $args ); ?></th>
						<th><?php axc_sort_link( 'created_at', 'Submitted', $args ); ?></th>
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
							<td class="axi-c-person">
								<span class="axi-person">
									<span class="axi-avatar" style="--a:<?php echo esc_attr( axc_avatar_hue( $axi_row->full_name ) ); ?>"><?php echo esc_html( axc_initials( $axi_row->full_name ) ); ?></span>
									<span class="axi-person-meta">
										<strong><?php echo esc_html( $axi_row->full_name ); ?></strong>
										<small><?php echo esc_html( $axi_row->ref_code . ' · ' . axc_source_label( $axi_row->source ) ); ?></small>
									</span>
								</span>
							</td>
							<td class="axi-c-sub">
								<?php if ( $axi_row->email ) : ?>
									<a class="axi-inline-link" href="mailto:<?php echo esc_attr( $axi_row->email ); ?>"><?php echo esc_html( $axi_row->email ); ?></a>
								<?php endif; ?>
								<small class="axi-muted axi-block"><?php echo esc_html( axc_display_or_dash( $axi_row->phone ) ); ?></small>
							</td>
							<td class="axi-c-sub">
								<?php echo esc_html( axc_display_or_dash( $axi_row->company ) ); ?>
								<small class="axi-muted axi-block" title="<?php echo esc_attr( $axi_row->requirement ); ?>"><?php echo esc_html( wp_trim_words( (string) ( $axi_row->requirement ? $axi_row->requirement : $axi_row->process ), 8, '…' ) ); ?></small>
							</td>
							<td class="axi-c-inline"><?php echo esc_html( axc_display_or_dash( $axi_row->city ) ); ?></td>
							<td class="axi-c-inline"><?php axc_status_badge( $axi_row->status ); ?></td>
							<td class="axi-muted axi-c-inline" title="<?php echo esc_attr( axc_date( $axi_row->created_at ) ); ?>">
								<?php echo esc_html( axc_date( $axi_row->created_at, 'j M Y' ) ); ?>
								<small class="axi-block"><?php echo esc_html( axc_ago( $axi_row->created_at ) ); ?></small>
							</td>
							<td class="axi-row-go">
								<a href="<?php echo esc_url( axc_portal_url( 'lead/' . (int) $axi_row->id ) ); ?>"
									aria-label="<?php echo esc_attr( sprintf( 'Open enquiry from %s', $axi_row->full_name ) ); ?>">
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
					'city'    => $args['city'],
					'source'  => $args['source'],
					'from'    => $args['from'],
					'to'      => $args['to'],
					'orderby' => $args['orderby'],
					'order'   => $args['order'],
				),
				static function ( $value ) {
					return '' !== (string) $value;
				}
			),
			axc_portal_url( 'leads' )
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

<?php include AXC_DIR . 'templates/portal-footer.php'; ?>
