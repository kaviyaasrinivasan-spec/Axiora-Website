<?php
/**
 * Storage layer: schema, CRUD, filtered queries and dashboard aggregates.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Internship_DB {

	/** Applications table. */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'axiora_internship_apps';
	}

	/** Status / activity history table. */
	public static function log_table() {
		global $wpdb;
		return $wpdb->prefix . 'axiora_internship_log';
	}

	/**
	 * Create or upgrade the schema. Safe to run repeatedly.
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$apps    = self::table();
		$log     = self::log_table();

		$sql_apps = "CREATE TABLE $apps (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			ref_code varchar(24) NOT NULL DEFAULT '',
			full_name varchar(150) NOT NULL DEFAULT '',
			email varchar(190) NOT NULL DEFAULT '',
			phone varchar(40) NOT NULL DEFAULT '',
			college varchar(190) NOT NULL DEFAULT '',
			course varchar(140) NOT NULL DEFAULT '',
			grad_year varchar(8) NOT NULL DEFAULT '',
			track varchar(140) NOT NULL DEFAULT '',
			city varchar(120) NOT NULL DEFAULT '',
			message text NULL,
			resume_file varchar(255) NOT NULL DEFAULT '',
			resume_name varchar(255) NOT NULL DEFAULT '',
			resume_size int(11) NOT NULL DEFAULT 0,
			status varchar(32) NOT NULL DEFAULT 'new',
			admin_notes text NULL,
			source_url varchar(255) NOT NULL DEFAULT '',
			ip varchar(64) NOT NULL DEFAULT '',
			user_agent varchar(255) NOT NULL DEFAULT '',
			reviewed_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			updated_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY status (status),
			KEY created_at (created_at),
			KEY email (email)
		) $charset;";

		$sql_log = "CREATE TABLE $log (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			app_id bigint(20) unsigned NOT NULL DEFAULT 0,
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			action varchar(32) NOT NULL DEFAULT '',
			from_status varchar(32) NOT NULL DEFAULT '',
			to_status varchar(32) NOT NULL DEFAULT '',
			note text NULL,
			created_at datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY app_id (app_id)
		) $charset;";

		dbDelta( $sql_apps );
		dbDelta( $sql_log );
	}

	/* ---------------------------------------------------------------------
	 * Writes
	 * ------------------------------------------------------------------ */

	/**
	 * @param array $data Already-sanitised field values.
	 * @return int|WP_Error New row id.
	 */
	public static function insert( $data ) {
		global $wpdb;

		$now = current_time( 'mysql' );

		$row = array(
			'ref_code'    => '',
			'full_name'   => '',
			'email'       => '',
			'phone'       => '',
			'college'     => '',
			'course'      => '',
			'grad_year'   => '',
			'track'       => '',
			'city'        => '',
			'message'     => '',
			'resume_file' => '',
			'resume_name' => '',
			'resume_size' => 0,
			'status'      => axi_int_default_status(),
			'admin_notes' => '',
			'source_url'  => '',
			'ip'          => '',
			'user_agent'  => '',
			'reviewed_by' => 0,
			'created_at'  => $now,
			'updated_at'  => $now,
		);
		$row = array_merge( $row, array_intersect_key( $data, $row ) );

		$ok = $wpdb->insert( self::table(), $row );
		if ( false === $ok ) {
			return new WP_Error( 'db_insert_failed', __( 'Could not save your application. Please try again.', 'axiora-internship' ) );
		}

		$id = (int) $wpdb->insert_id;

		// Human-friendly reference, e.g. AXI-2026-0042.
		$ref = sprintf( 'AXI-%s-%04d', current_time( 'Y' ), $id );
		$wpdb->update( self::table(), array( 'ref_code' => $ref ), array( 'id' => $id ) );

		self::log(
			$id,
			array(
				'action'  => 'created',
				'to_status' => $row['status'],
				'note'    => 'Application submitted from the website.',
			)
		);

		return $id;
	}

	/**
	 * Move an application to a new status and record it on the timeline.
	 *
	 * @return true|WP_Error
	 */
	public static function update_status( $id, $status, $note = '', $user_id = 0 ) {
		global $wpdb;

		$app = self::get( $id );
		if ( ! $app ) {
			return new WP_Error( 'not_found', __( 'Application not found.', 'axiora-internship' ) );
		}
		if ( ! axi_int_status_exists( $status ) ) {
			return new WP_Error( 'bad_status', __( 'Unknown status.', 'axiora-internship' ) );
		}
		if ( $app->status === $status && '' === trim( $note ) ) {
			return true; // Nothing to do.
		}

		$wpdb->update(
			self::table(),
			array(
				'status'      => $status,
				'updated_at'  => current_time( 'mysql' ),
				'reviewed_by' => (int) $user_id,
			),
			array( 'id' => (int) $id )
		);

		self::log(
			$id,
			array(
				'action'      => 'status',
				'user_id'     => $user_id,
				'from_status' => $app->status,
				'to_status'   => $status,
				'note'        => $note,
			)
		);

		do_action( 'axiora_internship_status_changed', $id, $status, $app->status );

		return true;
	}

	/** Save the internal notes field. */
	public static function update_notes( $id, $notes, $user_id = 0 ) {
		global $wpdb;

		$app = self::get( $id );
		if ( ! $app ) {
			return new WP_Error( 'not_found', __( 'Application not found.', 'axiora-internship' ) );
		}

		$wpdb->update(
			self::table(),
			array(
				'admin_notes' => $notes,
				'updated_at'  => current_time( 'mysql' ),
				'reviewed_by' => (int) $user_id,
			),
			array( 'id' => (int) $id )
		);

		self::log( $id, array( 'action' => 'note', 'user_id' => $user_id, 'note' => 'Internal notes updated.' ) );

		return true;
	}

	/** Delete an application, its history and its resume file. */
	public static function delete( $id ) {
		global $wpdb;

		$app = self::get( $id );
		if ( ! $app ) {
			return false;
		}

		if ( $app->resume_file ) {
			$path = trailingslashit( axi_int_upload_dir() ) . $app->resume_file;
			if ( file_exists( $path ) ) {
				@unlink( $path );
			}
		}

		$wpdb->delete( self::log_table(), array( 'app_id' => (int) $id ) );
		$wpdb->delete( self::table(), array( 'id' => (int) $id ) );

		return true;
	}

	/* ---------------------------------------------------------------------
	 * Reads
	 * ------------------------------------------------------------------ */

	public static function get( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table() . ' WHERE id = %d', (int) $id ) );
	}

	/**
	 * Filtered, sorted, paginated list.
	 *
	 * @param array $args search|status|course|from|to|orderby|order|per_page|page
	 * @return array{rows:array,total:int,pages:int,page:int}
	 */
	public static function query( $args = array() ) {
		global $wpdb;

		$args = wp_parse_args(
			$args,
			array(
				'search'   => '',
				'status'   => '',
				'course'   => '',
				'from'     => '',
				'to'       => '',
				'orderby'  => 'created_at',
				'order'    => 'DESC',
				'per_page' => 20,
				'page'     => 1,
			)
		);

		$where  = array( '1=1' );
		$params = array();

		if ( '' !== $args['search'] ) {
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]  = '(full_name LIKE %s OR email LIKE %s OR phone LIKE %s OR college LIKE %s OR ref_code LIKE %s OR city LIKE %s)';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}
		if ( '' !== $args['status'] && axi_int_status_exists( $args['status'] ) ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}
		if ( '' !== $args['course'] ) {
			$where[]  = 'course = %s';
			$params[] = $args['course'];
		}
		if ( '' !== $args['from'] ) {
			$where[]  = 'created_at >= %s';
			$params[] = $args['from'] . ' 00:00:00';
		}
		if ( '' !== $args['to'] ) {
			$where[]  = 'created_at <= %s';
			$params[] = $args['to'] . ' 23:59:59';
		}

		$where_sql = implode( ' AND ', $where );

		// Whitelist ordering — never interpolate user input into ORDER BY.
		$allowed_orderby = array( 'created_at', 'updated_at', 'full_name', 'college', 'status', 'id' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'created_at';
		$order           = ( 'ASC' === strtoupper( $args['order'] ) ) ? 'ASC' : 'DESC';

		$count_sql = 'SELECT COUNT(*) FROM ' . self::table() . ' WHERE ' . $where_sql;
		$total     = (int) ( $params
			? $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) )
			: $wpdb->get_var( $count_sql ) );

		$per_page = max( 1, min( 200, (int) $args['per_page'] ) );
		$pages    = max( 1, (int) ceil( $total / $per_page ) );
		$page     = max( 1, min( $pages, (int) $args['page'] ) );
		$offset   = ( $page - 1 ) * $per_page;

		$sql          = 'SELECT * FROM ' . self::table() . ' WHERE ' . $where_sql
			. " ORDER BY $orderby $order LIMIT %d OFFSET %d";
		$row_params   = $params;
		$row_params[] = $per_page;
		$row_params[] = $offset;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $row_params ) );

		return array(
			'rows'  => $rows ? $rows : array(),
			'total' => $total,
			'pages' => $pages,
			'page'  => $page,
		);
	}

	/** Every row matching the filters, unpaginated — used by the CSV export. */
	public static function query_all( $args = array() ) {
		$args['per_page'] = 5000;
		$args['page']     = 1;
		$result           = self::query( $args );
		return $result['rows'];
	}

	/** Timeline entries, oldest first. */
	public static function get_log( $app_id ) {
		global $wpdb;
		return $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM ' . self::log_table() . ' WHERE app_id = %d ORDER BY id ASC', (int) $app_id )
		);
	}

	public static function log( $app_id, $args ) {
		global $wpdb;

		$wpdb->insert(
			self::log_table(),
			array(
				'app_id'      => (int) $app_id,
				'user_id'     => isset( $args['user_id'] ) ? (int) $args['user_id'] : 0,
				'action'      => isset( $args['action'] ) ? substr( $args['action'], 0, 32 ) : '',
				'from_status' => isset( $args['from_status'] ) ? $args['from_status'] : '',
				'to_status'   => isset( $args['to_status'] ) ? $args['to_status'] : '',
				'note'        => isset( $args['note'] ) ? $args['note'] : '',
				'created_at'  => current_time( 'mysql' ),
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Aggregates for the dashboard
	 * ------------------------------------------------------------------ */

	/** @return array<string,int> status key => count, every status present. */
	public static function counts_by_status() {
		global $wpdb;

		$counts = array_fill_keys( array_keys( axi_int_statuses() ), 0 );
		$rows   = $wpdb->get_results( 'SELECT status, COUNT(*) AS c FROM ' . self::table() . ' GROUP BY status' );

		foreach ( (array) $rows as $row ) {
			$counts[ $row->status ] = (int) $row->c;
		}
		return $counts;
	}

	public static function total() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::table() );
	}

	/** Submissions received since midnight N days ago (0 = today). */
	public static function count_since_days( $days ) {
		global $wpdb;
		$since = gmdate( 'Y-m-d 00:00:00', strtotime( current_time( 'mysql' ) ) - ( (int) $days * DAY_IN_SECONDS ) );
		return (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table() . ' WHERE created_at >= %s', $since )
		);
	}

	/**
	 * Daily submission counts for the trend chart.
	 *
	 * @param int $days How many days back, including today.
	 * @return array<int,array{date:string,label:string,count:int}> Oldest first, no gaps.
	 */
	public static function trend( $days = 14 ) {
		global $wpdb;

		$days  = max( 2, (int) $days );
		$start = gmdate( 'Y-m-d', strtotime( current_time( 'mysql' ) ) - ( ( $days - 1 ) * DAY_IN_SECONDS ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM ' . self::table()
				. ' WHERE created_at >= %s GROUP BY DATE(created_at)',
				$start . ' 00:00:00'
			),
			OBJECT_K
		);

		$series = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$date     = gmdate( 'Y-m-d', strtotime( current_time( 'mysql' ) ) - ( $i * DAY_IN_SECONDS ) );
			$series[] = array(
				'date'  => $date,
				'label' => date_i18n( 'j M', strtotime( $date ) ),
				'count' => isset( $rows[ $date ] ) ? (int) $rows[ $date ]->c : 0,
			);
		}
		return $series;
	}

	/** Distinct courses actually present, for the filter dropdown. */
	public static function distinct_courses() {
		global $wpdb;
		$rows = $wpdb->get_col( "SELECT DISTINCT course FROM " . self::table() . " WHERE course <> '' ORDER BY course ASC" );
		return $rows ? $rows : array();
	}

	/** Top colleges by application count. */
	public static function top_colleges( $limit = 5 ) {
		global $wpdb;
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT college, COUNT(*) AS c FROM " . self::table()
				. " WHERE college <> '' GROUP BY college ORDER BY c DESC, college ASC LIMIT %d",
				(int) $limit
			)
		);
	}

	/** How many applications this email already has — used to flag duplicates. */
	public static function count_by_email( $email ) {
		global $wpdb;
		return (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table() . ' WHERE email = %s', $email )
		);
	}
}
