<?php /* Template Name: WB — Contact */ get_header(); ?>
<main id="top">
  <section class="page-hero">
    <div class="wrap inner">
      <span class="eyebrow reveal">Get in touch</span>
      <h1 class="reveal">Get in Touch</h1>
      <p class="reveal">Our team responds within 24 business hours.</p>
    </div>
  </section>

  <section class="section" id="book" style="padding-top:20px">
    <div class="wrap">
      <div class="contact-grid">
        <!-- FORM -->
        <div class="form-card reveal">
          <div class="form-head">
            <h2>Book Your Free AI Automation Audit</h2>
            <p>Automate repetitive tasks, reduce manual work, and save hours every week.</p>
          </div>
          <?php
            $wb_notice = wb_lead_notice();
            $wb_cls    = $wb_notice ? ($wb_notice['ok'] ? ' is-ok' : ' is-err') : '';
            $wb_opts   = wb_lead_choices();
          ?>
          <?php /* novalidate: the browser's own bubble is unstyled and easy to miss —
                   contact.js shows the message inline instead, in the same slot the
                   server's notice uses. */ ?>
          <form class="form-grid<?php echo esc_attr($wb_cls); ?>" method="post" novalidate
                action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="wb_lead">
            <?php wp_nonce_field('wb_lead','wb_nonce'); ?>
            <?php /* Honeypot. Deliberately NOT named "website"/"url"/"company" and so on:
                     Chrome's autofill recognises those and would fill it for a real person,
                     whose enquiry would then be silently dropped as a bot. autocomplete=off
                     alone is not enough — Chrome ignores it on recognised field names. */ ?>
            <div class="form-hp" aria-hidden="true">
              <label for="wb-lead-hp">Leave this field empty</label>
              <input id="wb-lead-hp" type="text" name="wb_hp_leaveblank" tabindex="-1" autocomplete="off">
            </div>
            <div class="field">
              <label for="wb-lead-name">Full Name <span class="req">*</span></label>
              <input id="wb-lead-name" type="text" name="fullName" placeholder="e.g. Rahul Sharma" autocomplete="name" required>
            </div>
            <div class="field">
              <label for="wb-lead-company">Company Name <span class="req">*</span></label>
              <input id="wb-lead-company" type="text" name="companyName" placeholder="e.g. Acme Tech Solutions" autocomplete="organization" required>
            </div>
            <div class="field">
              <label for="wb-lead-email">Email Address <span class="req">*</span></label>
              <input id="wb-lead-email" type="email" name="email" placeholder="e.g. rahul@acmetech.com" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="wb-lead-mobile">Mobile Number <span class="req">*</span></label>
              <?php /* No maxlength: it would truncate a pasted "+91 98765 43210" to ten
                       characters before the digits could be normalised, silently dropping
                       real digits. contact.js strips to ten digits instead. */ ?>
              <div class="phone-wrap"><span class="pfx">+91</span><input id="wb-lead-mobile" type="tel" name="mobileNumber" placeholder="9876543210" inputmode="numeric" autocomplete="tel-national" required></div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="wb-lead-emp">Number of Employees <span class="req">*</span></label>
                <select id="wb-lead-emp" name="employeeCount" required>
                  <option value="" disabled selected>Select range</option>
                  <?php foreach($wb_opts['employeeCount'] as $v=>$l): ?>
                    <option value="<?php echo esc_attr($v); ?>"><?php echo esc_html($l); ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
              <div class="field">
                <label for="wb-lead-timeline">Implementation Timeline <span class="req">*</span></label>
                <select id="wb-lead-timeline" name="timeline" required>
                  <option value="" disabled selected>Select option</option>
                  <?php foreach($wb_opts['timeline'] as $v=>$l): ?>
                    <option value="<?php echo esc_attr($v); ?>"><?php echo esc_html($l); ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="wb-lead-process">Biggest Repetitive Process <span class="req">*</span></label>
              <select id="wb-lead-process" name="repetitiveProcess" required>
                <option value="" disabled selected>Select process</option>
                <?php foreach($wb_opts['repetitiveProcess'] as $v=>$l): ?>
                  <option value="<?php echo esc_attr($v); ?>"><?php echo esc_html($l); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="field">
              <label for="wb-lead-notes">Tell us about your automation needs (Optional)</label>
              <textarea id="wb-lead-notes" name="processDescription" placeholder="Tell us about the repetitive tasks or bottlenecks you want to solve…"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Book A Call <svg class="icon"><use href="#i-arrow"/></svg></button>
            <?php /* One slot for both lines: the reassurance is swapped for the result, so
                     the button never moves when a message appears. */ ?>
            <div class="form-foot">
              <p class="form-msg" role="status" aria-live="polite"><?php echo $wb_notice ? esc_html($wb_notice['text']) : ''; ?></p>
              <div class="form-note"><svg class="icon"><use href="#i-check"/></svg> We reply within 24 business hours. No spam, ever.</div>
            </div>
          </form>
        </div>

        <!-- CONTACT SIDE -->
        <div class="contact-side">
          <div class="reveal">
            <h2 class="lead-h">Let's Talk Automation</h2>
            <p class="lead-p">Whether you have a specific project in mind or just want to explore how automation can help your business, we're here to help.</p>
          </div>
          <div class="cm-list">
            <a class="cm-card reveal" href="mailto:sales@axioralabs.ai"><span class="cm-ico" style="--c1:#3c59e7;--c2:#22d3ee"><svg class="icon"><use href="#i-mail"/></svg></span><span class="cm-txt"><b>Email</b><span>sales@axioralabs.ai</span></span></a>
            <a class="cm-card reveal" href="tel:+918122784236"><span class="cm-ico" style="--c1:#a855f7;--c2:#ec4899"><svg class="icon"><use href="#i-phone"/></svg></span><span class="cm-txt"><b>Phone</b><span>+91 8122784236</span></span></a>
            <a class="cm-card reveal" href="https://www.google.com/maps/search/?api=1&query=Nungambakkam+Chennai+600034" target="_blank" rel="noopener"><span class="cm-ico" style="--c1:#f97316;--c2:#ef4444"><svg class="icon"><use href="#i-pin"/></svg></span><span class="cm-txt"><b>Location</b><span>Chennai, India</span></span></a>
          </div>
          <div class="resp-card reveal">
            <div class="rc-ico"><svg class="icon"><use href="#i-clock"/></svg></div>
            <div class="rc-label">Average Response Time</div>
            <div class="rc-big">&lt; 24 hours</div>
            <div class="rc-sub">We typically respond to all inquiries within one business day.</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap cta-inner reveal">
      <h2>Let's Automate Your Business Today</h2>
      <p>Explore how AI automation can save your team hours every week and help you scale smarter.</p>
      <div class="cta-btns"><a class="btn btn-white" href="/cargora/">Explore Our Platforms <svg class="icon"><use href="#i-arrow"/></svg></a></div>
    </div>
  </section>
</main>

<?php get_footer(); ?>
