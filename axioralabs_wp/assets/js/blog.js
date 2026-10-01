/* Blog behaviour — reading progress, table of contents, newsletter signup.
   Loaded on posts, the blog index, archives and search. Everything here is
   progressive: with JS off the contents list is still a list of anchors and the
   signup form still posts to admin-post.php. */
(function(){
  var d = document, mqSmall = '(max-width:1040px)';

  /* ---------- reading progress ---------- */
  (function(){
    var bar = d.querySelector('.read-bar span'), art = d.querySelector('.article-main') || d.querySelector('.post-body');
    if(!bar || !art) return;
    function tick(){
      var r = art.getBoundingClientRect(), run = r.height - innerHeight;
      var p = run > 0 ? Math.min(Math.max(-r.top / run, 0), 1) : (r.top < 0 ? 1 : 0);
      bar.style.transform = 'scaleX(' + p + ')';
    }
    addEventListener('scroll', tick, {passive:true});
    addEventListener('resize', tick);
    tick();
  })();

  /* ---------- table of contents ---------- */
  (function(){
    var card = d.getElementById('toc');
    if(!card) return;
    var head = card.querySelector('.toc-head'), list = card.querySelector('.toc-list');
    if(!head || !list) return;

    function setOpen(open){
      card.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(!open) card.classList.remove('has-more');
      setTimeout(edge, 340);   /* edge() is hoisted — declared below */
    }
    /* open on desktop, folded away on phones so it does not push the article down */
    setOpen(!matchMedia(mqSmall).matches);
    head.addEventListener('click', function(){ setOpen(!card.classList.contains('is-open')); });

    /* fade the bottom edge only while there is more list to scroll to */
    function edge(){
      var more = list.scrollHeight - list.clientHeight - list.scrollTop > 4;
      card.classList.toggle('has-more', more && card.classList.contains('is-open'));
    }
    list.addEventListener('scroll', edge, {passive:true});
    addEventListener('resize', edge);
    setTimeout(edge, 350);   /* after the open/close transition settles */
    edge();

    var links = [].slice.call(list.querySelectorAll('a[href^="#"]'));
    var heads = links.map(function(a){
      var id = a.getAttribute('href').slice(1);
      try{ id = decodeURIComponent(id); }catch(e){}
      return d.getElementById(id);
    });

    /* scroll the active entry into view without moving the page */
    function keepVisible(a){
      if(list.scrollHeight <= list.clientHeight) return;
      var lr = list.getBoundingClientRect(), ar = a.getBoundingClientRect();
      if(ar.top < lr.top + 6) list.scrollTop += ar.top - lr.top - 6;
      else if(ar.bottom > lr.bottom - 6) list.scrollTop += ar.bottom - lr.bottom + 6;
    }

    var current = -1;
    function spy(){
      var line = scrollY + 130, at = -1;
      for(var i = 0; i < heads.length; i++){
        var h = heads[i];
        if(h && h.getBoundingClientRect().top + scrollY <= line) at = i;
      }
      /* last section: highlight it once the page bottom is reached */
      if(at < heads.length - 1 && innerHeight + scrollY >= d.body.scrollHeight - 4) at = heads.length - 1;
      if(at === current) return;
      current = at;
      for(var k = 0; k < links.length; k++) links[k].classList.toggle('is-active', k === at);
      if(at > -1 && card.classList.contains('is-open')) keepVisible(links[at]);
    }
    addEventListener('scroll', spy, {passive:true});
    addEventListener('resize', spy);
    spy();

    /* on phones the list overlays the top of the article — close it after a jump */
    links.forEach(function(a){
      a.addEventListener('click', function(){ if(matchMedia(mqSmall).matches) setOpen(false); });
    });
  })();

  /* ---------- newsletter signup ---------- */
  (function(){
    if(!window.fetch || !window.FormData) return;   /* plain POST still works */
    var forms = d.querySelectorAll('.news-form');
    Array.prototype.forEach.call(forms, function(f){
      var msg = f.querySelector('.news-msg'),
          btn = f.querySelector('button[type=submit]'),
          email = f.querySelector('input[type=email]');
      if(!msg || !btn) return;

      function say(ok, text){
        f.classList.remove('is-ok','is-err','is-busy');
        f.classList.add(ok ? 'is-ok' : 'is-err');
        msg.textContent = text;
      }

      /* clear the red state as soon as they start correcting it */
      if(email) email.addEventListener('input', function(){
        if(f.className.indexOf('is-') === -1) return;
        f.classList.remove('is-ok','is-err');
        msg.textContent = '';
      });

      f.addEventListener('submit', function(e){
        e.preventDefault();   /* the form is novalidate, so every case is ours to answer */

        var value = email ? email.value.trim() : '';
        if(!value){
          say(false, 'Please enter your email address.');
          email.focus();
          return;
        }
        if(!email.checkValidity()){
          say(false, 'That does not look like a valid email address.');
          email.focus();
          email.select();
          return;
        }

        email.value = value;   /* drop stray whitespace before it is posted */

        var data = new FormData(f);
        data.append('wb_ajax','1');
        var label = btn.innerHTML;   /* innerHTML, not text — the band button holds an icon */
        f.classList.remove('is-ok','is-err');
        f.classList.add('is-busy');
        msg.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Subscribing…';

        /* getAttribute, not f.action: the form carries <input name="action"> for
           admin-post routing, and a control named "action" shadows the form's own
           action property (HTMLFormElement is [LegacyOverrideBuiltIns]). f.action
           returns that input element, which stringifies to "[object HTMLInputElement]"
           and posts to a nonexistent path — a 404 on every submit. */
        var endpoint = f.getAttribute('action') || window.location.href;

        fetch(endpoint, {
          method: 'POST',
          body: data,
          credentials: 'same-origin',
          headers: {'X-Requested-With':'XMLHttpRequest'}
        })
        /* Read as text first. A security plugin or a redirect answers with HTML, and
           r.json() would throw — which used to surface as "Network error" even though
           the network was fine. Tell those apart and log the real reason. */
        .then(function(r){
          return r.text().then(function(body){ return {status: r.status, body: body}; });
        })
        .then(function(res){
          var parsed = null;
          try{ parsed = JSON.parse(res.body); }catch(err){}
          if(parsed && typeof parsed.ok !== 'undefined'){
            say(!!parsed.ok, parsed.message || 'Something went wrong. Please try again.');
            if(parsed.ok && email) email.value = '';
            return;
          }
          console.warn('[axiora] subscribe: HTTP ' + res.status + ', unexpected reply:', res.body.slice(0, 300));
          say(false, res.status >= 400
            ? 'The server refused the request (' + res.status + '). Please try again later.'
            : 'We could not save that just now. Please try again.');
        })
        .catch(function(err){
          console.warn('[axiora] subscribe request failed:', err);
          say(false, 'Could not reach the server. Please check your connection.');
        })
        .then(function(){
          btn.disabled = false;
          btn.innerHTML = label;
        });
      });
    });
  })();
})();
