/* The page is clay: its letters, cards and chips answer to Asterra's own brushes. Shapes keep where you leave them
 * (clay) and wobble on the way there (jelly). Nothing is split or measured until someone first picks up a tool. */
(function(){
  'use strict';
  var LETTERS='.hero h1,.hero .lede,.hero-note,.head .eyebrow,.head h2,.head .lede,.exact-copy p,.closing h2,.closing .lede';
  var BODIES='.brand,.links,.version,.hero-cta .btn,.keys .key,.ladder li,.card,.pipe,.stat,.closing,.closing .btn,.system,footer .wrap>span';
  var TOOLS={
    grab:{name:'Grab',tip:'drag to carry the page like clay · flick to throw',hue:'#a3e6c0'},
    scatter:{name:'Scatter',tip:'hold to push things apart · Shift gathers',hue:'#ff9ecb'},
    gather:{name:'Gather',tip:'hold to pull things together · Shift scatters',hue:'#6fb6ff'},
    swirl:{name:'Swirl',tip:'hold to stir · Shift turns the other way',hue:'#b9a4ff'},
    raise:{name:'Raise',tip:'hold to lift things toward you · Shift lowers',hue:'#ffd58a'},
    smooth:{name:'Smooth',tip:'hold to settle things back where they were',hue:'#8ad7d0'},
    quake:{name:'Quake',tip:'hold to shake things loose',hue:'#ffb46b'},
    hole:{name:'Black hole',tip:'hold to swallow things · Shift spits them out',hue:'#8e7dff'},
    meteor:{name:'Meteor',tip:'click to strike · hold for a meteor shower',hue:'#ff7a59'},
    paint:{name:'Paint',tip:'hold to paint in shifting colors · Shift washes it off',hue:'#ff9ecb'}
  };
  var ORDER=['grab','scatter','gather','swirl','raise','smooth','quake','hole','meteor','paint'];
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(id){return document.getElementById(id);};
  var dock=$('clay-dock'),openBtn=$('clay-open'),panel=$('clay-tools'),ring=$('clay-ring'),size=$('clay-size');
  var pieces=[],active=new Set(),shocks=[],ready=false,on=false,tool='grab',R=+size.value,ringR=0,down=null,shift=false,raf=0,last=0,undo=[],redo=[],pointer={x:-1e4,y:-1e4};
  var N=5;// tx, ty, tr, ts, hue per piece in a snapshot

  // Splitting: each word stays whole on its line; each letter becomes its own piece. Screen readers get the text once.
  function split(el){
    var text=el.textContent.replace(/\s+/g,' ').trim(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      if(!n.nodeValue.trim())return;
      var frag=document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(function(part){
        if(!part)return;
        if(/^\s+$/.test(part)){frag.appendChild(document.createTextNode(' '));return;}
        var w=document.createElement('span');w.className='cw';w.setAttribute('aria-hidden','true');
        Array.from(part).forEach(function(ch){var c=document.createElement('span');c.className='cl';c.textContent=ch;w.appendChild(c);});
        frag.appendChild(w);
      });
      n.parentNode.replaceChild(frag,n);
    });
    var sr=document.createElement('span');sr.className='sr-only';sr.textContent=text;el.insertBefore(sr,el.firstChild);
  }
  function piece(el,letter){return {el:el,letter:letter,rx:0,ry:0,w:0,h:0,hidden:false,tx:0,ty:0,tr:0,ts:1,hue:-1,cx:0,cy:0,cr:0,cs:1,vx:0,vy:0,vr:0,vs:0,seed:Math.random(),_t:'',_o:'',_s:'',_z:'',_h:-1};}
  function prepare(){
    if(ready)return;ready=true;
    document.querySelectorAll(LETTERS).forEach(split);
    // Gradient text is painted per letter, so each letter carries its own slice of the gradient when it moves.
    var grads=[];
    document.querySelectorAll(LETTERS).forEach(function(root){
      [root].concat(Array.from(root.querySelectorAll('*:not(.cl):not(.cw):not(.sr-only)'))).forEach(function(g){
        var cs=getComputedStyle(g);if(cs.webkitBackgroundClip==='text'||cs.backgroundClip==='text')grads.push([g,cs.backgroundImage]);
      });
    });
    grads.forEach(function(x){x[0].dataset.clayGrad=x[1];x[0].classList.add('clay-grad');});
    document.querySelectorAll('.cl').forEach(function(el){pieces.push(piece(el,true));});
    document.querySelectorAll(BODIES).forEach(function(el){pieces.push(piece(el,false));});
    // A piece inside another (the closing card's words and button) rides on it: its own shape is kept in the card's frame.
    var byEl=new Map();pieces.forEach(function(p){byEl.set(p.el,p);});
    pieces.forEach(function(p){for(var a=p.el.parentElement;a&&a!==document.body;a=a.parentElement){var q=byEl.get(a);if(q){p.parent=q;break;}}});
    measure();
    addEventListener('resize',function(){clearTimeout(prepare.t);prepare.t=setTimeout(measure,150);});
  }
  function measure(){
    pieces.forEach(function(p){p.el.style.transform='none';p._t='none';});
    var sx=scrollX,sy=scrollY;
    pieces.forEach(function(p){var r=p.el.getBoundingClientRect();p.w=r.width;p.h=r.height;p.hidden=!r.width||!r.height;p.rx=r.left+sx+r.width/2;p.ry=r.top+sy+r.height/2;});
    document.querySelectorAll('.clay-grad').forEach(function(g){
      var gr=g.getBoundingClientRect();
      g.querySelectorAll('.cl').forEach(function(c){var r=c.getBoundingClientRect();
        c.style.backgroundImage=g.dataset.clayGrad;c.style.backgroundSize=gr.width+'px '+gr.height+'px';c.style.backgroundPosition=(gr.left-r.left)+'px '+(gr.top-r.top)+'px';});
    });
    pieces.forEach(paint);
  }
  // Only what changed is written, so a still piece costs nothing.
  function paint(p){
    var s=p.el.style,lift=p.cs-1,moved=Math.abs(p.cx)>.05||Math.abs(p.cy)>.05||Math.abs(p.cr)>.001||Math.abs(lift)>.001;
    var t=moved?'translate('+p.cx.toFixed(1)+'px,'+p.cy.toFixed(1)+'px) rotate('+p.cr.toFixed(3)+'rad) scale('+p.cs.toFixed(3)+')':'';
    if(t!==p._t){s.transform=t;p._t=t;}
    var o=lift<-.01?Math.max(.25,.35+.65*p.cs).toFixed(2):'';
    if(o!==p._o){s.opacity=o;p._o=o;}
    if(p.letter){var sh=lift>.04?'0 '+Math.min(8,Math.round(lift*4))+'px 0 rgba(0,0,0,.35)':'';if(sh!==p._s){s.textShadow=sh;p._s=sh;}}
    var z=lift>.02?'2':'';if(z!==p._z){s.zIndex=z;p._z=z;}
  }
  function tint(p){
    if(p.hue===p._h)return;p._h=p.hue;var s=p.el.style;
    if(p.hue<0){if(p.letter)s.removeProperty('-webkit-text-fill-color');else{s.backgroundColor='';s.borderColor='';}return;}
    var h=Math.round(p.hue);
    if(p.letter)s.setProperty('-webkit-text-fill-color','hsl('+h+' 85% 72%)');
    else{s.backgroundColor='hsl('+h+' 55% 26% / .62)';s.borderColor='hsl('+h+' 80% 70% / .6)';}
  }

  // Springs: what you see eases to the clay's shape with a little overshoot. One frame loop at a time.
  function wake(p){if(reduced){p.cx=p.tx;p.cy=p.ty;p.cr=p.tr;p.cs=p.ts;p.vx=p.vy=p.vr=p.vs=0;paint(p);return;}active.add(p);run();}
  function run(){if(!raf){last=performance.now();raf=requestAnimationFrame(step);}}
  function step(now){
    var dt=Math.min(.033,Math.max(.001,(now-last)/1000));last=now;
    if(down)apply(dt);
    if(shocks.length)waves(dt);
    var K=190,D=15;
    active.forEach(function(p){
      p.vx+=(K*(p.tx-p.cx)-D*p.vx)*dt;p.vy+=(K*(p.ty-p.cy)-D*p.vy)*dt;p.vr+=(K*(p.tr-p.cr)-D*p.vr)*dt;p.vs+=(K*(p.ts-p.cs)-D*p.vs)*dt;
      p.cx+=p.vx*dt;p.cy+=p.vy*dt;p.cr+=p.vr*dt;p.cs+=p.vs*dt;
      if(Math.abs(p.tx-p.cx)+Math.abs(p.ty-p.cy)<.05&&Math.abs(p.vx)+Math.abs(p.vy)<.05&&Math.abs(p.tr-p.cr)+Math.abs(p.ts-p.cs)<.0005&&Math.abs(p.vr)+Math.abs(p.vs)<.0005){
        p.cx=p.tx;p.cy=p.ty;p.cr=p.tr;p.cs=p.ts;p.vx=p.vy=p.vr=p.vs=0;active.delete(p);}
      paint(p);
    });
    raf=(down||active.size||shocks.length)?requestAnimationFrame(step):0;
  }

  // Where a piece is on the page, through the card it rides on; and a page-space push turned into that card's frame.
  function world(p){
    var x=p.rx+p.tx,y=p.ry+p.ty,q=p.parent;if(!q)return [x,y];
    var dx=x-q.rx,dy=y-q.ry,c=Math.cos(q.tr),s=Math.sin(q.tr);
    return [q.rx+q.tx+(dx*c-dy*s)*q.ts,q.ry+q.ty+(dx*s+dy*c)*q.ts];
  }
  function local(p,vx,vy){var q=p.parent;if(!q)return [vx,vy];var c=Math.cos(q.tr),s=Math.sin(q.tr);return [(vx*c+vy*s)/q.ts,(vy*c-vx*s)/q.ts];}
  function nudge(p,vx,vy){var v=local(p,vx,vy);p.tx+=v[0];p.ty+=v[1];}
  function kick(p,vx,vy){var v=local(p,vx,vy);p.vx+=v[0];p.vy+=v[1];}

  // Brushes, in page coordinates. Big bodies are heavier and are reached from their edge, not their centre.
  function reach(p,x,y,r){
    r=r||R;var W=world(p),px=W[0],py=W[1],d;
    if(p.letter)d=Math.hypot(px-x,py-y);
    else{var hw=p.w*p.ts/2,hh=p.h*p.ts/2,dx=Math.max(Math.abs(x-px)-hw,0),dy=Math.max(Math.abs(y-py)-hh,0);d=Math.hypot(dx,dy);}
    if(d>=r)return 0;var q=1-(d/r)*(d/r);return q*q*(p.letter?1:.55);
  }
  function here(){return {x:pointer.x+scrollX,y:pointer.y+scrollY};}
  function apply(dt){
    var at=here(),t=tool,sign=shift?-1:1;
    var fx=(at.x-down.px)/dt,fy=(at.y-down.py)/dt;down.vx=down.vx*.55+fx*.45;down.vy=down.vy*.55+fy*.45;down.px=at.x;down.py=at.y;
    if(t==='grab'){down.held.forEach(function(h){var p=h.p,v=local(p,(at.x-down.x)*h.w,(at.y-down.y)*h.w);p.tx=h.tx+v[0];p.ty=h.ty+v[1];p.tr=h.tr+(at.x-down.x)*h.w*.0008;wake(p);});return;}
    if(t==='meteor'){down.cool-=dt;if(down.cool<=0){var ja=Math.random()*6.283,jm=Math.sqrt(Math.random())*R*.6;strike({x:at.x+Math.cos(ja)*jm,y:at.y+Math.sin(ja)*jm},R*.75);down.cool=.2;}return;}
    if(t==='paint'){down.hue=(down.hue+dt*110)%360;if(!shift)ring.style.setProperty('--tool','hsl('+Math.round(down.hue)+' 85% 72%)');}
    if(t==='scatter'&&shift)t='gather';else if(t==='gather'&&shift)t='scatter';
    pieces.forEach(function(p){
      if(p.hidden)return;var w=reach(p,at.x,at.y);if(!w)return;
      var W=world(p),dx=W[0]-at.x,dy=W[1]-at.y,d=Math.hypot(dx,dy);
      if(d<1){dx=Math.cos(p.seed*6.28);dy=Math.sin(p.seed*6.28);d=1;}
      if(t==='paint'){if(w>.12){p.hue=shift?-1:(down.hue+(p.rx+p.ry)*.04)%360;tint(p);}return;}
      if(t==='scatter'){var push=w*R*2.4*dt;nudge(p,dx/d*push,dy/d*push);p.tr+=(p.seed-.5)*w*dt*2;}
      else if(t==='gather'){var k=Math.min(1,w*dt*3.2);nudge(p,-dx*k,-dy*k);}
      else if(t==='swirl'){var a=sign*2.8*w*dt,c=Math.cos(a),s=Math.sin(a);nudge(p,dx*c-dy*s-dx,dx*s+dy*c-dy);p.tr+=a;}
      else if(t==='raise'){p.ts=Math.min(4,Math.max(.2,p.ts*Math.exp(sign*1.7*w*dt)));}
      else if(t==='smooth'){var m=Math.min(1,w*dt*3.5);p.tx-=p.tx*m;p.ty-=p.ty*m;p.tr-=p.tr*m;p.ts+=(1-p.ts)*m;}
      else if(t==='quake'){var j=w*dt*R*1.3;p.tx+=(Math.random()-.5)*j;p.ty+=(Math.random()-.5)*j;p.tr+=(Math.random()-.5)*w*dt*1.4;p.vx+=(Math.random()-.5)*w*1100;p.vy+=(Math.random()-.5)*w*1100;}
      else if(t==='hole'){
        if(sign>0){var g=Math.min(1,w*dt*2.4),a2=3.4*w*dt,c2=Math.cos(a2),s2=Math.sin(a2);
          nudge(p,(dx*c2-dy*s2)*(1-g)-dx,(dx*s2+dy*c2)*(1-g)-dy);p.tr+=a2*2.5;p.ts=Math.max(.1,p.ts*Math.exp(-1.8*w*dt));}
        else{var out=w*R*3*dt;nudge(p,dx/d*out,dy/d*out);p.tr-=w*dt*3;p.ts+=(1-p.ts)*Math.min(1,w*dt*2.5);}
      }
      wake(p);
    });
  }
  // Meteor: a crater where it lands, then a shockwave that bumps everything it passes and lets it spring back.
  // The page shakes with the size of the hit, and the crater glows for a while before it cools.
  var craters=[];
  function strike(at,r){
    r=r||R;
    pieces.forEach(function(p){
      if(p.hidden)return;var w=reach(p,at.x,at.y,r);if(!w)return;
      var W=world(p),dx=W[0]-at.x,dy=W[1]-at.y,d=Math.hypot(dx,dy);if(d<1){dx=Math.cos(p.seed*6.28);dy=Math.sin(p.seed*6.28);d=1;}
      nudge(p,dx/d*w*r*.9,dy/d*w*r*.9);p.ts=Math.max(.3,p.ts*(1-.4*w));p.tr+=(p.seed-.5)*w*1.6;kick(p,dx/d*w*1400,dy/d*w*1400);wake(p);
    });
    var wave={x:at.x,y:at.y,r:r*.8,max:r*4.5,speed:1100,hit:new Set()};shocks.push(wave);run();
    if(reduced)return;
    var b=document.createElement('div');b.className='clay-boom';b.style.left=at.x+'px';b.style.top=at.y+'px';
    b.style.setProperty('--r',r+'px');b.style.setProperty('--max',wave.max+'px');b.style.setProperty('--dur',((wave.max-wave.r)/wave.speed).toFixed(2)+'s');
    document.body.appendChild(b);setTimeout(function(){b.remove();},1200);
    var c=document.createElement('div');c.className='clay-crater';c.style.left=at.x+'px';c.style.top=at.y+'px';c.style.setProperty('--r',(r*.85).toFixed(0)+'px');
    document.body.appendChild(c);craters.push(c);if(craters.length>30)craters.shift().remove();
    setTimeout(function(){var i=craters.indexOf(c);if(i>=0)craters.splice(i,1);c.remove();},8000);
    shake(r);
  }
  var shakeEls=null;
  function shake(r){
    if(!document.body.animate)return;shakeEls=shakeEls||document.querySelectorAll('header,main,footer');
    var amp=Math.min(16,3+r/11),frames=[];
    for(var i=0;i<=8;i++){var f=1-i/8,a=amp*f*f;frames.push({transform:i===8?'none':'translate('+((Math.random()-.5)*2*a).toFixed(1)+'px,'+((Math.random()-.5)*2*a).toFixed(1)+'px)'});}
    shakeEls.forEach(function(el){if(el._shake)el._shake.cancel();el._shake=el.animate(frames,{duration:360,easing:'linear'});});
  }
  function waves(dt){
    for(var i=shocks.length-1;i>=0;i--){var s=shocks[i],r0=s.r;s.r+=s.speed*dt;var f=Math.max(0,1-s.r/s.max);
      pieces.forEach(function(p){
        if(p.hidden||s.hit.has(p))return;var W=world(p),dx=W[0]-s.x,dy=W[1]-s.y,d=Math.hypot(dx,dy);if(d<r0||d>s.r)return;
        s.hit.add(p);var k=650*f/(d||1);kick(p,dx*k,dy*k);p.vs+=.8*f;wake(p);
      });
      if(s.r>=s.max)shocks.splice(i,1);}
  }
  // Grab: letting go mid-flick throws what you held.
  function fling(){
    var v=Math.hypot(down.vx,down.vy);if(v<260||!down.held.length)return;
    var sc=Math.min(1,2600/v),fx=down.vx*sc,fy=down.vy*sc;
    down.held.forEach(function(h){var p=h.p;nudge(p,fx*h.w*.16,fy*h.w*.16);p.tr+=(p.seed-.5)*h.w*.6;kick(p,fx*h.w*.5,fy*h.w*.5);wake(p);});
  }

  // History: one undo per stroke, and for a reset.
  function snap(){var a=new Float32Array(pieces.length*N);pieces.forEach(function(p,i){var o=i*N;a[o]=p.tx;a[o+1]=p.ty;a[o+2]=p.tr;a[o+3]=p.ts;a[o+4]=p.hue;});return a;}
  function load(a){pieces.forEach(function(p,i){var o=i*N;p.tx=a[o];p.ty=a[o+1];p.tr=a[o+2];p.ts=a[o+3];p.hue=a[o+4];tint(p);wake(p);});}
  function remember(){undo.push(snap());if(undo.length>60)undo.shift();redo.length=0;buttons();}
  function back(){if(!undo.length)return;redo.push(snap());load(undo.pop());buttons();}
  function forward(){if(!redo.length)return;undo.push(snap());load(redo.pop());buttons();}
  function reset(){if(!pieces.some(function(p){return p.tx||p.ty||p.tr||p.ts!==1||p.hue>=0;}))return;remember();pieces.forEach(function(p){p.tx=p.ty=p.tr=0;p.ts=1;p.hue=-1;tint(p);wake(p);});}
  function buttons(){$('clay-undo').disabled=!undo.length;$('clay-redo').disabled=!redo.length;}
  function same(a,b){for(var i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1e-4)return false;return true;}

  // Input: while sculpting, a press on the page is a stroke, not a click. Only the dock stays live.
  function free(el){return !el||dock.contains(el);}
  document.addEventListener('pointerdown',function(e){
    if(!on||e.button!==0||free(e.target))return;
    e.preventDefault();e.stopPropagation();
    pointer.x=e.clientX;pointer.y=e.clientY;shift=e.shiftKey;remember();
    var at=here();down={x:at.x,y:at.y,px:at.x,py:at.y,vx:0,vy:0,id:e.pointerId,held:[],hue:(performance.now()/20)%360,cool:.35};
    if(tool==='grab')pieces.forEach(function(p){if(p.hidden)return;var w=reach(p,at.x,at.y);if(w)down.held.push({p:p,w:w,tx:p.tx,ty:p.ty,tr:p.tr});});
    if(tool==='meteor')strike(at);
    try{e.target.setPointerCapture(e.pointerId);}catch(err){}
    showRing(true);run();
  },true);
  addEventListener('pointermove',function(e){pointer.x=e.clientX;pointer.y=e.clientY;shift=e.shiftKey;if(on)showRing(!free(e.target)||!!down);},true);
  function end(e){
    if(!down||(e&&e.pointerId!==down.id))return;
    if(tool==='grab')fling();
    if(tool==='paint')ring.style.setProperty('--tool',TOOLS.paint.hue);
    down=null;if(undo.length&&same(undo[undo.length-1],snap()))undo.pop();buttons();
  }
  addEventListener('pointerup',end,true);addEventListener('pointercancel',end,true);
  document.addEventListener('click',function(e){if(on&&!free(e.target)){e.preventDefault();e.stopPropagation();}},true);
  addEventListener('keydown',function(e){
    shift=e.shiftKey;if(!on||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    var k=e.key;
    if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='Z')){e.preventDefault();e.shiftKey?forward():back();return;}
    if((e.ctrlKey||e.metaKey)&&(k==='y'||k==='Y')){e.preventDefault();forward();return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='Escape'){close();return;}
    if(k>='0'&&k<='9'){pick(ORDER[(+k+9)%10]);return;}
    if(k==='['||k===']'){size.value=+size.value+(k===']'?15:-15);sized();}
  });
  addEventListener('keyup',function(e){shift=e.shiftKey;});
  addEventListener('scroll',function(){if(on&&!ring.hidden)place();},{passive:true});

  // The brush ring follows the pointer in the tool's colour and look.
  function place(){ring.style.transform='translate3d('+(pointer.x-R)+'px,'+(pointer.y-R)+'px,0)';}
  function showRing(v){if(ring.hidden===v)ring.hidden=!v;if(ringR!==R){ring.style.width=ring.style.height=R*2+'px';ringR=R;}place();}

  // The dock.
  function pick(id){tool=id;var t=TOOLS[id];$('clay-name').textContent=t.name;$('clay-tip').textContent=t.tip;dock.style.setProperty('--tool',t.hue);ring.style.setProperty('--tool',t.hue);ring.dataset.tool=id;
    panel.querySelectorAll('[data-tool]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.tool===id));});}
  function sized(){R=Math.max(30,Math.min(260,+size.value));size.value=R;size.style.setProperty('--f',((R-30)/230*100).toFixed(1)+'%');if(!ring.hidden)showRing(true);}
  function open(){prepare();on=true;document.documentElement.classList.add('sculpting');panel.hidden=false;openBtn.setAttribute('aria-expanded','true');dock.classList.add('open');pick(tool);sized();buttons();}
  function close(){on=false;down=null;document.documentElement.classList.remove('sculpting');panel.hidden=true;ring.hidden=true;openBtn.setAttribute('aria-expanded','false');dock.classList.remove('open');}
  openBtn.addEventListener('click',function(){on?close():open();});
  document.querySelectorAll('[data-clay-open]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();if(!on)open();});});
  panel.querySelectorAll('[data-tool]').forEach(function(b){b.addEventListener('click',function(){pick(b.dataset.tool);});});
  size.addEventListener('input',sized);
  $('clay-undo').addEventListener('click',back);$('clay-redo').addEventListener('click',forward);$('clay-reset').addEventListener('click',reset);$('clay-done').addEventListener('click',close);
  // The floating button tucks away while the hero's own button is on screen.
  var hero=document.querySelector('.hero-cta .btn');
  if(hero&&'IntersectionObserver' in window)new IntersectionObserver(function(es){dock.classList.toggle('tucked',es[0].isIntersecting);}).observe(hero);
  sized();
})();
