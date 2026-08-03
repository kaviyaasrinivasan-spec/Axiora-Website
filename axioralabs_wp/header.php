<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="<?php echo get_template_directory_uri(); ?>/assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="<?php echo get_template_directory_uri(); ?>/assets/img/favicon.png">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></symbol>
<symbol id="i-code" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></symbol>
<symbol id="i-flow" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><path d="M7 11v3a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
<symbol id="i-cpu" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
<symbol id="i-zap" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
<symbol id="i-brief" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></symbol>
<symbol id="i-factory" viewBox="0 0 24 24"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M17 18h1M12 18h1M7 18h1"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></symbol>
<symbol id="i-bank" viewBox="0 0 24 24"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 21 8 3 8"/></symbol>
<symbol id="i-bag" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></symbol>
<symbol id="i-scale" viewBox="0 0 24 24"><path d="M12 3v18M7 21h10"/><path d="m5 7 14-2"/><path d="M6.5 6 3 13a3.5 3.5 0 0 0 7 0z"/><path d="M17.5 4.5 14 11a3.5 3.5 0 0 0 7 0z"/></symbol>
<symbol id="i-building" viewBox="0 0 24 24"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>
<symbol id="i-left" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></symbol>
<symbol id="i-right" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></symbol>
<symbol id="i-rocket" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-linkedin" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></symbol>
<symbol id="i-instagram" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r="1.1"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></symbol>
<symbol id="i-layers" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></symbol>
<symbol id="i-store" viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/></symbol>
<symbol id="i-pin2" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></symbol>
<symbol id="i-trend" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></symbol>
<symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/></symbol>
<symbol id="i-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></symbol>
<symbol id="i-bot" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></symbol>
<symbol id="i-ship" viewBox="0 0 24 24"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></symbol>
<symbol id="i-plane" viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></symbol>
<symbol id="i-warehouse" viewBox="0 0 24 24"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><path d="M6 10h12"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-maximize" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></symbol>
<symbol id="i-dollar" viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></symbol>
<symbol id="i-activity" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></symbol>
<symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
<symbol id="i-linechart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></symbol>
<symbol id="i-map" viewBox="0 0 24 24"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></symbol>
<symbol id="i-pie" viewBox="0 0 24 24"><path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></symbol>
<symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></symbol>
<symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></symbol>
<symbol id="i-terminal" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></symbol>
<symbol id="i-cloud" viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></symbol>
<symbol id="i-shieldalert" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></symbol>
<symbol id="i-infinity" viewBox="0 0 24 24"><path d="M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"/></symbol>
<symbol id="i-brain" viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></symbol>
<symbol id="i-server" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6" y2="7"/><line x1="6" y1="17" x2="6" y2="17"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
</defs></svg>
<!-- ===== TOP BAR ===== -->
<div class="topbar">
  <div class="wrap topbar-inner">
    <div class="tb-left">
      <a href="tel:+918122784236"><svg class="icon"><use href="#i-phone"/></svg>+91 8122784236</a>
    </div>
    <div class="tb-right">
      <a href="https://www.linkedin.com/company/108119188" target="_blank" rel="noopener"><svg class="icon"><use href="#i-linkedin"/></svg>LinkedIn</a>
      <a href="https://www.instagram.com/axiora_labs_ai?igsh=MWJmZTIwOWN3MTNoag==" target="_blank" rel="noopener"><svg class="icon"><use href="#i-instagram"/></svg>Instagram</a>
    </div>
  </div>
</div>

