/*
 * MIT License
 * Copyright (c) 2026 Joe Paredes
 * https://github.com/robotismo/art-sims
 */
// murmuration: a port of robotismo/art-sims, commit
// 28b1155fb59aeec01272dec55e96be25b3646e08, 13-murmuration/index.html.
// Reynolds boids on a 2D canvas: separation, alignment and cohesion found
// through a uniform spatial-hash grid, a hawk that wanders (or follows the
// pointer) and scatters the flock, depth-tinted streaks from emerald to gold
// over a translucent wash that leaves motion-blur trails.
//
// Seams, and nothing else: the page script runs inside mount() so every
// section owns its flock; the canvas is the section's own; the count,
// cohesion, alignment and hawk controls are mount options and update()
// does what their handlers did; the play/pause button, Regenerate, Save
// PNG and the window.__sim hook are gone; pointer listeners carry an
// AbortSignal so destroy() can drop them. Under prefers-reduced-motion
// upstream already settles the flock and holds one still frame.

export const meta = {
  name: "murmuration",
  version: "1.0.0",
  category: "particles",
  needs: [],
  license: "MIT",
  options: {
    count: { type: "number", default: 2500, description: "Number of birds. Upstream's birds slider." },
    cohesion: { type: "number", default: 1.0, description: "Weight of the steer toward the local centre of mass. Upstream's cohesion slider." },
    alignment: { type: "number", default: 1.2, description: "Weight of the steer toward the neighbours' average heading. Upstream's alignment slider." },
    hawk: { type: "boolean", default: true, description: "Whether the predator flies. Upstream's Hawk button." },
  },
};

const resting = { update() {}, destroy() {} };

