<?php
/**
 * Inline SVG / HTML charts for the dashboard. No chart library — the site ships
 * no JS dependencies and this keeps it that way.
 *
 * Colour decisions (validated against a white surface):
 *  - Submissions over time is ONE series, so it is a single-hue area + line in
 *    the brand blue. No legend: the chart title names the series.
 *  - The pipeline is a horizontal bar chart, not a donut: seven categories with
 *    long names read far better stacked and left-aligned, and every bar is
 *    direct-labelled, so colour never carries the meaning on its own.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Round a maximum up to a friendly axis top so every gridline lands on a whole
 * number — these are counts of people, so fractional ticks would be nonsense.
 *
 * @return array{0:int,1:int} [axis top, step between ticks]
 */
function axi_int_nice_axis( $max_value, $ticks = 4 ) {
	$ticks     = max( 1, (int) $ticks );
	$max_value = max( 1, (int) $max_value );

	$step = (int) ceil( $max_value / $ticks );
	$step = max( 1, $step );

	return array( $step * $ticks, $step );
}

/**
 * Submissions per day — area + line, single series.
 *
 * @param array $series Rows of ['date','label','count'] oldest first.
 */
function axi_int_render_trend_chart( $series ) {
	$n = count( $series );
	if ( $n < 2 ) {
		echo '<p class="axi-chart-empty">Not enough data yet.</p>';
		return;
	}

	$w     = 760;
	$h     = 240;
	$pad_l = 40;
	$pad_r = 16;
	$pad_t = 18;
	$pad_b = 30;

	$inner_w = $w - $pad_l - $pad_r;
	$inner_h = $h - $pad_t - $pad_b;

	$values = wp_list_pluck( $series, 'count' );
	list( $axis_max, $axis_step ) = axi_int_nice_axis( max( $values ), 4 );

	$points = array();
	foreach ( $series as $i => $row ) {
		$x        = $pad_l + ( $i * ( $inner_w / ( $n - 1 ) ) );
		$y        = $pad_t + ( $inner_h * ( 1 - ( $row['count'] / $axis_max ) ) );
		$points[] = array(
			'x'     => round( $x, 2 ),
			'y'     => round( $y, 2 ),
			'label' => $row['label'],
			'count' => (int) $row['count'],
			'date'  => $row['date'],
		);
	}

	$line_d = '';
	foreach ( $points as $i => $p ) {
		$line_d .= ( 0 === $i ? 'M' : 'L' ) . $p['x'] . ' ' . $p['y'] . ' ';
	}
	$area_d = $line_d . 'L' . end( $points )['x'] . ' ' . ( $pad_t + $inner_h ) . ' L' . $points[0]['x'] . ' ' . ( $pad_t + $inner_h ) . ' Z';

	// Show roughly seven x labels so they never collide.
	$label_every = max( 1, (int) ceil( $n / 7 ) );
	?>
	<div class="axi-chart" data-axi-chart>
		<svg viewBox="0 0 <?php echo esc_attr( $w . ' ' . $h ); ?>" class="axi-chart-svg" role="img"
			aria-label="Applications received per day over the last <?php echo esc_attr( $n ); ?> days">
			<defs>
				<linearGradient id="axiTrendFill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#3c59e7" stop-opacity="0.20"/>
					<stop offset="100%" stop-color="#3c59e7" stop-opacity="0"/>
				</linearGradient>
			</defs>

			<?php /* Gridlines and y ticks, recessive. */ ?>
			<?php for ( $v = 0; $v <= $axis_max; $v += $axis_step ) : ?>
				<?php $gy = round( $pad_t + ( $inner_h * ( 1 - ( $v / $axis_max ) ) ), 2 ); ?>
				<line x1="<?php echo esc_attr( $pad_l ); ?>" y1="<?php echo esc_attr( $gy ); ?>"
					x2="<?php echo esc_attr( $w - $pad_r ); ?>" y2="<?php echo esc_attr( $gy ); ?>"
					stroke="<?php echo ( 0 === $v ) ? '#d6dbee' : '#eef0f7'; ?>" stroke-width="1"/>
				<text x="<?php echo esc_attr( $pad_l - 10 ); ?>" y="<?php echo esc_attr( $gy + 4 ); ?>"
					class="axi-axis-label" text-anchor="end"><?php echo esc_html( $v ); ?></text>
			<?php endfor; ?>

			<path d="<?php echo esc_attr( $area_d ); ?>" fill="url(#axiTrendFill)"/>
			<path d="<?php echo esc_attr( trim( $line_d ) ); ?>" fill="none" stroke="#3c59e7" stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round"/>

			<?php foreach ( $points as $i => $p ) : ?>
				<?php if ( 0 === $i % $label_every || $i === $n - 1 ) : ?>
					<text x="<?php echo esc_attr( $p['x'] ); ?>" y="<?php echo esc_attr( $h - 8 ); ?>"
						class="axi-axis-label" text-anchor="middle"><?php echo esc_html( $p['label'] ); ?></text>
				<?php endif; ?>
				<circle cx="<?php echo esc_attr( $p['x'] ); ?>" cy="<?php echo esc_attr( $p['y'] ); ?>" r="3"
					fill="#ffffff" stroke="#3c59e7" stroke-width="2"/>
			<?php endforeach; ?>

			<?php /* Invisible hit columns drive the crosshair + tooltip in portal.js. */ ?>
			<line class="axi-crosshair" x1="0" y1="<?php echo esc_attr( $pad_t ); ?>" x2="0"
				y2="<?php echo esc_attr( $pad_t + $inner_h ); ?>" stroke="#8a91a8" stroke-width="1"
				stroke-dasharray="3 3" opacity="0"/>
			<?php
			$col_w = $inner_w / ( $n - 1 );
			foreach ( $points as $p ) :
				?>
				<rect class="axi-hit" x="<?php echo esc_attr( round( $p['x'] - ( $col_w / 2 ), 2 ) ); ?>"
					y="<?php echo esc_attr( $pad_t ); ?>" width="<?php echo esc_attr( round( $col_w, 2 ) ); ?>"
					height="<?php echo esc_attr( $inner_h ); ?>" fill="transparent"
					data-x="<?php echo esc_attr( $p['x'] ); ?>"
					data-y="<?php echo esc_attr( $p['y'] ); ?>"
					data-label="<?php echo esc_attr( axi_int_date( $p['date'] . ' 00:00:00', 'D, j M Y' ) ); ?>"
					data-value="<?php echo esc_attr( $p['count'] . ' ' . _n( 'application', 'applications', $p['count'], 'axiora-internship' ) ); ?>"></rect>
			<?php endforeach; ?>
		</svg>
		<div class="axi-tip" hidden><strong></strong><span></span></div>
	</div>
	<?php
}

