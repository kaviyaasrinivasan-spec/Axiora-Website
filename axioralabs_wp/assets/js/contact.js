/* Contact / audit lead form.
   Upgrades the plain POST to admin-post.php into a fetch() submit so the page
   does not reload. Without JS the form still posts and comes back with the
   notice rendered by wb_lead_notice(). */
(function(){
  var d = document;
  if(!window.fetch || !window.FormData) return;   /* plain POST still works */

  var forms = d.querySelectorAll('form.form-grid[method=post]');

  Array.prototype.forEach.call(forms, function(f){
    var msg = f.querySelector('.form-msg'),
        btn = f.querySelector('button[type=submit]');
    if(!msg || !btn) return;

    var label = btn.innerHTML;   /* innerHTML, not text - the button holds an icon */

    function say(ok, text){
      f.classList.remove('is-ok','is-err','is-busy');
      f.classList.add(ok ? 'is-ok' : 'is-err');
      msg.textContent = text;
      /* On success drop any field still flagged from an earlier failed attempt —
         f.reset() below clears the values but not the classes. */
      if(ok) Array.prototype.forEach.call(f.querySelectorAll('.has-err'), function(el){
        el.classList.remove('has-err');
      });
    }

    function clear(){
      f.classList.remove('is-ok','is-err');
      msg.textContent = '';
    }

    /* Flag the field we are complaining about, so the message has something to
       point at, and drop the flag as soon as they touch it. */
    function bad(el, text){
      say(false, text);
      if(el){
        el.classList.add('has-err');
        el.focus();
      }
    }

    Array.prototype.forEach.call(f.querySelectorAll('input,select,textarea'), function(el){
      var evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function(){
        el.classList.remove('has-err');
        if(f.className.indexOf('is-') !== -1) clear();
      });
    });

    /* Keep the mobile field to ten digits. Handles a pasted "+91 98765 43210" as
       well as typing: strip everything but digits, drop a leading 91 country code,
       then cap. The field carries no maxlength precisely so this can run first. */
    var mobile = f.querySelector('input[name=mobileNumber]');
    if(mobile) mobile.addEventListener('input', function(){
      var only = mobile.value.replace(/\D/g,'');
      if(only.length === 12 && only.indexOf('91') === 0) only = only.slice(2);
      if(only.length > 10) only = only.slice(0,10);
      if(only !== mobile.value) mobile.value = only;
    });

    f.addEventListener('submit', function(e){
      e.preventDefault();   /* the form is novalidate, so every case is ours to answer */

      var name    = f.querySelector('input[name=fullName]'),
          company = f.querySelector('input[name=companyName]'),
          email   = f.querySelector('input[name=email]');

      if(name && !name.value.trim())    return bad(name,'Please enter your full name.');
      if(company && !company.value.trim()) return bad(company,'Please enter your company name.');
      if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())){
        return bad(email,'Please enter a valid email address.');
      }
      if(mobile && mobile.value.replace(/\D/g,'').length !== 10){
        return bad(mobile,'Please enter a valid 10-digit mobile number.');
      }

      var missing = null;
      Array.prototype.forEach.call(f.querySelectorAll('select[required]'), function(s){
        if(!missing && !s.value) missing = s;
      });
      if(missing) return bad(missing,'Please choose an option in each dropdown.');

      if(name) name.value = name.value.trim();          /* drop stray whitespace */
      if(company) company.value = company.value.trim();
      if(email) email.value = email.value.trim();

      var data = new FormData(f);
      data.append('wb_ajax','1');

      clear();
      f.classList.add('is-busy');
      btn.disabled = true;
      btn.textContent = 'Sending…';

      /* getAttribute, not f.action: the form carries <input name="action"> for
         admin-post routing, and a control named "action" shadows the form's own
         action property (HTMLFormElement is [LegacyOverrideBuiltIns]). f.action
         returns that input element, which stringifies to "[object HTMLInputElement]"
         and posts to a nonexistent path - a 404 on every submit. */
      var endpoint = f.getAttribute('action') || window.location.href;

      fetch(endpoint, {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
        headers: {'X-Requested-With':'XMLHttpRequest'}
      })
      /* Read as text first. A security plugin or a redirect answers with HTML, and
         r.json() would throw - which would surface as "Network error" even though
         the network was fine. Tell those apart and log the real reason. */
      .then(function(r){
        return r.text().then(function(body){ return {status: r.status, body: body}; });
      })
      .then(function(res){
        var parsed = null;
        try{ parsed = JSON.parse(res.body); }catch(err){}
        if(parsed && typeof parsed.ok !== 'undefined'){
          say(!!parsed.ok, parsed.message || 'Something went wrong. Please try again.');
          if(parsed.ok) f.reset();
          return;
        }
        console.warn('[axiora] lead: HTTP ' + res.status + ', unexpected reply:', res.body.slice(0, 300));
        say(false, res.status >= 400
          ? 'The server refused the request (' + res.status + '). Please try again later.'
          : 'We could not send that just now. Please call +91 8122784236.');
      })
      .catch(function(err){
        console.warn('[axiora] lead request failed:', err);
        say(false, 'Could not reach the server. Please check your connection.');
      })
      .then(function(){
        f.classList.remove('is-busy');
        btn.disabled = false;
        btn.innerHTML = label;
      });
    });
  });
})();