export function mount(el, opts = {}) {
  if (!el || typeof document === "undefined" || typeof matchMedia !== "function") return resting;
  if (!el.querySelector("canvas")) return resting;
  const o = {};
  for (const k in meta.options) o[k] = opts[k] ?? meta.options[k].default;
  const hint = el.querySelector(".fx-murm-hawkhint");
  const ac = new AbortController(), signal = ac.signal;

  const canvas=el.querySelector('canvas');
  const W=820,H=620;
  function fit(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;
    const x=canvas.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return x;}
  const ctx=fit();

  /* ───────── tuning ───────── */
  const PERC=34;            // perception radius (px) — also the spatial-hash cell size
  const PERC2=PERC*PERC;
  const SEP_R=16, SEP_R2=SEP_R*SEP_R;
  const MAXSPEED=3.1, MINSPEED=1.6, MAXFORCE=0.075;
  const FEAR_R=120, FEAR_R2=FEAR_R*FEAR_R;
  const W_SEP=1.7;          // base weights (alignment & cohesion scaled by sliders)
  let   W_ALI=o.alignment, W_COH=o.cohesion;
  const MARGIN=100, TURN=0.22;  // soft wrap-back from edges: the turn ramps up across this margin

  /* ───────── flock state (struct-of-arrays) ───────── */
  let N=o.count;
  let px,py,vx,vy,bz;        // pos, vel, depth z in [0,1]
  function alloc(n){
    px=new Float32Array(n); py=new Float32Array(n);
    vx=new Float32Array(n); vy=new Float32Array(n); bz=new Float32Array(n);
  }
  function seed(n){
    alloc(n);
    for(let i=0;i<n;i++){
      px[i]=Math.random()*W; py[i]=Math.random()*H;
      const a=Math.random()*Math.PI*2, s=MINSPEED+Math.random()*(MAXSPEED-MINSPEED);
      vx[i]=Math.cos(a)*s; vy[i]=Math.sin(a)*s;
      bz[i]=Math.random();
    }
    N=n; buildGridDims();
  }

  /* ───────── uniform spatial-hash grid ─────────
     cell size = perception radius, so neighbours live in the 3×3 cell block. */
  let GCOLS,GROWS,GCELLS, cellHead,cellNext;
  function buildGridDims(){
    GCOLS=Math.max(1,Math.ceil(W/PERC));
    GROWS=Math.max(1,Math.ceil(H/PERC));
    GCELLS=GCOLS*GROWS;
    cellHead=new Int32Array(GCELLS);
    cellNext=new Int32Array(N);
  }
  function buildGrid(){
    cellHead.fill(-1);
    for(let i=0;i<N;i++){
      let cx=(px[i]/PERC)|0, cy=(py[i]/PERC)|0;
      if(cx<0)cx=0;else if(cx>=GCOLS)cx=GCOLS-1;
      if(cy<0)cy=0;else if(cy>=GROWS)cy=GROWS-1;
      const c=cy*GCOLS+cx;
      cellNext[i]=cellHead[c]; cellHead[c]=i;   // singly-linked bucket
    }
  }

  /* ───────── predator (hawk) ───────── */
  let hawkOn=o.hawk;
  const hawk={x:W*0.5,y:H*0.5,vx:0,vy:0, wx:W*0.5,wy:H*0.5,wt:0};
  let mouseIn=false, mouseX=0, mouseY=0;

  function stepHawk(){
    if(!hawkOn) return;
    let tx,ty;
    if(mouseIn){ tx=mouseX; ty=mouseY; }
    else{
      // autonomous wander toward a slowly retargeted point
      hawk.wt--;
      if(hawk.wt<=0){ hawk.wx=W*(0.2+Math.random()*0.6); hawk.wy=H*(0.2+Math.random()*0.6); hawk.wt=90+Math.random()*120; }
      tx=hawk.wx; ty=hawk.wy;
    }
    let dx=tx-hawk.x, dy=ty-hawk.y, d=Math.hypot(dx,dy);
    if(d>0.001){ dx/=d; dy/=d; }
    const acc=mouseIn?0.55:0.30;
    hawk.vx+=dx*acc; hawk.vy+=dy*acc;
    const sp=Math.hypot(hawk.vx,hawk.vy), HMAX=4.4;
    if(sp>HMAX){ hawk.vx=hawk.vx/sp*HMAX; hawk.vy=hawk.vy/sp*HMAX; }
    hawk.vx*=0.94; hawk.vy*=0.94;
    hawk.x+=hawk.vx; hawk.y+=hawk.vy;
  }

  /* ───────── one simulation tick ───────── */
  function simulate(){
    buildGrid();
    for(let i=0;i<N;i++){
      const x=px[i], y=py[i];
      let cx=(x/PERC)|0, cy=(y/PERC)|0;
      if(cx<0)cx=0;else if(cx>=GCOLS)cx=GCOLS-1;
      if(cy<0)cy=0;else if(cy>=GROWS)cy=GROWS-1;

      // accumulators
      let sepX=0,sepY=0, aliX=0,aliY=0, cohX=0,cohY=0, cnt=0;

      // 3×3 neighbourhood from the spatial hash — NO loop over all boids
      const x0=cx>0?cx-1:0, x1=cx<GCOLS-1?cx+1:GCOLS-1;
      const y0=cy>0?cy-1:0, y1=cy<GROWS-1?cy+1:GROWS-1;
      for(let gy=y0;gy<=y1;gy++){
        const row=gy*GCOLS;
        for(let gx=x0;gx<=x1;gx++){
          let j=cellHead[row+gx];
          while(j!==-1){
            if(j!==i){
              const dx=px[j]-x, dy=py[j]-y, d2=dx*dx+dy*dy;
              if(d2<PERC2 && d2>0){
                cohX+=px[j]; cohY+=py[j];
                aliX+=vx[j]; aliY+=vy[j];
                cnt++;
                if(d2<SEP_R2){
                  const inv=1/Math.sqrt(d2);   // weight by 1/dist: closer pushes harder
                  sepX-=dx*inv; sepY-=dy*inv;
                }
              }
            }
            j=cellNext[j];
          }
        }
      }

      let ax=0, ay=0;
      if(cnt>0){
        // ALIGNMENT — steer toward neighbours' average heading
        let mag=Math.hypot(aliX,aliY);
        if(mag>0){ aliX=aliX/mag*MAXSPEED-vx[i]; aliY=aliY/mag*MAXSPEED-vy[i];
          const fm=Math.hypot(aliX,aliY); if(fm>MAXFORCE){ aliX=aliX/fm*MAXFORCE; aliY=aliY/fm*MAXFORCE; } }
        else { aliX=aliY=0; }
        // COHESION — steer toward local centre of mass
        cohX=cohX/cnt-x; cohY=cohY/cnt-y;
        mag=Math.hypot(cohX,cohY);
        if(mag>0){ cohX=cohX/mag*MAXSPEED-vx[i]; cohY=cohY/mag*MAXSPEED-vy[i];
          const fm=Math.hypot(cohX,cohY); if(fm>MAXFORCE){ cohX=cohX/fm*MAXFORCE; cohY=cohY/fm*MAXFORCE; } }
        else { cohX=cohY=0; }
        ax+=aliX*W_ALI+cohX*W_COH;
        ay+=aliY*W_ALI+cohY*W_COH;
      }
      // SEPARATION
      let sm=Math.hypot(sepX,sepY);
      if(sm>0){ sepX=sepX/sm*MAXSPEED-vx[i]; sepY=sepY/sm*MAXSPEED-vy[i];
        const fm=Math.hypot(sepX,sepY); if(fm>MAXFORCE){ sepX=sepX/fm*MAXFORCE; sepY=sepY/fm*MAXFORCE; }
        ax+=sepX*W_SEP; ay+=sepY*W_SEP; }

      // PREDATOR — flee (repulsion): force points AWAY from hawk, scaled by closeness
      if(hawkOn){
        const dx=x-hawk.x, dy=y-hawk.y, d2=dx*dx+dy*dy;
        if(d2<FEAR_R2 && d2>0){
          const inv=1/Math.sqrt(d2);
          let fx=dx*inv, fy=dy*inv;                 // unit vector pointing away
          fx=fx*MAXSPEED-vx[i]; fy=fy*MAXSPEED-vy[i];
          const fm=Math.hypot(fx,fy);
          const cap=MAXFORCE*9;                      // panic is allowed to overpower flocking
          if(fm>cap){ fx=fx/fm*cap; fy=fy/fm*cap; }
          const w=1-Math.sqrt(d2)/FEAR_R;            // strongest when nearest
          ax+=fx*(2.6+w*5.0); ay+=fy*(2.6+w*5.0);
        }
      }

      // edge steering — gentle turn back so the flock stays on stage (no hard wrap snap). The turn grows with depth
      // into the margin; a constant turn that switched on at one line stacked the birds into straight walls there.
      if(x<MARGIN)      ax+=TURN*(MARGIN-x)/MARGIN;
      else if(x>W-MARGIN) ax-=TURN*(x-(W-MARGIN))/MARGIN;
      if(y<MARGIN)      ay+=TURN*(MARGIN-y)/MARGIN;
      else if(y>H-MARGIN) ay-=TURN*(y-(H-MARGIN))/MARGIN;

      // integrate velocity, clamp to maxSpeed (and a floor so birds never stall)
      let nvx=vx[i]+ax, nvy=vy[i]+ay;
      let sp=Math.hypot(nvx,nvy);
      if(sp>MAXSPEED){ nvx=nvx/sp*MAXSPEED; nvy=nvy/sp*MAXSPEED; }
      else if(sp<MINSPEED && sp>0){ nvx=nvx/sp*MINSPEED; nvy=nvy/sp*MINSPEED; }
      vx[i]=nvx; vy[i]=nvy;
    }

    // position integration + soft wrap (drifting depth gives the cloud volume)
    for(let i=0;i<N;i++){
      px[i]+=vx[i]; py[i]+=vy[i];
      if(px[i]<-20)px[i]=W+20; else if(px[i]>W+20)px[i]=-20;
      if(py[i]<-20)py[i]=H+20; else if(py[i]>H+20)py[i]=-20;
      bz[i]+=(Math.random()-0.5)*0.012;             // slow depth drift
      if(bz[i]<0)bz[i]=0; else if(bz[i]>1)bz[i]=1;
    }
    stepHawk();
  }

  /* ───────── render ───────── */
  function draw(){
    // MOTION-BLUR TRAILS — translucent dark wash instead of clearRect
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(7,11,9,0.22)';
    ctx.fillRect(0,0,W,H);

    ctx.globalCompositeOperation='lighter';        // additive glow for luminous flock
    for(let i=0;i<N;i++){
      const z=bz[i];
      const sp=Math.hypot(vx[i],vy[i]) || 1;
      const ux=vx[i]/sp, uy=vy[i]/sp;               // heading unit vector
      const len=2.0+z*6.5;                          // near birds streak longer
      const wid=0.7+z*1.7;
      const x=px[i], y=py[i];
      // colour: far = dim emerald, near = bright gold
      const r=Math.round(70+z*(246-70));
      const g=Math.round(150+z*(220-150));
      const b=Math.round(105-z*(105-90));
      const a=0.22+z*0.6;
      // oriented triangle streak along velocity
      const tipX=x+ux*len, tipY=y+uy*len;
      const nx=-uy, ny=ux;
      ctx.beginPath();
      ctx.moveTo(tipX,tipY);
      ctx.lineTo(x-ux*len*0.5+nx*wid, y-uy*len*0.5+ny*wid);
      ctx.lineTo(x-ux*len*0.5-nx*wid, y-uy*len*0.5-ny*wid);
      ctx.closePath();
      ctx.fillStyle='rgba('+r+','+g+','+b+','+a+')';
      ctx.fill();
      if(z>0.62){                                   // soft bloom on the nearest birds
        ctx.fillStyle='rgba(246,230,168,'+((z-0.62)*0.16)+')';
        ctx.beginPath(); ctx.arc(x,y,len*0.9,0,6.283185); ctx.fill();
      }
    }

    // predator — small dark hawk shape with a faint gold rim
    if(hawkOn){
      const sp=Math.hypot(hawk.vx,hawk.vy)||1, ux=hawk.vx/sp, uy=hawk.vy/sp, nx=-uy, ny=ux;
      ctx.globalCompositeOperation='source-over';
      ctx.beginPath();
      ctx.moveTo(hawk.x+ux*13, hawk.y+uy*13);
      ctx.lineTo(hawk.x-ux*9+nx*11, hawk.y-uy*9+ny*11);
      ctx.lineTo(hawk.x-ux*4, hawk.y-uy*4);
      ctx.lineTo(hawk.x-ux*9-nx*11, hawk.y-uy*9-ny*11);
      ctx.closePath();
      ctx.fillStyle='#05080a'; ctx.fill();
      ctx.strokeStyle='rgba(232,196,94,0.55)'; ctx.lineWidth=1; ctx.stroke();
    }
  }

  /* ───────── single shared tick (rAF loop AND __sim.step use this) ───────── */
  function tick(){ simulate(); draw(); }

  let raf;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused=false;
  function loop(){ if(!paused) tick(); raf=requestAnimationFrame(loop); }
  function setPaused(p){ paused=p;
    if(!p) settleId++; }   // Play: the live loop takes over from a settle in progress
  /* Paused still frame (reduced motion, or a new flock while paused): the flock needs ~120 steps to organise, about
     1 s of CPU in one go. Run all but the last 12 steps WITHOUT drawing, in 24 ms chunks so the page stays responsive,
     then the last 12 as full ticks in one task (~100 ms). The 0.22-alpha wash leaves <5% of older frames, so the
     motion-blur trails build up, and only the final frame is painted. A newer settle or Play cancels it. */
  let settleId=0;
  function settle(n){
    const id=++settleId; let left=n;
    (function chunk(){ if(id!==settleId) return;
      const t0=performance.now();
      while(left>12 && performance.now()-t0<24){ simulate(); left--; }
      if(left>12){ setTimeout(chunk,0); return; }
      ctx.globalCompositeOperation='source-over'; ctx.fillStyle='#070b09'; ctx.fillRect(0,0,W,H);
      while(left>0){ tick(); left--; } })();
  }
  function start(){ cancelAnimationFrame(raf); ctx.fillStyle='#070b09'; ctx.fillRect(0,0,W,H); loop(); }


  function aim(e){ const r=canvas.getBoundingClientRect();
    mouseX=(e.clientX-r.left)*(W/r.width); mouseY=(e.clientY-r.top)*(H/r.height); mouseIn=true; }
  canvas.addEventListener('pointermove',aim,{signal});
  canvas.addEventListener('pointerdown',aim,{signal});          // touch: a tap or drag places the hawk
  ['pointerleave','pointercancel'].forEach(ev=>canvas.addEventListener(ev,()=>{ mouseIn=false; },{signal}));
  canvas.addEventListener('pointerup',e=>{ if(e.pointerType!=='mouse') mouseIn=false; },{signal});
  if(matchMedia('(pointer: coarse)').matches && hint) hint.textContent='touch and drag on the canvas';

  seed(N);
  start();
  if(REDUCED){ setPaused(true); settle(120); }   // reduced motion: settle the flock (see settle), then hold a still frame

  el.setAttribute("data-fx-live", "");
  return {
    update(next = {}) {
      if (next.count != null && +next.count !== N) { seed(+next.count); if (paused) settle(120); }
      if (next.cohesion != null) W_COH = +next.cohesion;
      if (next.alignment != null) W_ALI = +next.alignment;
      if (next.hawk != null) hawkOn = !!next.hawk;
    },
    destroy() {
      cancelAnimationFrame(raf);
      settleId++;
      ac.abort();
      el.removeAttribute("data-fx-live");
    },
  };
}