/**
 * Pipeline distribution — horizontal bars, one row per status, click-through to
 * the filtered list.
 *
 * @param array $counts status key => count
 * @param int   $total
 */
function axi_int_render_pipeline( $counts, $total ) {
	$total = max( 0, (int) $total );

	if ( ! $total ) {
		echo '<p class="axi-chart-empty">No applications yet — the pipeline will fill in as they arrive.</p>';
		return;
	}

	$peak = max( 1, max( $counts ) );
	?>
	<ul class="axi-bars">
		<?php foreach ( axi_int_statuses() as $key => $meta ) : ?>
			<?php
			$count   = isset( $counts[ $key ] ) ? (int) $counts[ $key ] : 0;
			$share   = $total ? ( $count / $total ) * 100 : 0;
			$bar_pct = ( $count / $peak ) * 100;
			?>
			<li class="axi-bar-row">
				<a href="<?php echo esc_url( axi_int_portal_url( 'applications', array( 'status' => $key ) ) ); ?>"
					title="<?php echo esc_attr( sprintf( '%s — %d of %d (%s%%)', $meta['label'], $count, $total, number_format_i18n( $share, 1 ) ) ); ?>">
					<span class="axi-bar-name"><i class="axi-dot" style="--s:<?php echo esc_attr( $meta['color'] ); ?>"></i><?php echo esc_html( $meta['label'] ); ?></span>
					<span class="axi-bar-track">
						<span class="axi-bar-fill" style="width:<?php echo esc_attr( round( $bar_pct, 2 ) ); ?>%;--s:<?php echo esc_attr( $meta['color'] ); ?>"></span>
					</span>
					<span class="axi-bar-val"><?php echo esc_html( number_format_i18n( $count ) ); ?><small><?php echo esc_html( number_format_i18n( $share, 0 ) ); ?>%</small></span>
				</a>
			</li>
		<?php endforeach; ?>
	</ul>
	<?php
}
