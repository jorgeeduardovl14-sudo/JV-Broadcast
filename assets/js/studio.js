import{createRealtime}from'./realtime.js';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
const q=s=>document.querySelector(s),params=new URLSearchParams(location.search),match=params.get('session')||params.get('match')||'DEMO',rt=createRealtime(match,'camera');q('#matchLabel').textContent=match;
const video=q('#camera'),canvas=q('#programCanvas'),ctx=canvas.getContext('2d');let cameraStream=null,facing='environment',live=false,startedAt=0,timer=null,recorder=null,chunks=[];
const state={homeName:'Santa Bárbara',awayName:'Visitante',homeScore:0,awayScore:0,setNumber:1,setResults:[],serve:'home',scoreVisible:true,scorePosition:'top-left',scoreSize:'medium',sponsors:[],sponsorIndex:-1,sponsorVisible:false,sponsorFullscreen:false,sponsorPosition:'top-right',sponsorSize:'medium',activeSponsor:null,lowerVisible:false,sceneVisible:false,accent:'#20d3a6',homeColor:'#20d3a6',awayColor:'#2563eb',homeLogo:'',awayLogo:''};
const imageCache=new Map();
function cachedImage(src){if(!src)return null;if(imageCache.has(src))return imageCache.get(src);const img=new Image();img.crossOrigin='anonymous';img.src=src;imageCache.set(src,img);return img}
function drawContain(src,x,y,w,h){const img=cachedImage(src);if(!img||!img.complete||!img.naturalWidth)return false;const r=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*r,dh=img.naturalHeight*r;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);return true}
let firebaseSessionReady=false;rt.onStatus(({text,connected})=>{q('#syncStatus').textContent=text;q('#syncStatus').className=`status ${connected?'online':'offline'}`;q('#remoteState').textContent=connected?text:'Sin tablet';if(connected&&!firebaseSessionReady){firebaseSessionReady=true;rt.setStreamStatus('idle').catch(console.warn)}});
rt.subscribe(d=>{const incoming=d||{};Object.assign(state,incoming);});
function rr(x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill()}
function fontFit(text,max,width,weight=800){let n=max;do{ctx.font=`${weight} ${n}px Arial`;if(ctx.measureText(String(text)).width<=width)break;n-=2}while(n>14);return n}
function drawVideo(){ctx.fillStyle='#02050a';ctx.fillRect(0,0,1280,720);if(video.readyState>=2){const vr=video.videoWidth/video.videoHeight,cr=1280/720;let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;if(vr>cr){sw=video.videoHeight*cr;sx=(video.videoWidth-sw)/2}else{sh=video.videoWidth/cr;sy=(video.videoHeight-sh)/2}ctx.drawImage(video,sx,sy,sw,sh,0,0,1280,720)}}
function score(){
  const scaleMap={small:.74,medium:1,large:1.18},scale=scaleMap[state.scoreSize]||1;
  const history=Array.isArray(state.setResults)?state.setResults:[];
  const completedBySet=new Map(history.map(item=>[Number(item.setNumber),item]));
  const totalSets=Math.max(1,Math.min(5,Number(state.setNumber)||1));
  const nameW=300,colW=62,headerH=24,rowH=39,padX=8,padY=5;
  const baseW=nameW+(totalSets*colW)+(padX*2),baseH=headerH+(rowH*2)+(padY*2);
  const w=baseW*scale,h=baseH*scale;
  const positions={
    'top-left':[0,0],
    'top-center':[(1280-w)/2,0],
    'top-right':[1280-w,0],
    'bottom-left':[0,720-h],
    'bottom-center':[(1280-w)/2,720-h],
    'bottom-right':[1280-w,720-h]
  };
  const [x,y]=positions[state.scorePosition]||positions['top-left'];

  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  rr(0,0,baseW,baseH,10,'rgba(4,10,18,.93)');

  const row1Y=padY+headerH,row2Y=row1Y+rowH;
  ctx.fillStyle=state.homeColor||state.accent||'#20d3a6';ctx.fillRect(0,row1Y,6,rowH);
  ctx.fillStyle=state.awayColor||'#2563eb';ctx.fillRect(0,row2Y,6,rowH);

  drawContain(state.homeLogo,12,row1Y+5,28,28);
  drawContain(state.awayLogo,12,row2Y+5,28,28);

  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#fff';
  const homeFont=fontFit(state.homeName||'LOCAL',20,nameW-58,800);
  const awayFont=fontFit(state.awayName||'VISITANTE',20,nameW-58,800);
  ctx.font=`800 ${homeFont}px Arial`;ctx.fillText(state.homeName||'LOCAL',48,row1Y+rowH/2);
  ctx.font=`800 ${awayFont}px Arial`;ctx.fillText(state.awayName||'VISITANTE',48,row2Y+rowH/2);

  for(let setNo=1;setNo<=totalSets;setNo++){
    const colX=padX+nameW+((setNo-1)*colW),centerX=colX+colW/2;
    const active=setNo===totalSets;
    if(active){
      ctx.fillStyle='rgba(255,255,255,.075)';ctx.fillRect(colX,padY,colW,headerH+rowH*2);
    }
    ctx.textAlign='center';ctx.fillStyle=active?'#fff':'#aebdd0';ctx.font=`850 ${active?14:13}px Arial`;
    ctx.fillText(`S${setNo}`,centerX,padY+headerH/2);

    const frozen=completedBySet.get(setNo);
    const homeValue=active?state.homeScore:(frozen?.homeScore??'–');
    const awayValue=active?state.awayScore:(frozen?.awayScore??'–');
    ctx.fillStyle='#fff';ctx.font=`950 ${active?25:22}px Arial`;
    ctx.fillText(String(homeValue),centerX,row1Y+rowH/2);
    ctx.fillText(String(awayValue),centerX,row2Y+rowH/2);

    if(active){
      ctx.fillStyle='#ef233c';ctx.beginPath();
      ctx.arc(colX+9,state.serve==='home'?row1Y+rowH/2:row2Y+rowH/2,5,0,Math.PI*2);ctx.fill();
    }
    if(setNo<totalSets){ctx.fillStyle='rgba(174,189,208,.18)';ctx.fillRect(colX+colW-1,padY+4,1,baseH-padY*2-8)}
  }
  ctx.restore();ctx.textAlign='left';
}
function sponsor(){
  const s=state.activeSponsor||(state.sponsors||[])[state.sponsorIndex];
  if(!s||!s.logo)return;
  if(state.sponsorFullscreen){drawContain(s.logo,220,120,840,480);return;}
  const sizes={small:[150,90],medium:[220,125],large:[310,175]},[w,h]=sizes[state.sponsorSize]||sizes.medium,margin=28;
  const positions={
    'top-right':[1280-w-margin,margin],
    'bottom-right':[1280-w-margin,720-h-margin],
    'bottom-left':[margin,720-h-margin]
  };
  const [x,y]=positions[state.sponsorPosition]||positions['top-right'];
  drawContain(s.logo,x,y,w,h);
}
function lower(){rr(64,570,790,105,18,'rgba(4,11,20,.93)');ctx.fillStyle=state.lowerStyle==='notice'?'#f3b33d':state.accent||'#20d3a6';ctx.fillRect(64,570,10,105);ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font=`900 ${fontFit(state.lowerTitle||'',35,730,900)}px Arial`;ctx.fillText(state.lowerTitle||'',98,608);ctx.fillStyle='#bdc8d7';ctx.font=`650 ${fontFit(state.lowerSubtitle||'',21,730,650)}px Arial`;ctx.fillText(state.lowerSubtitle||'',98,648)}
function scene(){ctx.fillStyle='rgba(3,8,15,.96)';ctx.fillRect(0,0,1280,720);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=state.accent||'#20d3a6';ctx.font='900 26px Arial';ctx.fillText('JV BROADCAST',640,230);ctx.fillStyle='#fff';ctx.font=`900 ${fontFit(state.sceneTitle||'',72,1080,900)}px Arial`;ctx.fillText(state.sceneTitle||'',640,340);ctx.fillStyle='#b9c5d4';ctx.font=`650 ${fontFit(state.sceneSubtitle||'',30,960,650)}px Arial`;ctx.fillText(state.sceneSubtitle||'',640,410);ctx.textAlign='left'}
function draw(){drawVideo();if(state.scoreVisible)score();if(state.sponsorVisible)sponsor();if(state.lowerVisible)lower();if(state.sceneVisible)scene();requestAnimationFrame(draw)}
async function camera(){if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());const quality=q('#quality').value==='1080'?{width:1920,height:1080}:{width:1280,height:720};cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:quality.width},height:{ideal:quality.height}},audio:{echoCancellation:true,noiseSuppression:true}});video.srcObject=cameraStream;await video.play();q('#cameraPlaceholder').classList.add('hidden');q('#flipCamera').disabled=false;q('#startLive').disabled=false;q('#startRecording').disabled=false;const s=cameraStream.getVideoTracks()[0].getSettings();q('#resolutionState').textContent=`${s.width||'?'}×${s.height||'?'}`}
function save(){const remember=q('#rememberKey').checked;localStorage.setItem('jv:rtmpUrl',q('#rtmpUrl').value.trim());localStorage.setItem('jv:rememberKey',remember?'1':'0');if(remember)localStorage.setItem('jv:streamKey',q('#streamKey').value.trim());else localStorage.removeItem('jv:streamKey');q('#connectionState').textContent='Configuración guardada'}
q('#rtmpUrl').value=localStorage.getItem('jv:rtmpUrl')||'rtmps://a.rtmps.youtube.com/live2';q('#rememberKey').checked=localStorage.getItem('jv:rememberKey')!=='0';q('#streamKey').value=q('#rememberKey').checked?(localStorage.getItem('jv:streamKey')||''):'';
q('#toggleKey').onclick=()=>{const show=q('#streamKey').type==='password';q('#streamKey').type=show?'text':'password';q('#toggleKey').textContent=show?'Ocultar':'Ver'};q('#saveYoutube').onclick=save;q('#startCamera').onclick=()=>camera().catch(e=>alert(`No se pudo activar la cámara: ${e.message}`));q('#flipCamera').onclick=()=>{facing=facing==='environment'?'user':'environment';camera().catch(()=>{})};
function tick(){const sec=Math.floor((Date.now()-startedAt)/1000),h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');q('#liveTimer').textContent=`${h}:${m}:${s}`}
q('#startLive').onclick=()=>{if(!cameraStream)return alert('Primero activa la cámara.');if(!q('#rtmpUrl').value.trim()||!q('#streamKey').value.trim())return alert('Ingresa y guarda el servidor y la Stream Key de YouTube.');save();live=true;startedAt=Date.now();timer=setInterval(tick,1000);tick();rt.setStreamStatus('active').catch(console.warn);q('#liveState').textContent='Prueba activa';q('#connectionState').textContent='Composición funcionando';q('#startLive').disabled=true;q('#stopLive').disabled=false;q('#flipCamera').disabled=true};
q('#stopLive').onclick=()=>{live=false;clearInterval(timer);rt.setStreamStatus('ended').catch(console.warn);q('#liveState').textContent='Detenida';q('#connectionState').textContent='Finalizada';q('#startLive').disabled=false;q('#stopLive').disabled=true;q('#flipCamera').disabled=false};
q('#startRecording').onclick=()=>{if(recorder){recorder.stop();q('#startRecording').textContent='Grabar prueba local';return}if(!canvas.captureStream)return alert('Este navegador no permite grabar el lienzo.');const out=canvas.captureStream(30),audio=cameraStream?.getAudioTracks()[0];if(audio)out.addTrack(audio.clone());chunks=[];try{recorder=new MediaRecorder(out,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':''})}catch{recorder=new MediaRecorder(out)}recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`JV-Broadcast-${match}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);recorder=null};recorder.start(1000);q('#startRecording').textContent='Detener y descargar'};

const controlUrl = new URL('./control.html', location.href);
controlUrl.searchParams.set('session', match);
q('#controlLinkText').textContent = controlUrl.href;
QRCode.toCanvas(controlUrl.href, { width: 190, margin: 1, errorCorrectionLevel: 'M' })
  .then((qrCanvas) => { q('#qrCode').replaceChildren(qrCanvas); })
  .catch(() => { q('#qrCode').textContent = 'No se pudo generar el QR'; });
q('#shareControl').onclick = async () => {
  try {
    if (navigator.share) await navigator.share({ title: `Control JV Broadcast ${match}`, url: controlUrl.href });
    else { await navigator.clipboard.writeText(controlUrl.href); alert('Enlace del control copiado.'); }
  } catch (error) {
    if (error?.name !== 'AbortError') alert('No se pudo compartir el enlace.');
  }
};

function readPreparedSponsors(){
  const keys=[`jv:preSponsors:${match}`,'jv:sponsorLibrary:v9'];
  for(const key of keys){
    try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data)&&data.length)return data}catch{}
  }
  return [];
}
let initialSponsorsSent=false;
rt.subscribe((data)=>{
  if(initialSponsorsSent)return;
  const remote=Array.isArray(data?.sponsors)?data.sponsors:[];
  const prepared=readPreparedSponsors();
  if(!remote.length&&prepared.length){initialSponsorsSent=true;rt.patch({sponsors:prepared,sponsorIndex:0}).catch(console.warn)}
  else if(remote.length)initialSponsorsSent=true;
});
q('#exitBtn').onclick=async()=>{if(live&&!confirm('La prueba está activa. ¿Salir?'))return;if(live)await rt.setStreamStatus('ended').catch(()=>{});location.href='./'};draw();