<!-- ===== NAV ===== -->
<header class="nav" id="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="/" aria-label="Axiora Labs home">
      <img class="brand-logo" src="<?php echo get_template_directory_uri(); ?>/assets/img/logo.png" alt="Axiora Labs — Building Intelligence. Empowering Businesses.">
    </a>
    <nav class="nav-menu" aria-label="Primary">
      <ul class="nav-links">
        <li class="has-drop">
          <span class="nav-link" role="button" tabindex="0">Product <svg class="icon chev"><use href="#i-chev"/></svg></span>
          <div class="dropdown">
            <a href="/cargora/"><span class="di"><svg class="icon"><use href="#i-truck"/></svg></span><span><span class="t">Cargora</span><span class="d">The AI Operations Copilot for Logistics</span></span></a>
            <a href="https://trackcontainer.in/" target="_blank" rel="noopener"><span class="di"><svg class="icon"><use href="#i-pin2"/></svg></span><span><span class="t">TrackContainer</span><span class="d">Real-time container visibility &amp; tracking</span></span></a>
            <a href="https://iclinical.ai/" target="_blank" rel="noopener"><span class="di"><svg class="icon"><use href="#i-spark"/></svg></span><span><span class="t">iClinicalAI</span><span class="d">Next-Gen Clinical Trial Platform</span></span></a>
            <a href="https://meetingclosure.axioralabs.ai/" target="_blank" rel="noopener"><span class="di"><svg class="icon"><use href="#i-check"/></svg></span><span><span class="t">MeetingClosure</span><span class="d">AI Meeting Notes, Summaries &amp; Follow-ups</span></span></a>
          </div>
        </li>
        <li class="has-drop">
          <span class="nav-link" role="button" tabindex="0">Solutions <svg class="icon chev"><use href="#i-chev"/></svg></span>
          <div class="dropdown">
            <a href="/ai-consulting/"><span class="di"><svg class="icon"><use href="#i-bulb"/></svg></span><span><span class="t">AI Automation Assessment &amp; Consulting</span><span class="d">Plan your AI journey and roadmap</span></span></a>
            <a href="/custom-ai-solutions/"><span class="di"><svg class="icon"><use href="#i-code"/></svg></span><span><span class="t">Custom AI Solutions</span><span class="d">Intelligent apps &amp; process automation</span></span></a>
            <a href="/ai-product-engineering/"><span class="di"><svg class="icon"><use href="#i-flow"/></svg></span><span><span class="t">AI Product Engineering</span><span class="d">Ideas to production-ready AI products</span></span></a>
            <a href="/dedicated-ai-engineering/"><span class="di"><svg class="icon"><use href="#i-users"/></svg></span><span><span class="t">AI Development Outsourcing &amp; IT Staffing</span><span class="d">Dedicated AI engineers for your team</span></span></a>
          </div>
        </li>
        <li class="has-drop">
          <span class="nav-link" role="button" tabindex="0">Industries <svg class="icon chev"><use href="#i-chev"/></svg></span>
          <div class="dropdown wide">
            <a href="/logistics-supply-chain/"><span class="di"><svg class="icon"><use href="#i-truck"/></svg></span><span class="t">Logistics &amp; Supply Chain</span></a>
            <a href="/pharma-life-sciences/"><span class="di"><svg class="icon"><use href="#i-spark"/></svg></span><span class="t">Pharma &amp; Life Sciences</span></a>
            <a href="/enterprise-it/"><span class="di"><svg class="icon"><use href="#i-cpu"/></svg></span><span class="t">Enterprise IT &amp; GCCs</span></a>
            <a href="/manufacturing-industry/"><span class="di"><svg class="icon"><use href="#i-factory"/></svg></span><span class="t">Manufacturing</span></a>
            <a href="/banking-financial-services/"><span class="di"><svg class="icon"><use href="#i-bank"/></svg></span><span class="t">Banking &amp; Financial Services</span></a>
            <a href="/insurance-industry/"><span class="di"><svg class="icon"><use href="#i-shield"/></svg></span><span class="t">Insurance</span></a>
            <a href="/healthcare/"><span class="di"><svg class="icon"><use href="#i-heart"/></svg></span><span class="t">Healthcare</span></a>
            <a href="/legal-services/"><span class="di"><svg class="icon"><use href="#i-scale"/></svg></span><span class="t">Legal Services</span></a>
            <a href="/government-public-sector/"><span class="di"><svg class="icon"><use href="#i-building"/></svg></span><span class="t">Government &amp; Public Sector</span></a>
          </div>
        </li>
        <li><a class="nav-link" href="/about/">Our Story</a></li>
        <li><a class="nav-link" href="/contact/">Contact Us</a></li>
      </ul>
    </nav>
    <div class="nav-cta">
      <a class="btn btn-red" href="/contact/">Book a Free Consultation</a>
      <button class="burger" id="burger" aria-label="Toggle menu" aria-expanded="false"><svg class="icon"><use href="#i-menu"/></svg></button>
    </div>
  </div>
  <div class="wrap" id="mobile-menu">
    <ul class="m-nav">
      <li class="m-acc">
        <button class="m-acc-btn" type="button" aria-expanded="false">Product <svg class="icon m-chev"><use href="#i-chev"/></svg></button>
        <div class="m-panel">
          <a href="/cargora/">Cargora</a>
          <a href="https://trackcontainer.in/" target="_blank" rel="noopener">TrackContainer</a>
          <a href="https://iclinical.ai/" target="_blank" rel="noopener">iClinicalAI</a>
          <a href="https://meetingclosure.axioralabs.ai/" target="_blank" rel="noopener">MeetingClosure</a>
        </div>
      </li>
      <li class="m-acc">
        <button class="m-acc-btn" type="button" aria-expanded="false">Solutions <svg class="icon m-chev"><use href="#i-chev"/></svg></button>
        <div class="m-panel">
          <a href="/ai-consulting/">AI Automation Assessment &amp; Consulting</a>
          <a href="/custom-ai-solutions/">Custom AI Solutions</a>
          <a href="/ai-product-engineering/">AI Product Engineering</a>
          <a href="/dedicated-ai-engineering/">AI Development Outsourcing &amp; IT Staffing</a>
        </div>
      </li>
      <li class="m-acc">
        <button class="m-acc-btn" type="button" aria-expanded="false">Industries <svg class="icon m-chev"><use href="#i-chev"/></svg></button>
        <div class="m-panel">
          <a href="/logistics-supply-chain/">Logistics &amp; Supply Chain</a>
          <a href="/pharma-life-sciences/">Pharma &amp; Life Sciences</a>
          <a href="/enterprise-it/">Enterprise IT &amp; GCCs</a>
          <a href="/manufacturing-industry/">Manufacturing</a>
          <a href="/banking-financial-services/">Banking &amp; Financial Services</a>
          <a href="/insurance-industry/">Insurance</a>
          <a href="/healthcare/">Healthcare</a>
          <a href="/legal-services/">Legal Services</a>
          <a href="/government-public-sector/">Government &amp; Public Sector</a>
        </div>
      </li>
      <li><a class="m-top" href="/about/">Our Story</a></li>
      <li><a class="m-top" href="/contact/">Contact Us</a></li>
    </ul>
    <div class="m-cta"><a class="btn btn-red" href="/contact/">Book a Free Consultation</a></div>
  </div>
</header>


