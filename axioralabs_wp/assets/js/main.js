
(function(){
  // nav shadow
  var nav=document.getElementById('nav');
  addEventListener('scroll',function(){nav.classList.toggle('scrolled',scrollY>10);},{passive:true});
  // mobile menu
  var burger=document.getElementById('burger'),mm=document.getElementById('mobile-menu');
  burger.addEventListener('click',function(){var o=mm.classList.toggle('open');burger.setAttribute('aria-expanded',o?'true':'false');});
  mm.addEventListener('click',function(e){if(e.target.closest('a'))mm.classList.remove('open');});
  Array.prototype.forEach.call(document.querySelectorAll('.m-acc-btn'),function(btn){
    btn.addEventListener('click',function(){
      var li=btn.parentElement,panel=li.querySelector('.m-panel');
      var open=li.classList.toggle('open');
      btn.setAttribute('aria-expanded',open?'true':'false');
      panel.style.maxHeight=open?panel.scrollHeight+'px':'0px';
    });
  });

  // rotating word
  var words=['Operations','Workflows','Processes','Decisions','Productivity','Growth'],ri=0,el=document.getElementById('rot');
  if(el&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    setInterval(function(){ri=(ri+1)%words.length;el.style.transition='opacity .3s';el.style.opacity='0';
      setTimeout(function(){el.textContent=words[ri];el.style.opacity='1';},300);},2200);
  }

  // hero product showcase — swipe/drag slider (finger swipe on mobile, drag on desktop), auto-advance pauses on interaction
  (function(){
    var show=document.getElementById('heroShow'),track=document.getElementById('hsTrack'),nav=document.getElementById('hsNav');
    if(!show||!track||!nav)return;
    var slides=track.querySelectorAll('.hs-slide'),dots=nav.querySelectorAll('button'),timer=null,DUR=4200;
    function step(){return slides.length>1?(slides[1].offsetLeft-slides[0].offsetLeft):track.clientWidth;}
    function idx(){return Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft/step())));}
    function goto(i){track.scrollTo({left:i*step(),behavior:'smooth'});}
    function paint(){var i=idx();for(var d=0;d<dots.length;d++)dots[d].classList.toggle('on',d===i);}
    function next(){goto((idx()+1)%slides.length);}
    function start(){if(timer||matchMedia('(prefers-reduced-motion:reduce)').matches)return;timer=setInterval(next,DUR);}
    function stop(){clearInterval(timer);timer=null;}
    var st;track.addEventListener('scroll',function(){paint();clearTimeout(st);},{passive:true});
    for(var d=0;d<dots.length;d++)(function(k){dots[k].addEventListener('click',function(){goto(k);stop();clearTimeout(st);st=setTimeout(start,3500);});})(d);
    show.addEventListener('mouseenter',stop);
    show.addEventListener('mouseleave',function(){clearTimeout(st);st=setTimeout(start,600);});
    // desktop click-drag to slide
    var down=false,sx=0,sl=0,moved=false;
    track.addEventListener('mousedown',function(e){down=true;moved=false;sx=e.pageX;sl=track.scrollLeft;track.classList.add('drag');stop();});
    window.addEventListener('mousemove',function(e){if(!down)return;var dx=e.pageX-sx;if(Math.abs(dx)>5)moved=true;track.scrollLeft=sl-dx;});
    window.addEventListener('mouseup',function(){if(!down)return;down=false;track.classList.remove('drag');goto(idx());clearTimeout(st);st=setTimeout(start,3000);});
    track.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();}},true);
    // touch: native swipe, just manage auto-advance
    track.addEventListener('touchstart',function(){stop();},{passive:true});
    track.addEventListener('touchend',function(){clearTimeout(st);st=setTimeout(start,3500);},{passive:true});
    paint();start();
  })();

  // scroll animations — re-trigger both directions (down & up)
  function startCount(n){
    if(n._raf)return;
    var target=+n.getAttribute('data-count'),dur=1400,st=null;
    function step(ts){if(!st)st=ts;var p=Math.min((ts-st)/dur,1);
      n.textContent=Math.floor((1-Math.pow(1-p,3))*target);
      if(p<1)n._raf=requestAnimationFrame(step);else{n.textContent=target;n._raf=null;}}
    n._raf=requestAnimationFrame(step);
  }
  function resetCount(n){if(n._raf){cancelAnimationFrame(n._raf);n._raf=null;}n.textContent='0';}
  var io=new IntersectionObserver(function(es){es.forEach(function(en){
    var t=en.target;
    if(en.isIntersecting){
      t.classList.add('in');
      if(t.id==='timeline')t.classList.add('run');
      if(t.classList.contains('console'))t.classList.add('play');
      t.querySelectorAll('[data-count]').forEach(startCount);
    }else{
      t.classList.remove('in');
      if(t.id==='timeline')t.classList.remove('run');
      if(t.classList.contains('console'))t.classList.remove('play');
      t.querySelectorAll('[data-count]').forEach(resetCount);
    }
  });},{threshold:.12,rootMargin:'-8% 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){
    var sibs=el.parentElement.querySelectorAll(':scope > .reveal');
    if(sibs.length>1){var i=[].indexOf.call(sibs,el);el.style.transitionDelay=(i*70)+'ms';}
    io.observe(el);
  });
  var tl=document.getElementById('timeline');if(tl)io.observe(tl);
  document.querySelectorAll('.console').forEach(function(el){io.observe(el);});

  // tabs
  document.querySelectorAll('.tab-btn').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.tab-btn').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('.tab-panel').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active');document.getElementById(b.getAttribute('data-tab')).classList.add('active');
  });});

  // faq
  document.querySelectorAll('.faq-q').forEach(function(q){q.addEventListener('click',function(){
    var it=q.parentElement,a=q.nextElementSibling,open=it.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(function(x){x.classList.remove('open');x.querySelector('.faq-a').style.maxHeight=null;});
    if(!open){it.classList.add('open');a.style.maxHeight=a.scrollHeight+'px';}
  });});

  // carousels
  document.querySelectorAll('.carousel').forEach(function(car){
    var track=car.querySelector('.track'),prev=car.querySelector('.prev'),next=car.querySelector('.next');
    function amt(){var c=track.querySelector('*');return c?c.getBoundingClientRect().width+24:320;}
    function upd(){prev.disabled=track.scrollLeft<8;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-8;}
    prev.addEventListener('click',function(){track.scrollBy({left:-amt(),behavior:'smooth'});});
    next.addEventListener('click',function(){track.scrollBy({left:amt(),behavior:'smooth'});});
    track.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);setTimeout(upd,100);
  });
})();
