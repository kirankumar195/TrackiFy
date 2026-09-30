const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const app=express(),DB=path.join(__dirname,'db.json'),sessions=new Map();
app.use(express.json({limit:'10kb'}));
app.use(express.static(path.join(__dirname,'public')));
const load=()=>fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{users:[],days:{}};
const save=d=>fs.writeFileSync(DB,JSON.stringify(d,null,1));
const hash=(p,s)=>crypto.scryptSync(p,s,64).toString('hex');
const isNum=(v,min,max,int)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!int||Number.isInteger(v));
const isDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const t=new Date(s+'T00:00:00Z');return !isNaN(t)&&t.toISOString().slice(0,10)===s&&t<=Date.now()+864e5};
const bad=(res,m)=>res.status(400).json({error:m});
const sid=req=>(/(?:^|; )sid=([a-f0-9]+)/.exec(req.headers.cookie||'')||[])[1];
const pub=u=>({name:u.name,email:u.email,age:u.age,heightCm:u.heightCm,weightKg:u.weightKg,goalCalories:u.goalCalories,goal:u.goal});
function startSession(res,u){const t=crypto.randomBytes(24).toString('hex');sessions.set(t,u.id);res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);res.json(pub(u))}
const auth=(req,res,next)=>{const id=sessions.get(sid(req)),u=id&&load().users.find(x=>x.id===id);if(!u)return res.status(401).json({error:'Please log in'});req.user=u;next()};

app.post('/api/register',(req,res)=>{
  const b=req.body||{},db=load(),email=String(b.email||'').trim().toLowerCase();
  if(typeof b.name!=='string'||!/^[A-Za-z][A-Za-z .'-]{1,39}$/.test(b.name.trim()))return bad(res,'Name must be 2–40 letters');
  if(!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email))return bad(res,'Enter a valid email address');
  if(typeof b.password!=='string'||!/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(b.password))return bad(res,'Password needs 8–64 characters with a letter and a number');
  if(!isNum(b.age,12,100,true))return bad(res,'Age must be a whole number from 12 to 100');
  if(!isNum(b.heightCm,100,250))return bad(res,'Height must be 100–250 cm');
  if(!isNum(b.weightKg,25,300))return bad(res,'Weight must be 25–300 kg');
  if(!isNum(b.goalCalories,1000,6000,true))return bad(res,'Daily calorie goal must be 1000–6000');
  if(!['lose','maintain','gain'].includes(b.goal))return bad(res,'Choose a goal');
  if(db.users.some(u=>u.email===email))return bad(res,'That email is already registered');
  const salt=crypto.randomBytes(16).toString('hex');
  const u={id:crypto.randomUUID(),name:b.name.trim(),email,salt,hash:hash(b.password,salt),age:b.age,heightCm:b.heightCm,weightKg:b.weightKg,goalCalories:b.goalCalories,goal:b.goal};
  db.users.push(u);db.days[u.id]={};save(db);startSession(res,u);
});
app.post('/api/login',(req,res)=>{
  const b=req.body||{},email=String(b.email||'').trim().toLowerCase(),u=load().users.find(x=>x.email===email);
  if(!u||typeof b.password!=='string'||hash(b.password,u.salt)!==u.hash)return res.status(401).json({error:'Email or password is incorrect'});
  startSession(res,u);
});
app.post('/api/logout',(req,res)=>{sessions.delete(sid(req));res.setHeader('Set-Cookie','sid=; Max-Age=0; Path=/');res.json({});});
app.get('/api/me',auth,(req,res)=>res.json(pub(req.user)));
app.get('/api/days',auth,(req,res)=>res.json(load().days[req.user.id]||{}));

app.post('/api/meals',auth,(req,res)=>{
  const b=req.body||{};
  if(!isDate(b.date))return bad(res,'Pick a valid date that is not in the future');
  if(typeof b.name!=='string'||!/^[A-Za-z][A-Za-z0-9 ,.'()-]{1,39}$/.test(b.name.trim()))return bad(res,'Food name must be 2–40 characters and start with a letter');
  if(!['Breakfast','Lunch','Dinner','Snack'].includes(b.type))return bad(res,'Choose a meal type');
  if(!isNum(b.calories,1,3000,true))return bad(res,'Calories must be a whole number from 1 to 3000');
  const db=load(),d=(db.days[req.user.id]??={});(d[b.date]??={meals:[]}).meals??=[];
  d[b.date].meals.push({id:crypto.randomUUID(),name:b.name.trim(),type:b.type,calories:b.calories});
  save(db);res.json(d);
});
app.delete('/api/meals/:date/:id',auth,(req,res)=>{
  const db=load(),day=(db.days[req.user.id]||{})[req.params.date];
  if(day&&day.meals)day.meals=day.meals.filter(m=>m.id!==req.params.id);
  save(db);res.json(db.days[req.user.id]||{});
});
app.put('/api/habits',auth,(req,res)=>{
  const b=req.body||{};
  if(!isDate(b.date))return bad(res,'Pick a valid date that is not in the future');
  if(!isNum(b.water,0,20,true))return bad(res,'Water must be 0–20 glasses');
  if(!isNum(b.steps,0,60000,true))return bad(res,'Steps must be 0–60000');
  if(!isNum(b.sleep,0,16))return bad(res,'Sleep must be 0–16 hours');
  if(!isNum(b.workout,0,300,true))return bad(res,'Workout must be 0–300 minutes');
  if(b.weight!=null&&!isNum(b.weight,25,300))return bad(res,'Weight must be 25–300 kg');
  const db=load(),d=(db.days[req.user.id]??={});(d[b.date]??={meals:[]}).habit={water:b.water,steps:b.steps,sleep:b.sleep,workout:b.workout,weight:b.weight??null};
  save(db);res.json(d);
});
app.listen(process.env.PORT||3000,()=>console.log('TrackiFy running at http://localhost:'+(process.env.PORT||3000)));
