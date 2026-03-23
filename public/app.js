var currentUser=null,activePatrol=null,activeSite='port_stewart',gpsWatchId=null,trackPointCount=0,patrolTimer=null,checkinTimer=null,checkinIntervalMs=90*60*1000,nextCheckinTime=null,patrolObsCount=0,safetyInterval=null,weatherData=null,weatherInterval=null;
var SITES={port_stewart:'Port Stewart',silver_plains:'Silver Plains',lilyvale:'Lilyvale',marina_plains:'Marina Plains'};

var Toast={el:null,timeout:null,show:function(m,t){t=t||'info';if(!Toast.el){Toast.el=document.createElement('div');Toast.el.className='toast';document.body.appendChild(Toast.el)}clearTimeout(Toast.timeout);Toast.el.textContent=m;Toast.el.className='toast '+t;requestAnimationFrame(function(){Toast.el.classList.add('show')});Toast.timeout=setTimeout(function(){Toast.el.classList.remove('show')},3000)}};

function countUp(el,target,dur,sfx){dur=dur||800;sfx=sfx||'';var st=null;function tick(ts){if(!st)st=ts;var p=Math.min((ts-st)/dur,1);el.textContent=Math.round(target*(1-Math.pow(1-p,3)))+sfx;if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}

var App={
  init:async function(){
    await LocalDB.init();SyncEngine.init();await App.loadUsers();await App.seedDemo();
    var p=await LocalDB.getAllByIndex('patrols','status','active');
    if(p.length>0)activePatrol=p[0];
    var s=localStorage.getItem('lamatrak_user');
    if(s){
      var savedUser=JSON.parse(s);
      activeSite=localStorage.getItem('lamatrak_site')||'port_stewart';
      setTimeout(function(){
        PinAuth.showPinPad(savedUser.id, savedUser.name, savedUser.role, {});
      }, 200);
    }
    App.updateLoginStatus()
  },

  updateLoginStatus:function(){
    var d=document.getElementById('login-dot'),t=document.getElementById('login-status-text');
    if(navigator.onLine){d.className='status-dot';t.textContent='Connected — ready to sync'}
    else{d.className='status-dot offline';t.textContent='Offline — data saves locally'}
  },

  seedDemo:async function(){
    var ex=await LocalDB.getAll('patrols');if(ex.length>0)return;
    var td=new Date().toISOString().split('T')[0];
    var ps=[
      {id:'dp1',ranger_id:'u-ranger-001',patrol_type:'land',start_time:td+'T06:30:00Z',end_time:td+'T09:15:00Z',start_lat:-14.85,start_lng:144.32,end_lat:-14.87,end_lng:144.35,notes:'Morning land patrol',status:'completed',synced:1,created_at:td+'T06:30:00Z',updated_at:td+'T09:15:00Z'},
      {id:'dp2',ranger_id:'u-ranger-002',patrol_type:'sea',start_time:td+'T07:00:00Z',end_time:td+'T11:30:00Z',start_lat:-14.78,start_lng:144.40,end_lat:-14.75,end_lng:144.42,notes:'TUMRA patrol',status:'completed',synced:1,created_at:td+'T07:00:00Z',updated_at:td+'T11:30:00Z'},
      {id:'dp3',ranger_id:'u-senior-001',patrol_type:'cultural_site',start_time:td+'T08:00:00Z',end_time:td+'T10:00:00Z',start_lat:-14.82,start_lng:144.28,end_lat:-14.82,end_lng:144.28,notes:'Cultural site check',status:'completed',synced:0,created_at:td+'T08:00:00Z',updated_at:td+'T10:00:00Z'}
    ];
    for(var i=0;i<ps.length;i++)await LocalDB.put('patrols',ps[i]);
    var obs=[
      {id:'do1',patrol_id:'dp1',type:'weed',lat:-14.86,lng:144.33,data:JSON.stringify({species:'Lantana camara (Lantana)',density:'dense',spread_radius:15,notes:'Heavy infestation near creek'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T07:15:00Z',synced:1,created_at:td+'T07:15:00Z',updated_at:td+'T07:15:00Z'},
      {id:'do2',patrol_id:'dp1',type:'feral_animal',lat:-14.87,lng:144.34,data:JSON.stringify({species:'pig',count:6,behaviour:'grazing',notes:'Group near waterhole'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T08:02:00Z',synced:1,created_at:td+'T08:02:00Z',updated_at:td+'T08:02:00Z'},
      {id:'do3',patrol_id:'dp2',type:'marine',lat:-14.76,lng:144.41,data:JSON.stringify({species:'snubfin_dolphin',activity:'feeding',count:3,tumra_area:'yes',notes:'Pod feeding near mangroves'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T08:45:00Z',synced:1,created_at:td+'T08:45:00Z',updated_at:td+'T08:45:00Z'},
      {id:'do4',patrol_id:'dp2',type:'marine',lat:-14.75,lng:144.42,data:JSON.stringify({species:'dugong',activity:'feeding',count:1,tumra_area:'yes',notes:'Adult in seagrass bed'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T09:30:00Z',synced:0,created_at:td+'T09:30:00Z',updated_at:td+'T09:30:00Z'},
      {id:'do5',patrol_id:'dp1',type:'water_quality',lat:-14.85,lng:144.32,data:JSON.stringify({ph:7.4,turbidity:12.3,temperature:28.5,dissolved_oxygen:6.8,visual:'slightly_turbid',notes:'Slight turbidity after rain'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T08:30:00Z',synced:1,created_at:td+'T08:30:00Z',updated_at:td+'T08:30:00Z'},
      {id:'do6',patrol_id:'dp3',type:'cultural_site',lat:-14.82,lng:144.28,data:JSON.stringify({site_condition:'stable',access_status:'accessible',notes:'No new damage'}),photo_paths:'[]',is_restricted:1,recorded_at:td+'T09:00:00Z',synced:0,created_at:td+'T09:00:00Z',updated_at:td+'T09:00:00Z'},
      {id:'do7',patrol_id:'dp1',type:'weed',lat:-14.865,lng:144.335,data:JSON.stringify({species:'Cryptostegia grandiflora (Rubber Vine)',density:'moderate',spread_radius:8,notes:'Along fence line'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T07:45:00Z',synced:0,created_at:td+'T07:45:00Z',updated_at:td+'T07:45:00Z'},
      {id:'do8',patrol_id:'dp1',type:'feral_animal',lat:-14.855,lng:144.325,data:JSON.stringify({species:'cattle',count:12,behaviour:'grazing',notes:'Wild cattle on water lily habitat'}),photo_paths:'[]',is_restricted:0,recorded_at:td+'T08:50:00Z',synced:1,created_at:td+'T08:50:00Z',updated_at:td+'T08:50:00Z'}
    ];
    for(var j=0;j<obs.length;j++)await LocalDB.put('observations',obs[j]);
    for(var t=0;t<80;t++){await LocalDB.put('tracks',{id:'dt'+t,patrol_id:'dp1',lat:-14.85+(t*0.00025),lng:144.32+(t*0.0004),altitude:15,accuracy:4,recorded_at:td+'T07:'+String(Math.floor(t/2)).padStart(2,'0')+':00Z',synced:1})}
  },

  loadUsers:async function(){
    var sel=document.getElementById('login-user'),users=[];
    try{var r=await fetch('/api/users');if(r.ok){users=await r.json();for(var i=0;i<users.length;i++)await LocalDB.put('users',users[i])}}catch(e){users=await LocalDB.getAll('users')}
    if(users.length===0){users=[{id:'u-elder-001',name:'Karen Liddy',role:'elder'},{id:'u-senior-001',name:'Senior Ranger',role:'senior_ranger'},{id:'u-ranger-001',name:'Krishna Gupta',role:'ranger'},{id:'u-ranger-002',name:'Ranger 2',role:'ranger'}];for(var j=0;j<users.length;j++)await LocalDB.put('users',users[j])}
    sel.innerHTML=users.map(function(u){return'<option value="'+u.id+'" data-role="'+u.role+'">'+u.name+' ('+u.role.replace('_',' ')+')</option>'}).join('')
  },

  login:function(){
    var s=document.getElementById('login-user');
    var opt=s.options[s.selectedIndex];
    var name=opt.text.split(' (')[0];
    var role=opt.getAttribute('data-role')||'ranger';
    currentUser={id:s.value,name:name,role:role};
    activeSite=document.getElementById('login-site').value;
    localStorage.setItem('lamatrak_user',JSON.stringify(currentUser));
    localStorage.setItem('lamatrak_site',activeSite);
    App.enterDashboard()
  },

  logout:function(){currentUser=null;localStorage.removeItem('lamatrak_user');Nav.go('login')},

  enterDashboard:function(){
    var h=new Date().getHours();
    document.getElementById('dash-greeting').textContent=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    document.getElementById('dash-ranger').textContent=currentUser.name;
    document.getElementById('dash-site').textContent=SITES[activeSite]||'Port Stewart';
    Nav.go('dashboard');
    setTimeout(function(){App.updateSafety()},100);
    setTimeout(function(){App.updateCoverage()},300);
    setTimeout(function(){App.updateSpecies()},400);
    setTimeout(function(){App.updateTimeline()},500);
    setTimeout(function(){App.updateSync()},700);
    setTimeout(function(){App.checkAlerts()},150);
    if(activePatrol)App.showActivePatrol();else document.getElementById('active-patrol-card').style.display='none';
    if(safetyInterval)clearInterval(safetyInterval);
    safetyInterval=setInterval(function(){App.updateSafety();App.updateCheckinDisplay()},10000);
    App.fetchWeather();
    if(weatherInterval)clearInterval(weatherInterval);
    weatherInterval=setInterval(App.fetchWeather,15*60*1000)
  },

  /* ── RADAR + SAFETY ── */
  updateSafety:function(){
    var h=new Date().getHours();
    var month=new Date().getMonth(),isWet=month>=10||month<=3;
    var uv,temp,wind,floodVal;
    if(weatherData){
      uv=weatherData.uv;temp=weatherData.temp;wind=weatherData.wind;
      var baseFlood=isWet?20:5;
      floodVal=Math.min(100,baseFlood+Math.round(weatherData.precip*3.5))
    }else{
      uv=App.simUV(h);temp=App.simTemp(h);wind=App.simWind(h);
      floodVal=isWet?(Math.random()>0.7?85:45):15
    }
    var floodLabel=floodVal>70?'HIGH':floodVal>35?'MED':'LOW';

    // Values
    document.getElementById('rv-uv').textContent=uv;
    document.getElementById('rv-temp').textContent=temp+'\u00B0C';
    document.getElementById('rv-wind').textContent=wind+'km/h';
    document.getElementById('rv-flood').textContent=floodLabel;

    // Color the value items
    App.colorRV('rv-uv',uv>=11?'danger':uv>=8?'warning':'safe');
    App.colorRV('rv-temp',temp>=38?'danger':temp>=33?'warning':'safe');
    App.colorRV('rv-wind',wind>=45?'danger':wind>=30?'warning':'safe');
    App.colorRV('rv-flood',floodVal>70?'danger':floodVal>35?'warning':'safe');

    // Radar shape — map each value to 0-80 range from center (100)
    var uvR=Math.min(80,(uv/14)*80);
    var tempR=Math.min(80,((temp-20)/20)*80);
    var floodR=Math.min(80,(floodVal/100)*80);
    var windR=Math.min(80,(wind/60)*80);

    var shape=document.getElementById('radar-shape');
    var p1='100,'+(100-uvR);  // top (UV)
    var p2=(100+tempR)+',100'; // right (temp)
    var p3='100,'+(100+floodR); // bottom (flood)
    var p4=(100-windR)+',100';  // left (wind)
    shape.setAttribute('points',p1+' '+p2+' '+p3+' '+p4);

    // Radar dots
    document.getElementById('rdot-uv').setAttribute('cy',100-uvR);
    document.getElementById('rdot-temp').setAttribute('cx',100+tempR);
    document.getElementById('rdot-flood').setAttribute('cy',100+floodR);
    document.getElementById('rdot-wind').setAttribute('cx',100-windR);

    // Color radar
    var isDanger=uv>=11||temp>=38||wind>=45||floodVal>70;
    var isCaution=uv>=8||temp>=33||wind>=30||floodVal>35;
    shape.className.baseVal='radar-shape'+(isDanger?' danger-shape':isCaution?' warning-shape':'');

    ['rdot-uv','rdot-temp','rdot-flood','rdot-wind'].forEach(function(id){
      document.getElementById(id).className.baseVal='radar-dot'+(isDanger?' danger-dot':isCaution?' warning-dot':'')
    });

    // Verdict
    var v=document.getElementById('safety-verdict');
    if(isDanger){v.textContent='DANGER';v.className='safety-verdict danger'}
    else if(isCaution){v.textContent='CAUTION';v.className='safety-verdict caution'}
    else{v.textContent='ALL CLEAR';v.className='safety-verdict safe'}

    // Recommendation
    var rec=document.getElementById('safety-rec-text');
    if(isDanger)rec.textContent='Extreme conditions — limit patrol, carry 4L water, wear full PPE, patrol in pairs';
    else if(isCaution)rec.textContent='Moderate risk — SPF 50+, breaks every 45min, check hydration levels';
    else rec.textContent='Good conditions for patrol — standard safety protocols apply'
  },

  colorRV:function(id,level){
    var el=document.getElementById(id).closest('.rv-item');
    el.className='rv-item'+(level==='danger'?' danger-rv':level==='warning'?' warning-rv':'')
  },

  simUV:function(h){if(h<6||h>18)return 0;if(h<8)return Math.round(2+(h-6)*2.5);if(h<11)return Math.round(7+(h-8)*1.5);if(h<=14)return Math.round(11+Math.sin(h)*1.5);if(h<17)return Math.round(11-(h-14)*2.8);return Math.round(3-(h-17)*1.5)},
  simTemp:function(h){if(h<6)return 24;if(h<10)return Math.round(24+(h-6)*2.2);if(h<=15)return Math.round(32+Math.sin(h*0.5)*3);if(h<19)return Math.round(33-(h-15)*2);return 26},
  simWind:function(h){return Math.round(12+Math.sin(h*0.8)*10+Math.random()*5)},

  fetchWeather:async function(){
    var site=PatrolMap.SITES[activeSite];
    if(!site)return;
    var CACHE_KEY='lamatrak_weather_'+activeSite;
    var MIN_REVALIDATE=5*60*1000;
    // Step 1: serve stale immediately
    try{var c1=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c1&&c1.data)weatherData=c1.data}catch(e){}
    // Step 2: skip if cache is fresh
    try{var c2=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c2&&Date.now()-c2.ts<MIN_REVALIDATE)return}catch(e){}
    // Step 3: background revalidate
    try{
      var url='https://api.open-meteo.com/v1/forecast?latitude='+site.lat+'&longitude='+site.lng+'&current=temperature_2m,wind_speed_10m,uv_index,precipitation';
      var r=await fetch(url);
      if(!r.ok)throw new Error('weather');
      var d=(await r.json()).current;
      weatherData={temp:Math.round(d.temperature_2m),wind:Math.round(d.wind_speed_10m),uv:Math.round(d.uv_index),precip:d.precipitation};
      localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:weatherData}))
    }catch(e){}
  },

  /* ── SPECIES ── */
  updateSpecies:async function(){
    var allO=await LocalDB.getAll('observations');
    var td=new Date().toISOString().split('T')[0];
    var today=allO.filter(function(o){return o.recorded_at&&o.recorded_at.startsWith(td)});
    var weed=today.filter(function(o){return o.type==='weed'}).length;
    var feral=today.filter(function(o){return o.type==='feral_animal'}).length;
    var marine=today.filter(function(o){return o.type==='marine'}).length;
    var water=today.filter(function(o){return o.type==='water_quality'}).length;
    var circ=201;
    var max=Math.max(weed,feral,marine,water,5);
    setTimeout(function(){
      document.getElementById('sp-weed').style.strokeDashoffset=circ-(weed/max)*circ;
      document.getElementById('sp-feral').style.strokeDashoffset=circ-(feral/max)*circ;
      document.getElementById('sp-marine').style.strokeDashoffset=circ-(marine/max)*circ;
      document.getElementById('sp-water').style.strokeDashoffset=circ-(water/max)*circ;
    },200);
    countUp(document.getElementById('sp-weed-num'),weed,600);
    countUp(document.getElementById('sp-feral-num'),feral,700);
    countUp(document.getElementById('sp-marine-num'),marine,800);
    countUp(document.getElementById('sp-water-num'),water,900)
  },

  /* ── COVERAGE ── */
  updateCoverage:async function(){
    var allP=await LocalDB.getAll('patrols'),allO=await LocalDB.getAll('observations');
    var td=new Date().toISOString().split('T')[0];
    var tp=allP.filter(function(p){return p.start_time&&p.start_time.startsWith(td)});
    var to=allO.filter(function(o){return o.recorded_at&&o.recorded_at.startsWith(td)});
    var uc=await LocalDB.getUnsyncedCount();
    var land=tp.filter(function(p){return p.patrol_type==='land'}).length;
    var sea=tp.filter(function(p){return p.patrol_type==='sea'}).length;
    var cultural=tp.filter(function(p){return p.patrol_type==='cultural_site'}).length;
    var tracks=await LocalDB.getAll('tracks');
    var todayTracks=tracks.filter(function(t){return t.recorded_at&&t.recorded_at.startsWith(td)});
    var km=Math.round(todayTracks.length*0.05);
    var score=Math.min(100,Math.round((tp.length*12)+(to.length*4)+(km*1.5)));

    var ring=document.getElementById('cov-fill');
    setTimeout(function(){ring.style.strokeDashoffset=314-(score/100)*314},100);
    ring.style.stroke=score>=60?'var(--success)':score>=30?'var(--warning)':'var(--danger)';
    countUp(document.getElementById('cov-num'),score,1000);
    countUp(document.getElementById('cov-land'),land,600);
    countUp(document.getElementById('cov-sea'),sea,700);
    countUp(document.getElementById('cov-cultural'),cultural,800);
    countUp(document.getElementById('cov-obs'),to.length,900);
    countUp(document.getElementById('cov-unsync'),uc,500)
  },

  /* ── TIMELINE ── */
  updateTimeline:async function(){
    var allP=await LocalDB.getAll('patrols');
    var td=new Date().toISOString().split('T')[0];
    var tp=allP.filter(function(p){return p.start_time&&p.start_time.startsWith(td)&&p.end_time});
    var track=document.getElementById('tl-track');
    var startH=6,endH=18,range=endH-startH;
    var html='';
    tp.forEach(function(p){
      var sh=new Date(p.start_time).getHours()+new Date(p.start_time).getMinutes()/60;
      var eh=new Date(p.end_time).getHours()+new Date(p.end_time).getMinutes()/60;
      var left=Math.max(0,((sh-startH)/range)*100);
      var width=Math.min(100-left,((eh-sh)/range)*100);
      html+='<div class="tl-block '+p.patrol_type+'" style="left:'+left+'%;width:'+width+'%" title="'+p.patrol_type.replace('_',' ')+'"></div>'
    });
    // Now marker
    var nowH=new Date().getHours()+new Date().getMinutes()/60;
    var nowLeft=Math.max(0,Math.min(100,((nowH-startH)/range)*100));
    html+='<div class="tl-now" style="left:'+nowLeft+'%"></div>';
    track.innerHTML=html
  },

  /* ── FEED ── */
  updateFeed:async function(){
    var allP=await LocalDB.getAll('patrols'),allO=await LocalDB.getAll('observations'),users=await LocalDB.getAll('users');
    var td=new Date().toISOString().split('T')[0];
    var uMap={};users.forEach(function(u){uMap[u.id]=u.name});
    var items=[];
    allP.filter(function(p){return p.start_time&&p.start_time.startsWith(td)}).forEach(function(p){
      items.push({time:p.start_time,type:'patrol',subtype:p.patrol_type,ranger:uMap[p.ranger_id]||'Ranger',text:(p.patrol_type==='land'?'Land':p.patrol_type==='sea'?'Sea':'Cultural')+' patrol '+p.status,status:p.status})
    });
    allO.filter(function(o){return o.recorded_at&&o.recorded_at.startsWith(td)}).forEach(function(o){
      var d=typeof o.data==='string'?JSON.parse(o.data):o.data;var title='';
      switch(o.type){
        case'weed':var sp=(d.species||'').split('(');title='Weed: '+(sp[1]?sp[1].replace(')',''):sp[0])+' \u2014 '+(d.density||'');break;
        case'feral_animal':title=d.count+' wild '+(d.species||'animal')+'(s) \u2014 '+(d.behaviour||'');break;
        case'marine':title=d.count+' '+(d.species||'').replace(/_/g,' ')+' \u2014 '+(d.activity||'');break;
        case'water_quality':title='Water \u2014 pH '+(d.ph||'?')+', '+(d.visual||'').replace(/_/g,' ');break;
        case'cultural_site':title='Cultural site \u2014 '+(d.site_condition||'checked');break;
        default:title=o.type}
      var patrol=allP.find(function(p){return p.id===o.patrol_id});
      items.push({time:o.recorded_at,type:o.type,ranger:patrol?(uMap[patrol.ranger_id]||'Ranger'):'Ranger',text:title,synced:o.synced})
    });
    items.sort(function(a,b){return new Date(b.time)-new Date(a.time)});
    var c=document.getElementById('team-feed');
    if(!c)return;
    if(items.length===0){c.innerHTML='<div class="feed-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b0c4d4" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg><p>No activity yet today</p></div>';return}
    var iconMap={weed:'<div class="feed-icon land">W</div>',feral_animal:'<div class="feed-icon feral">F</div>',marine:'<div class="feed-icon sea">M</div>',water_quality:'<div class="feed-icon water">Q</div>',cultural_site:'<div class="feed-icon cultural">C</div>',patrol:'<div class="feed-icon patrol-icon">P</div>'};
    c.innerHTML=items.slice(0,10).map(function(item,idx){
      var time=new Date(item.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      var icon=iconMap[item.type]||iconMap.patrol;
      var badges='';
      if(item.synced===0)badges+='<span class="feed-badge" style="background:var(--warning-light);color:var(--warning)">Pending</span>';
      if(item.status==='completed')badges+='<span class="feed-badge" style="background:var(--success-light);color:var(--success)">Done</span>';
      return'<div class="feed-item '+item.type+'" style="animation-delay:'+(idx*0.05)+'s">'+icon+'<div class="feed-body"><div class="feed-title">'+item.text+'</div><div class="feed-meta"><span>'+item.ranger+'</span><span>'+time+'</span>'+badges+'</div></div></div>'
    }).join('')
  },

  /* ── SYNC ── */
  updateSync:async function(){
    var allP=await LocalDB.getAll('patrols'),allO=await LocalDB.getAll('observations'),uc=await LocalDB.getUnsyncedCount();
    document.getElementById('sync-local').textContent=allP.length+allO.length;
    document.getElementById('sync-waiting').textContent=uc;
    document.getElementById('sync-waiting').className=uc>0?'warning':'';
    document.getElementById('sync-last').textContent=SyncEngine.lastSync?new Date(SyncEngine.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Never'
  },

  checkAlerts:function(){
    var m=new Date().getMonth(),b=document.getElementById('alert-banner');
    if(m>=10||m<=3){
      b.className='alert-banner wet';
      document.getElementById('alert-icon').innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l-5 9c-1.3 2.5 0 5.5 2.5 6.5s5.5 0 6.5-2.5c1-2.5 0-5-1-6.5L12 2z"/></svg>';
      document.getElementById('alert-text').textContent='Wet season (Nov-Apr) \u2014 roads may be impassable';
      b.style.display='flex'
    }
  },

  /* ── ACTIVE PATROL ── */
  showActivePatrol:function(){
    document.getElementById('active-patrol-card').style.display='block';
    var t=activePatrol.patrol_type.replace('_',' ');
    document.getElementById('ap-type').textContent=t.charAt(0).toUpperCase()+t.slice(1)+' Patrol';
    App.tickPatrol()
  },
  tickPatrol:function(){
    if(!activePatrol)return;
    var secs=Math.floor((Date.now()-new Date(activePatrol.start_time).getTime())/1000);
    var h=Math.floor(secs/3600),m=String(Math.floor((secs%3600)/60)).padStart(2,'0'),s=String(secs%60).padStart(2,'0');
    document.getElementById('ap-time').textContent=(h>0?h+':':'')+m+':'+s;
    document.getElementById('ap-dist').textContent=Math.round(trackPointCount*0.05);
    document.getElementById('ap-obs').textContent=patrolObsCount;
    App.updateCheckinDisplay();
    patrolTimer=setTimeout(function(){App.tickPatrol()},1000)
  },
  updateCheckinDisplay:function(){
    var el=document.getElementById('ap-checkin');
    if(!nextCheckinTime){el.textContent='90:00';el.style.color='var(--text)';return}
    var r=Math.max(0,nextCheckinTime-Date.now());
    var m=Math.floor(r/60000),s=Math.floor((r%60000)/1000);
    el.textContent=m+':'+String(s).padStart(2,'0');
    el.style.color=m<5?'var(--danger)':m<15?'var(--warning)':'var(--text)'
  }
};

/* ══ NAV ══ */
var Nav={go:function(screen){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
  var t=document.getElementById('screen-'+screen);if(t)t.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(b){b.classList.toggle('active',b.dataset.screen===screen)});
  var nav=document.querySelector('.bottom-nav');if(nav)nav.style.display=screen==='login'?'none':'';
  if(screen==='dashboard'){App.updateCoverage();App.updateSync();App.updateSafety();App.updateSpecies();App.updateTimeline()}
  if(screen==='record'){
    document.getElementById('record-no-patrol').style.display='none';document.getElementById('record-type-picker').style.display='block';document.getElementById('record-form-area').style.display='none';
  }
  if(screen==='more'){
    if(currentUser){document.getElementById('set-ranger').textContent=currentUser.name;document.getElementById('set-role').textContent=currentUser.role.replace('_',' ');document.getElementById('set-site').textContent=SITES[activeSite]||activeSite}
  }
  if(screen==='map'){PatrolMap.show()}
}};

/* ══ PATROL ══ */
var Patrol={
  startNew:async function(type){
    if(activePatrol){Toast.show('End current patrol first','warning');return}
    Toast.show('Starting '+type.replace('_',' ')+' patrol...','info');
    var pos=await GPS.getCurrentPosition();
    activePatrol=await LocalDB.createPatrol(currentUser.id,type,pos?pos.coords.latitude:null,pos?pos.coords.longitude:null);
    trackPointCount=0;patrolObsCount=0;
    GPS.startTracking(activePatrol.id);Safety.startCheckinTimer();
    App.showActivePatrol();App.updateCoverage();App.updateFeed();App.updateTimeline();
    setTimeout(function(){Toast.show('Patrol active \u2014 stay safe out there','success')},500)
  },
  handleEnd:function(){
    var btn=document.getElementById('end-patrol-btn');
    var txt=document.getElementById('end-patrol-text');
    if(btn.dataset.confirm==='yes'){Patrol.endCurrent();btn.dataset.confirm='';txt.textContent='End Patrol';btn.style.background='var(--bg)';btn.style.borderColor='rgba(26,46,58,0.1)';btn.style.color='var(--text-light)';return}
    btn.dataset.confirm='yes';txt.textContent='Tap again to confirm';btn.style.background='var(--danger-light)';btn.style.borderColor='var(--danger)';btn.style.color='var(--danger)';
    setTimeout(function(){btn.dataset.confirm='';txt.textContent='End Patrol';btn.style.background='var(--bg)';btn.style.borderColor='rgba(26,46,58,0.1)';btn.style.color='var(--text-light)'},3000)
  },
  endCurrent:async function(){
    if(!activePatrol)return;
    var pos=await GPS.getCurrentPosition();
    await LocalDB.endPatrol(activePatrol.id,pos?pos.coords.latitude:null,pos?pos.coords.longitude:null);
    GPS.stopTracking();Safety.stopCheckinTimer();clearTimeout(patrolTimer);
    activePatrol=null;trackPointCount=0;patrolObsCount=0;
    document.getElementById('active-patrol-card').style.display='none';
    App.updateCoverage();App.updateFeed();App.updateSync();App.updateTimeline();
    Toast.show('Patrol saved successfully','success');
    if(SyncEngine.isOnline)setTimeout(function(){SyncEngine.autoSync()},1000)
  }
};

/* ══ GPS ══ */
var GPS={
  lastPosition:null,
  getCurrentPosition:function(){return new Promise(function(resolve){if(!navigator.geolocation){resolve(null);return}navigator.geolocation.getCurrentPosition(function(p){GPS.lastPosition=p;resolve(p)},function(){resolve(null)},{enableHighAccuracy:true,timeout:10000})})},
  startTracking:function(pid){if(!navigator.geolocation)return;gpsWatchId=navigator.geolocation.watchPosition(async function(p){GPS.lastPosition=p;await LocalDB.addTrackPoint(pid,p.coords.latitude,p.coords.longitude,p.coords.altitude,p.coords.accuracy);trackPointCount++},function(){},{enableHighAccuracy:true,maximumAge:10000,timeout:15000})},
  stopTracking:function(){if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null}}
};

/* ══ PATROL MAP ══ */
var PatrolMap={
  map:null,heatLayer:null,trailGroup:null,gapGroup:null,siteGroup:null,heatOn:false,initialized:false,
  SITES:{
    port_stewart:{name:'Port Stewart (HQ)',lat:-14.850,lng:144.320},
    silver_plains:{name:'Silver Plains',lat:-15.100,lng:144.100},
    lilyvale:{name:'Lilyvale',lat:-15.350,lng:143.950},
    marina_plains:{name:'Marina Plains',lat:-14.750,lng:144.550}
  },
  show:function(){
    if(!PatrolMap.initialized){PatrolMap.init()}
    else{setTimeout(function(){PatrolMap.map.invalidateSize()},50)}
    PatrolMap.loadAndRender();
    if(!navigator.onLine)Toast.show('Offline \u2014 map tiles unavailable','warning')
  },
  init:function(){
    PatrolMap.map=L.map('patrol-map',{zoomControl:true,attributionControl:true,tap:true}).setView([-14.95,144.15],11);
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'\xa9 OpenTopoMap contributors'}).addTo(PatrolMap.map);
    PatrolMap.trailGroup=L.layerGroup().addTo(PatrolMap.map);
    PatrolMap.gapGroup=L.layerGroup().addTo(PatrolMap.map);
    PatrolMap.siteGroup=L.layerGroup().addTo(PatrolMap.map);
    PatrolMap.renderSiteMarkers();
    PatrolMap.initialized=true
  },
  loadAndRender:async function(){
    var allPatrols=await LocalDB.getAll('patrols');
    var today=new Date().toISOString().split('T')[0];
    var todayPatrols=allPatrols.filter(function(p){return p.start_time&&p.start_time.startsWith(today)});
    var allPoints=[],tracksByPatrol={};
    for(var i=0;i<todayPatrols.length;i++){
      var pid=todayPatrols[i].id;
      var pts=await LocalDB.getAllByIndex('tracks','patrol_id',pid);
      pts.sort(function(a,b){return a.recorded_at<b.recorded_at?-1:1});
      tracksByPatrol[pid]=pts;
      allPoints=allPoints.concat(pts)
    }
    PatrolMap.trailGroup.clearLayers();
    PatrolMap.gapGroup.clearLayers();
    if(PatrolMap.heatLayer){PatrolMap.map.removeLayer(PatrolMap.heatLayer);PatrolMap.heatLayer=null}
    PatrolMap.renderTrails(todayPatrols,tracksByPatrol);
    var allGaps=[];
    for(var j=0;j<todayPatrols.length;j++){
      var gaps=PatrolMap.detectGaps(tracksByPatrol[todayPatrols[j].id]);
      allGaps=allGaps.concat(gaps);
      PatrolMap.renderGaps(gaps)
    }
    PatrolMap.renderGapChips(allGaps);
    PatrolMap.renderStats(todayPatrols,allPoints);
    if(PatrolMap.heatOn){
      var heatPoints=[];
      for(var k=0;k<allPatrols.length;k++){
        var hpts=await LocalDB.getAllByIndex('tracks','patrol_id',allPatrols[k].id);
        heatPoints=heatPoints.concat(hpts)
      }
      if(heatPoints.length>0)PatrolMap.renderHeatmap(heatPoints)
    }
    if(allPoints.length>0){
      var latlngs=allPoints.map(function(p){return[p.lat,p.lng]});
      PatrolMap.map.fitBounds(L.latLngBounds(latlngs),{padding:[30,30]})
    }
  },
  renderSiteMarkers:function(){
    PatrolMap.siteGroup.clearLayers();
    var keys=Object.keys(PatrolMap.SITES);
    for(var i=0;i<keys.length;i++){
      var s=PatrolMap.SITES[keys[i]];
      var icon=L.divIcon({className:'',html:'<div class="map-site-pin'+(keys[i]===activeSite?' map-site-pin--active':'')+'"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      L.marker([s.lat,s.lng],{icon:icon}).bindTooltip(s.name,{permanent:false,direction:'top',className:'map-site-tooltip'}).addTo(PatrolMap.siteGroup)
    }
  },
  renderTrails:function(patrols,tracksByPatrol){
    var typeColors={land:'#22c55e',sea:'#3b82f6',cultural_site:'#a855f7'};
    for(var i=0;i<patrols.length;i++){
      var pts=tracksByPatrol[patrols[i].id];
      if(!pts||pts.length<2)continue;
      var latlngs=pts.map(function(p){return[p.lat,p.lng]});
      var isActive=activePatrol&&activePatrol.id===patrols[i].id;
      var color=typeColors[patrols[i].patrol_type]||'#22c55e';
      L.polyline(latlngs,{color:color,weight:isActive?4:2.5,opacity:isActive?0.95:0.45,lineJoin:'round',lineCap:'round'}).addTo(PatrolMap.trailGroup);
      if(isActive)L.circleMarker(latlngs[latlngs.length-1],{radius:7,color:'#fff',weight:2,fillColor:'#22c55e',fillOpacity:1}).addTo(PatrolMap.trailGroup)
    }
  },
  renderHeatmap:function(points){
    if(typeof L.heatLayer!=='function')return;
    var data=points.map(function(p){return[p.lat,p.lng,0.5]});
    PatrolMap.heatLayer=L.heatLayer(data,{radius:25,blur:20,maxZoom:15,gradient:{0.3:'#C8D9E6',0.6:'#4a9eda',1.0:'#1a5276'}}).addTo(PatrolMap.map)
  },
  detectGaps:function(points){
    var gaps=[];
    if(!points||points.length<2)return gaps;
    for(var i=0;i<points.length-1;i++){
      var a=points[i],b=points[i+1];
      var deltaMin=(new Date(b.recorded_at).getTime()-new Date(a.recorded_at).getTime())/60000;
      var distKm=PatrolMap.haversine(a.lat,a.lng,b.lat,b.lng);
      if(deltaMin>30||distKm>2)gaps.push({lat1:a.lat,lng1:a.lng,lat2:b.lat,lng2:b.lng,deltaMin:Math.round(deltaMin),distKm:distKm.toFixed(1)})
    }
    return gaps
  },
  renderGaps:function(gaps){
    for(var i=0;i<gaps.length;i++){
      var g=gaps[i];
      L.polyline([[g.lat1,g.lng1],[g.lat2,g.lng2]],{color:'#f59e0b',weight:2.5,opacity:0.85,dashArray:'8 6',lineJoin:'round'}).bindTooltip(g.deltaMin+' min gap \xb7 '+g.distKm+' km',{className:'map-gap-tooltip',direction:'top'}).addTo(PatrolMap.gapGroup)
    }
  },
  renderGapChips:function(gaps){
    var row=document.getElementById('map-gap-row');
    if(!row)return;
    if(gaps.length===0){row.innerHTML='';return}
    var longest=gaps.reduce(function(max,g){return g.deltaMin>max?g.deltaMin:max},0);
    row.innerHTML='<span class="map-gap-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>'+gaps.length+' gap'+(gaps.length>1?'s':'')+' detected</span><span class="map-gap-chip">Longest: '+longest+' min</span>'
  },
  renderStats:function(patrols,points){
    var row=document.getElementById('map-stats-row');
    if(!row)return;
    var distKm=0;
    for(var i=0;i<points.length-1;i++)distKm+=PatrolMap.haversine(points[i].lat,points[i].lng,points[i+1].lat,points[i+1].lng);
    row.innerHTML='<span class="map-stat-chip">'+patrols.length+' patrol'+(patrols.length!==1?'s':'')+' today</span><span class="map-stat-chip">'+distKm.toFixed(1)+' km covered</span><span class="map-stat-chip">'+points.length+' track pts</span>'
  },
  toggleHeatmap:function(){
    PatrolMap.heatOn=!PatrolMap.heatOn;
    var btn=document.getElementById('map-heat-btn');
    if(btn)btn.classList.toggle('map-ctrl-btn--on',PatrolMap.heatOn);
    if(PatrolMap.heatOn){
      LocalDB.getAll('patrols').then(function(allPatrols){
        var ids=allPatrols.map(function(p){return p.id});
        Promise.all(ids.map(function(pid){return LocalDB.getAllByIndex('tracks','patrol_id',pid)})).then(function(results){
          var pts=[].concat.apply([],results);
          if(pts.length>0)PatrolMap.renderHeatmap(pts)
        })
      })
    }else{
      if(PatrolMap.heatLayer){PatrolMap.map.removeLayer(PatrolMap.heatLayer);PatrolMap.heatLayer=null}
    }
  },
  locateUser:function(){
    if(!navigator.geolocation){Toast.show('GPS unavailable','warning');return}
    navigator.geolocation.getCurrentPosition(function(p){
      PatrolMap.map.setView([p.coords.latitude,p.coords.longitude],14);
      L.circleMarker([p.coords.latitude,p.coords.longitude],{radius:8,color:'#fff',weight:2,fillColor:'#22c55e',fillOpacity:1}).addTo(PatrolMap.map).bindPopup('You are here').openPopup()
    },function(){Toast.show('Could not get location','warning')})
  },
  haversine:function(lat1,lng1,lat2,lng2){
    var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  }
};

/* ══ SAFETY ══ */
var Safety={
  checkIn:async function(){
    if(!currentUser)return;var pos=GPS.lastPosition;
    try{await LocalDB.createCheckin(currentUser.id,activePatrol?activePatrol.id:null,pos?pos.coords.latitude:null,pos?pos.coords.longitude:null,'ok')}
    catch(e){Toast.show('Check-in failed \u2014 try again','error');return}
    Toast.show("Check-in recorded \u2014 you're doing great",'success');Safety.resetCheckinTimer()
  },
  needHelp:async function(){
    if(!confirm('Send HELP REQUEST to Port Stewart base?\n\nThis is for non-emergencies (vehicle stuck, equipment failure, etc).\nYour GPS location will be shared.'))return;
    var pos=GPS.lastPosition;
    try{await LocalDB.createCheckin(currentUser.id,activePatrol?activePatrol.id:null,pos?pos.coords.latitude:null,pos?pos.coords.longitude:null,'help')}
    catch(e){Toast.show('Help request failed \u2014 try again','error');return}
    Toast.show('Help request sent \u2014 base has your location','warning');
    if(SyncEngine.isOnline)SyncEngine.pushToServer()
  },
  sos:async function(){
    if(!confirm('\u26A0\uFE0F EMERGENCY SOS \u26A0\uFE0F\n\nThis sends an EMERGENCY alert to Port Stewart base with your exact GPS location.\n\nOnly use for life-threatening situations.\n\nSend SOS?'))return;
    var pos=GPS.lastPosition;
    try{await LocalDB.createCheckin(currentUser.id,activePatrol?activePatrol.id:null,pos?pos.coords.latitude:null,pos?pos.coords.longitude:null,'sos')}
    catch(e){Toast.show('SOS record failed \u2014 try again immediately','error');return}
    Toast.show('SOS EMERGENCY SENT \u2014 help is on the way','error');
    if(SyncEngine.isOnline)SyncEngine.pushToServer()
  },
  startCheckinTimer:function(){if(checkinIntervalMs===0)return;Safety.resetCheckinTimer()},
  resetCheckinTimer:function(){
    Safety.stopCheckinTimer();if(checkinIntervalMs===0)return;
    nextCheckinTime=Date.now()+checkinIntervalMs;
    checkinTimer=setInterval(function(){
      if(Date.now()>=nextCheckinTime){
        Toast.show('CHECK-IN OVERDUE \u2014 tap "I\'m Safe" now','warning');
        LocalDB.createCheckin(currentUser.id,activePatrol?activePatrol.id:null,null,null,'missed').catch(function(){});
        Safety.resetCheckinTimer()
      }
    },5000)
  },
  stopCheckinTimer:function(){if(checkinTimer)clearInterval(checkinTimer);checkinTimer=null;nextCheckinTime=null}
};

if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}
/* ══ RECORD FORM ══ */
var RecordForm={
  currentType:null,

  pickType:async function(type){
    if(!activePatrol){
      Toast.show('Auto-starting patrol...','info');
      var pos=await GPS.getCurrentPosition();
      activePatrol=await LocalDB.createPatrol(currentUser.id,'land',pos?pos.coords.latitude:null,pos?pos.coords.longitude:null);
      trackPointCount=0;patrolObsCount=0;
      GPS.startTracking(activePatrol.id);Safety.startCheckinTimer();
      Toast.show('Patrol started','success');
    }
    
    RecordForm.currentType=type;
    document.getElementById('record-type-picker').style.display='none';
    document.getElementById('record-form-area').style.display='block';
    document.getElementById('record-no-patrol').style.display='none';

    // Hide all forms then show selected
    var forms=document.querySelectorAll('.obs-form-card');
    for(var i=0;i<forms.length;i++)forms[i].style.display='none';
    var target=document.getElementById('form-'+type);
    if(target)target.style.display='block';

    // Update label
    var labels={weed:'Weed',feral_animal:'Feral Animal',marine:'Marine',water_quality:'Water Quality',cultural_site:'Cultural Site'};
    document.getElementById('selected-type-label').textContent=labels[type]||type;

    // Populate weed species list
    if(type==='weed'){
      var dl=document.getElementById('weed-list');
      if(dl&&dl.children.length===0){
        var WEED_SPECIES=['Sida acuta (Spinyhead Sida)','Hyptis suaveolens (Hyptis)','Senna obtusifolia (Sicklepod)','Lantana camara (Lantana)','Cryptostegia grandiflora (Rubber Vine)','Mimosa pigra (Giant Sensitive Plant)','Parkinsonia aculeata (Parkinsonia)','Ziziphus mauritiana (Chinee Apple)','Chromolaena odorata (Siam Weed)','Andropogon gayanus (Gamba Grass)','Hymenachne amplexicaulis (Hymenachne)','Cenchrus ciliaris (Buffel Grass)','Thunbergia grandiflora (Blue Trumpet Vine)','Annona glabra (Pond Apple)','Leucaena leucocephala (Leucaena)','Jatropha gossypiifolia (Bellyache Bush)','Sporobolus pyramidalis (Giant Rats Tail Grass)','Salvinia molesta (Salvinia)','Pistia stratiotes (Water Lettuce)','Clidemia hirta (Kosters Curse)','Senna alata (Candle Bush)','Themeda quadrivalvis (Grader Grass)','Stylosanthes scabra (Shrubby Stylo)','Desmodium uncinatum (Silverleaf Desmodium)','Acacia nilotica (Prickly Acacia)'];
        dl.innerHTML=WEED_SPECIES.map(function(s){return'<option value="'+s+'">'}).join('')
      }
    }

    // Update GPS
    RecordForm.updateGPS();

    // Scroll to top
    document.querySelector('#screen-record .dash-scroll').scrollTop=0
  },

  backToTypes:function(){
    document.getElementById('record-form-area').style.display='none';
    document.getElementById('record-type-picker').style.display='block';
    RecordForm.currentType=null
  },

  selectChip:function(el,groupId){
    var group=document.getElementById(groupId);
    var chips=group.querySelectorAll('.chip');
    for(var i=0;i<chips.length;i++)chips[i].classList.remove('active');
    el.classList.add('active')
  },

  getActiveChip:function(groupId){
    var group=document.getElementById(groupId);
    if(!group)return'';
    var active=group.querySelector('.chip.active');
    return active?active.dataset.val:''
  },

  adjustCount:function(inputId,delta){
    var input=document.getElementById(inputId);
    var val=parseInt(input.value)||0;
    val=Math.max(0,val+delta);
    input.value=val;
    // Bounce animation
    input.style.transform='scale(1.2)';
    setTimeout(function(){input.style.transform='scale(1)'},150)
  },

  previewPhoto:function(input){
    var preview=document.getElementById('photo-preview-area');
    preview.innerHTML='';
    if(input.files&&input.files[0]){
      var img=document.createElement('img');
      img.src=URL.createObjectURL(input.files[0]);
      preview.appendChild(img)
    }
  },

  updateGPS:function(){
    var el=document.getElementById('record-gps');
    if(GPS.lastPosition){
      var c=GPS.lastPosition.coords;
      el.textContent=c.latitude.toFixed(5)+', '+c.longitude.toFixed(5)+' ('+Math.round(c.accuracy)+'m)';
      el.style.color='var(--success)'
    }else{
      el.textContent='Acquiring GPS...';
      el.style.color='var(--text-muted)';
      GPS.getCurrentPosition().then(function(){RecordForm.updateGPS()})
    }
  },

  save:async function(){
    if(!activePatrol){Toast.show('Start a patrol first','warning');return}
    if(!RecordForm.currentType){Toast.show('Select observation type','warning');return}

    var pos=GPS.lastPosition;
    var lat=pos?pos.coords.latitude:null;
    var lng=pos?pos.coords.longitude:null;
    var notes=document.getElementById('f-notes')?document.getElementById('f-notes').value:'';
    var data={};
    var isRestricted=false;

    switch(RecordForm.currentType){
      case'weed':
        var weedSpecies=document.getElementById('f-weed-species').value.trim();
        if(!weedSpecies){Toast.show('Enter a weed species','warning');return}
        data={species:weedSpecies,density:document.getElementById('f-weed-density').value,spread_radius:parseFloat(document.getElementById('f-weed-radius').value)||0,notes:notes};
        break;
      case'feral_animal':
        var feralSpecies=RecordForm.getActiveChip('feral-chips');
        if(!feralSpecies){Toast.show('Select a feral animal species','warning');return}
        data={species:feralSpecies,count:parseInt(document.getElementById('f-feral-count').value)||1,behaviour:document.getElementById('f-feral-behaviour').value,notes:notes};
        break;
      case'marine':
        var marineSpecies=RecordForm.getActiveChip('marine-chips');
        if(!marineSpecies){Toast.show('Select a marine species','warning');return}
        data={species:marineSpecies,activity:document.getElementById('f-marine-activity').value,count:parseInt(document.getElementById('f-marine-count').value)||1,tumra_area:RecordForm.getActiveChip('tumra-chips'),notes:notes};
        break;
      case'water_quality':
        data={ph:parseFloat(document.getElementById('f-wq-ph').value)||null,turbidity:parseFloat(document.getElementById('f-wq-turbidity').value)||null,temperature:parseFloat(document.getElementById('f-wq-temp').value)||null,dissolved_oxygen:parseFloat(document.getElementById('f-wq-do').value)||null,visual:RecordForm.getActiveChip('wq-chips'),notes:notes};
        break;
      case'cultural_site':
        data={site_condition:RecordForm.getActiveChip('cs-condition-chips'),access_status:RecordForm.getActiveChip('cs-access-chips'),notes:notes};
        isRestricted=document.getElementById('f-cs-restricted')?document.getElementById('f-cs-restricted').checked:false;
        break
    }

    // Photo
    var photoPaths=[];
    var photoInput=document.getElementById('f-photo');
    if(photoInput&&photoInput.files&&photoInput.files.length>0){
      var file=photoInput.files[0];
      var reader=new FileReader();
      var base64=await new Promise(function(resolve,reject){reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(new Error('Photo read failed'))};;reader.readAsDataURL(file)}).catch(function(){Toast.show('Could not read photo \u2014 observation saved without it','warning');return null});
      if(base64)photoPaths.push(base64)
    }

    // Save to IndexedDB
    await LocalDB.createObservation(activePatrol.id,RecordForm.currentType,lat,lng,JSON.stringify(data),photoPaths,isRestricted);
    patrolObsCount++;

    // Show success
    document.querySelector('.save-obs-btn').style.display='none';
    document.getElementById('save-success').style.display='flex';

    Toast.show('Observation saved','success');

    // Reset after 1.5s
    setTimeout(function(){
      RecordForm.resetForm();
      document.querySelector('.save-obs-btn').style.display='flex';
      document.getElementById('save-success').style.display='none';
      RecordForm.backToTypes()
    },1500)
  },

  resetForm:function(){
    // Clear all inputs
    var inputs=document.querySelectorAll('#record-form-area input,#record-form-area textarea,#record-form-area select');
    for(var i=0;i<inputs.length;i++){
      if(inputs[i].type==='checkbox')inputs[i].checked=false;
      else if(inputs[i].type==='number')inputs[i].value='';
      else if(inputs[i].tagName==='SELECT')inputs[i].selectedIndex=0;
      else if(inputs[i].type!=='file')inputs[i].value=''
    }
    // Reset counters
    var counters=document.querySelectorAll('.counter-input');
    for(var j=0;j<counters.length;j++)counters[j].value='1';
    // Reset chips to first active
    var chipGroups=document.querySelectorAll('.chip-group');
    for(var k=0;k<chipGroups.length;k++){
      var chips=chipGroups[k].querySelectorAll('.chip');
      for(var l=0;l<chips.length;l++)chips[l].classList.remove('active');
      if(chips[0])chips[0].classList.add('active')
    }
    // Clear photo
    document.getElementById('photo-preview-area').innerHTML='';
    document.getElementById('f-photo').value='';
    document.getElementById('f-notes').value=''
  }
};

document.addEventListener('DOMContentLoaded',function(){
App.init();
var scroll=document.querySelector('.dash-scroll');
if(scroll){scroll.addEventListener('scroll',function(){
var st=scroll.scrollTop;
var safety=document.querySelector('.safety-brief');
if(safety){safety.style.transform='translateY('+st*0.08+'px)';safety.style.opacity=Math.max(0.6,1-st*0.001)}
var ring=document.querySelector('.nav-record-ring');
if(ring){LocalDB.getAll('observations').then(function(obs){var td=new Date().toISOString().split('T')[0];var c=obs.filter(function(o){return o.recorded_at&&o.recorded_at.startsWith(td)}).length;ring.className='nav-record-ring obs-'+Math.min(10,c)})}
})}
});