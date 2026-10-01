<?php
/**
 * The dashboard's own login, separate from WordPress user accounts.
 *
 * One dashboard account is stored in the `axc_portal_user` option as
 * { login, hash } — the password is hashed with wp_hash_password(), never kept
 * in plain text. A successful sign-in sets a signed, HttpOnly cookie; the
 * signature covers the password hash, so changing the password signs every
 * existing session out.
 *
 * Set or change the account on the server with:
 *   wp eval 'Axiora_Consult_Auth::set_account( "name", "password" );'
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Axiora_Consult_Auth {

	const COOKIE = 'axc_portal_session';

	/** Failed sign-ins allowed per IP before a 15-minute lockout. */
	const MAX_FAILS = 8;

	/** Signed-in user for this request, once verified. */
	protected static $user = null;

	public static function init() {
		// WordPress nonces for a logged-out visitor are identical for everyone;
		// tie them to the dashboard session instead so a form's nonce only works
		// for the person who was shown it.
		add_filter( 'nonce_user_logged_out', array( __CLASS__, 'nonce_uid' ), 10, 2 );
	}

	/* ---------------------------------------------------------------------
	 * Account
	 * ------------------------------------------------------------------ */

	public static function set_account( $login, $password ) {
		$login = trim( (string) $login );
		if ( '' === $login || '' === (string) $password ) {
			return false;
		}
		return update_option(
			'axc_portal_user',
			array(
				'login' => $login,
				'hash'  => wp_hash_password( (string) $password ),
			),
			false
		);
	}

	protected static function account() {
		$acct = get_option( 'axc_portal_user' );
		return ( is_array( $acct ) && ! empty( $acct['login'] ) && ! empty( $acct['hash'] ) ) ? $acct : null;
	}

	/* ---------------------------------------------------------------------
	 * Sign in / out
	 * ------------------------------------------------------------------ */

	/**
	 * @return true|WP_Error
	 */
	public static function attempt( $login, $password, $remember ) {
		$key = 'axc_login_fail_' . md5( self::ip() );

		if ( (int) get_transient( $key ) >= self::MAX_FAILS ) {
			return new WP_Error( 'locked', __( 'Too many failed attempts. Please wait 15 minutes and try again.', 'axiora-consult' ) );
		}

		$acct = self::account();
		$ok   = $acct
			&& 0 === strcasecmp( trim( (string) $login ), $acct['login'] )
			&& wp_check_password( (string) $password, $acct['hash'] );

		if ( ! $ok ) {
			set_transient( $key, (int) get_transient( $key ) + 1, 15 * MINUTE_IN_SECONDS );
			return new WP_Error( 'bad_login', __( 'Incorrect username or password.', 'axiora-consult' ) );
		}

		delete_transient( $key );

		$ttl     = $remember ? 14 * DAY_IN_SECONDS : 12 * HOUR_IN_SECONDS;
		$expires = time() + $ttl;
		$value   = $expires . '|' . self::sign( $acct, $expires );

		self::set_cookie( $value, $remember ? $expires : 0 );
		self::$user = $acct['login'];

		return true;
	}

	public static function logout() {
		self::set_cookie( '', time() - YEAR_IN_SECONDS );
		self::$user = null;
	}

	/** The signed-in dashboard login name, or '' when signed out. */
	public static function current() {
		if ( null !== self::$user ) {
			return self::$user;
		}

		self::$user = '';
		$acct       = self::account();
		$raw        = isset( $_COOKIE[ self::COOKIE ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE ] ) ) : '';

		if ( ! $acct || false === strpos( $raw, '|' ) ) {
			return self::$user;
		}

		list( $expires, $sig ) = explode( '|', $raw, 2 );
		$expires               = (int) $expires;

		if ( $expires > time() && hash_equals( self::sign( $acct, $expires ), $sig ) ) {
			self::$user = $acct['login'];
		}

		return self::$user;
	}

	public static function is_signed_in() {
		return '' !== self::current();
	}

	public static function nonce_uid( $uid, $action ) {
		$who = self::current();
		return '' !== $who ? 'axc:' . $who : $uid;
	}

	/* ---------------------------------------------------------------------
	 * Internals
	 * ------------------------------------------------------------------ */

	protected static function sign( $acct, $expires ) {
		return hash_hmac( 'sha256', $acct['login'] . '|' . $expires . '|' . $acct['hash'], wp_salt( 'auth' ) );
	}

	protected static function set_cookie( $value, $expires ) {
		$path = wp_parse_url( axc_portal_url(), PHP_URL_PATH );
		setcookie(
			self::COOKIE,
			$value,
			array(
				'expires'  => $expires,
				'path'     => $path ? $path : '/',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
	}

	protected static function ip() {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	}
}
