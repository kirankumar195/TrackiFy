const $=s=>document.querySelector(s);
const api=async(u,m='GET',b)=>{const r=await fetch('/api/'+u,{method:m,headers:{'Content-Type':'application/json'},body:b&&JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong');return j};
const iso=(d=new Date())=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const say=(id,t,ok)=>{const e=$(id);e.textContent=t;e.className='msg '+(ok?'ok':'err')};
const body=f=>{const o={};[...f.elements].forEach(e=>{if(!e.name)return;o[e.name]=e.type==='number'?(e.value===''?null:Number(e.value)):e.value});return o};
let me,days={};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));$('#login').hidden=b.dataset.tab!=='login';$('#register').hidden=b.dataset.tab!=='register'});
$('#login').onsubmit=async e=>{e.preventDefault();try{me=await api('login','POST',body(e.target));start()}catch(x){say('#loginMsg',x.message)}};
$('#register').onsubmit=async e=>{e.preventDefault();try{me=await api('register','POST',body(e.target));start()}catch(x){say('#regMsg',x.message)}};
$('#out').onclick=async()=>{await api('logout','POST');location.reload()};
async function start(){$('#auth').hidden=true;$('#app').hidden=false;$('#hi').textContent='Hi, '+me.name.split(' ')[0];
  const d=$('#day');d.max=iso();d.value=iso();days=await api('days');render()}
$('#day').onchange=e=>{if(!e.target.value)e.target.value=iso();render()};
$('#meal').onsubmit=async e=>{e.preventDefault();try{days=await api('meals','POST',{...body(e.target),date:$('#day').value});e.target.reset();say('#mealMsg','Food added',1);render()}catch(x){say('#mealMsg',x.message)}};
$('#habit').onsubmit=async e=>{e.preventDefault();try{days=await api('habits','PUT',{...body(e.target),date:$('#day').value});say('#habMsg','Habits saved',1);render()}catch(x){say('#habMsg',x.message)}};
const kcal=d=>(days[d]?.meals||[]).reduce((s,m)=>s+m.calories,0);
function render(){
  const d=$('#day').value,goal=me.goalCalories,eaten=kcal(d),left=goal-eaten;
  $('#left').textContent=Math.abs(left);$('#left').classList.toggle('over',left<0);$('#leftLbl').textContent=left<0?'kcal over goal':'kcal left ('+eaten+' eaten)';
  const w=Object.values(days).map(x=>x.habit?.weight).filter(Boolean).pop()||me.weightKg;
  $('#bmi').textContent=(w/Math.pow(me.heightCm/100,2)).toFixed(1);$('#goalTxt').textContent=goal;
  let s=0;for(let i=0;i<400;i++){const k=iso(new Date(Date.now()-i*864e5)),x=days[k];if(x&&(x.meals?.length||x.habit))s++;else if(i>0)break}
  $('#streak').textContent=s;
  const ul=$('#meals');ul.innerHTML='';
  (days[d]?.meals||[]).forEach(m=>{const li=document.createElement('li'),sp=document.createElement('span'),b=document.createElement('button');
    sp.textContent=`${m.type}: ${m.name} · ${m.calories} kcal`;b.textContent='Remove';b.onclick=async()=>{days=await api(`meals/${d}/${m.id}`,'DELETE');render()};li.append(sp,b);ul.append(li)});
  const h=days[d]?.habit,f=$('#habit').elements;['water','steps','sleep','workout'].forEach(k=>f[k].value=h?h[k]:'');f.weight.value=h?.weight??'';
  const T=[['water','Water',8,'glasses'],['steps','Steps',8000,''],['sleep','Sleep',8,'h'],['workout','Workout',30,'min']];
  $('#bars').innerHTML='';T.forEach(([k,n,t,u])=>{const v=h?h[k]:0,e=document.createElement('div');e.className='bar';
    e.textContent=`${n}: ${v} / ${t} ${u}`;const o=document.createElement('div'),i=document.createElement('i');i.style.width=Math.min(100,v/t*100)+'%';o.append(i);e.append(o);$('#bars').append(e)});
  const last=[...Array(7)].map((_,i)=>iso(new Date(Date.now()-(6-i)*864e5)));
  chart($('#cCal'),last.map(x=>x.slice(5)),last.map(kcal),goal,true);
  const wk=Object.keys(days).filter(k=>days[k].habit?.weight).sort().slice(-14);
  chart($('#cWt'),wk.map(x=>x.slice(5)),wk.map(k=>days[k].habit.weight),null,false);
}
function chart(c,labels,vals,goal,bars){
  const r=devicePixelRatio||1,W=c.clientWidth,H=c.clientHeight;c.width=W*r;c.height=H*r;const g=c.getContext('2d');g.scale(r,r);g.clearRect(0,0,W,H);
  const st=getComputedStyle(document.body),ink=st.getPropertyValue('--mute'),blue=st.getPropertyValue('--blue'),coral=st.getPropertyValue('--coral');
  g.font='12px Manrope,sans-serif';g.fillStyle=ink;
  if(!vals.length){g.fillText('Log your weight in Daily habits to see the trend.',10,H/2);return}
  let max=Math.max(...vals,goal||0),min=bars?0:Math.min(...vals);if(!bars){const p=(max-min)*.2||1;max+=p;min-=p}else max*=1.15||1;
  const L=36,B=H-22,T=10,x=i=>L+(i+.5)*(W-L-8)/vals.length,y=v=>B-(v-min)/(max-min||1)*(B-T);
  g.strokeStyle=blue;g.lineWidth=2;
  if(bars){vals.forEach((v,i)=>{const bw=(W-L-8)/vals.length*.55;g.fillStyle=goal&&v>goal?coral:blue;g.fillRect(x(i)-bw/2,y(v),bw,B-y(v));g.fillStyle=ink;g.textAlign='center';g.fillText(labels[i],x(i),H-6);if(v)g.fillText(v,x(i),y(v)-4)});
    g.strokeStyle=ink;g.setLineDash([5,4]);g.beginPath();g.moveTo(L,y(goal));g.lineTo(W-8,y(goal));g.stroke();g.setLineDash([]);g.textAlign='left';g.fillText('goal',2,y(goal)+4)}
  else{g.beginPath();vals.forEach((v,i)=>i?g.lineTo(x(i),y(v)):g.moveTo(x(i),y(v)));g.stroke();g.textAlign='center';vals.forEach((v,i)=>{g.fillStyle=blue;g.beginPath();g.arc(x(i),y(v),3.5,0,7);g.fill();g.fillStyle=ink;g.fillText(v,x(i),y(v)-8);g.fillText(labels[i],x(i),H-6)})}
}
addEventListener('resize',()=>me&&render());
api('me').then(u=>{me=u;start()}).catch(()=>{});
