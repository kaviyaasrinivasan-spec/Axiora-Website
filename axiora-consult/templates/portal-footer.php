<?php
/**
 * Portal shell — closing half.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
		</div><!-- /.axi-content -->

		<footer class="axi-foot">
			<span>Axiora Labs — Consultation Dashboard</span>
			<span><?php echo esc_html( date_i18n( 'j M Y, g:i a' ) ); ?></span>
		</footer>
	</div><!-- /.axi-main -->
</div><!-- /.axi-shell -->
<?php wp_footer(); ?>
</body>
</html>
