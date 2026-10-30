<?php
// Web entry point, installed at public_html/qa/index.php. The application itself lives
// outside the web root; the installer fills AXT_ROOT in with its absolute path.
const AXT_ROOT = '__APP_ROOT__';
require AXT_ROOT . '/php/app.php';
\Axt\run(AXT_ROOT);
