/** SIMA production backend — Google Apps Script bound to a private Google Sheet.
 * Script Properties: SIMA_BACKEND_SECRET and SIMA_ADMIN_PASSWORD_HASH.
 * Run setupSIMA() once from the bound spreadsheet before deploying as Web App.
 */
const HEADERS={
 Students:['id','nickname','nameKey','grade','salt','pinHash','points','quizzes','created','disabled'],
 Sessions:['tokenHash','studentId','expires'],
 Progress:['studentId','book','chapter','completedAt'],
 Attempts:['id','studentId','competition','questionIds','started','expires','submitted','score','total','pointsAwarded'],
 Certificates:['id','studentId','attemptId','score','total','issued'],
 AdminSessions:['tokenHash','expires'],
 Settings:['key','value'],
 Questions:['id','question','optionA','optionB','optionC','optionD','correctIndex','active']
};
const MAX_AGE=7*24*3600*1000;
function setupSIMA(){const ss=SpreadsheetApp.getActiveSpreadsheet();Object.keys(HEADERS).forEach(n=>{let s=ss.getSheetByName(n)||ss.insertSheet(n);if(s.getLastRow()===0){s.appendRow(HEADERS[n]);s.setFrozenRows(1);s.getRange(1,1,1,HEADERS[n].length).setFontWeight('bold').setBackground('#123d85').setFontColor('white')}});const props=PropertiesService.getScriptProperties();if(!props.getProperty('SIMA_BACKEND_SECRET'))props.setProperty('SIMA_BACKEND_SECRET',Utilities.getUuid()+Utilities.getUuid());Logger.log('Set your own admin password hash using setAdminPasswordOnce(password) in the script editor; do not put passwords in sheet cells.');}
function setAdminPasswordOnce(password){if(typeof password!=='string'||password.length<14)throw Error('Use an admin password of at least 14 characters');PropertiesService.getScriptProperties().setProperty('SIMA_ADMIN_PASSWORD_HASH',sha(password));}
function sha(x){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(x),Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('')}
function uid(){return Utilities.getUuid().replace(/-/g,'')}
function sheet(n){const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);if(!s)throw Error('Run setupSIMA first');return s}
function rows(n){const s=sheet(n),v=s.getDataRange().getValues();return v.slice(1).map((r,i)=>({row:i+2,v:r}))}
function append(n,a){sheet(n).appendRow(a)}
function patch(n,row,col,value){sheet(n).getRange(row,col).setValue(value)}
function error(msg){return {ok:false,error:msg}}
function out(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function doPost(e){let lock=LockService.getScriptLock();try{if(!lock.tryLock(18000))return out(error('Server busy, retry in a moment'));let a=JSON.parse(e.postData.contents||'{}');if(a.secret!==PropertiesService.getScriptProperties().getProperty('SIMA_BACKEND_SECRET'))return out(error('Access denied'));return out(dispatch(a))}catch(err){return out(error(err.message||'Unexpected error'))}finally{if(lock.hasLock())lock.releaseLock()}}
function validName(x){return typeof x==='string'&&/^[A-Za-z0-9_ ]{3,24}$/.test(x.trim())}
function validPin(x){return typeof x==='string'&&/^\d{6,12}$/.test(x)}
function studentByName(name){return rows('Students').find(r=>String(r.v[2])===name.toLowerCase())}
function studentById(id){return rows('Students').find(r=>r.v[0]===id)}
function auth(token){if(typeof token!=='string'||token.length<20)throw Error('Please sign in');const r=rows('Sessions').find(r=>r.v[0]===sha(token)&&Number(r.v[2])>Date.now());if(!r)throw Error('Session expired. Please sign in again.');const u=studentById(r.v[1]);if(!u||u.v[9]===true)throw Error('Account unavailable');return u}
function adminAuth(token){if(!rows('AdminSessions').some(r=>r.v[0]===sha(token)&&Number(r.v[1])>Date.now()))throw Error('Admin session expired')}
function newSession(id,admin){const token=uid()+uid(),expires=Date.now()+MAX_AGE;if(admin)append('AdminSessions',[sha(token),expires]);else append('Sessions',[sha(token),id,expires]);return token}
function studentView(u){const id=u.v[0],r={};rows('Progress').filter(x=>x.v[0]===id).forEach(x=>{const b=Number(x.v[1]);r[b]=Math.max(Number(r[b]||0),Number(x.v[2])+1)});const cert=rows('Certificates').filter(x=>x.v[1]===id).slice(-1)[0];return {name:u.v[1],grade:u.v[3],points:Number(u.v[6])||0,quizzes:Number(u.v[7])||0,read:r,certificate:cert?{id:cert.v[0],score:Number(cert.v[3]),total:Number(cert.v[4]),date:Utilities.formatDate(new Date(cert.v[5]),Session.getScriptTimeZone(),'dd/MM/yyyy')}:null}}
function dispatch(a){const act=a.action;
if(act==='register'){
 const name=String(a.name||'').trim(),pin=String(a.pin||''),grade=String(a.grade||'');if(!validName(name)||!validPin(pin)||!['VI','VII','VIII','IX','X','XI','XII'].includes(grade))throw Error('Check nickname, class and 6–12 digit PIN');if(studentByName(name))throw Error('Nickname already taken; choose another');const id=uid(),salt=uid();append('Students',[id,name,name.toLowerCase(),grade,salt,sha(salt+pin),0,0,new Date().toISOString(),false]);return {ok:true,token:newSession(id,false),student:studentView(studentById(id))};}
if(act==='login'){const key='login_'+sha(String(a.name||'').toLowerCase()).slice(0,24),cache=CacheService.getScriptCache(),fails=Number(cache.get(key)||0);if(fails>=8)throw Error('Too many attempts. Try again in 15 minutes.');const u=studentByName(String(a.name||'').trim());if(!u||sha(u.v[4]+String(a.pin||''))!==u.v[5]||u.v[9]===true){cache.put(key,String(fails+1),900);throw Error('Incorrect nickname or PIN')}cache.remove(key);return {ok:true,token:newSession(u.v[0],false),student:studentView(u)};}
if(act==='adminLogin'){const cache=CacheService.getScriptCache(),fails=Number(cache.get('admin_failures')||0);if(fails>=8)throw Error('Too many attempts. Try again in 15 minutes.');const expected=PropertiesService.getScriptProperties().getProperty('SIMA_ADMIN_PASSWORD_HASH');if(!expected||sha(String(a.password||''))!==expected){cache.put('admin_failures',String(fails+1),900);throw Error('Incorrect admin credentials')}cache.remove('admin_failures');return {ok:true,token:newSession('',true)};}
if(['adminStats','adminStudents','adminAttempts','adminVerify','adminPublish'].includes(act)){
 adminAuth(a.token);
 if(act==='adminStats')return {ok:true,students:rows('Students').length,attempts:rows('Attempts').filter(x=>x.v[6]).length,certificates:rows('Certificates').length,questions:rows('Questions').length};
 if(act==='adminStudents')return {ok:true,rows:rows('Students').slice(-100).map(r=>({name:r.v[1],grade:r.v[3],points:r.v[6],quizzes:r.v[7],created:r.v[8]}))};
 if(act==='adminAttempts')return {ok:true,rows:rows('Attempts').filter(r=>r.v[6]).slice(-100).map(r=>({id:r.v[0],studentId:r.v[1],competition:r.v[2],score:r.v[7],total:r.v[8],submitted:r.v[6]}))};
 if(act==='adminVerify'){const c=rows('Certificates').find(r=>r.v[0]===a.id);if(!c)throw Error('Certificate not found');const u=studentById(c.v[1]);return {ok:true,certificate:{id:c.v[0],student:u.v[1],grade:u.v[3],score:c.v[3],total:c.v[4],issued:c.v[5]}};}
 if(act==='adminPublish'){const q=a.question;if(!q||String(q.text||'').length<12||!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>!x||String(x).length>180)||![0,1,2,3].includes(Number(q.correct)))throw Error('Question needs text, four options and a correct answer');const id=uid();append('Questions',[id,String(q.text).slice(0,500),...q.options.map(x=>String(x).slice(0,180)),Number(q.correct),true]);return {ok:true,id};}
}
const u=auth(a.token);
if(act==='me')return {ok:true,student:studentView(u)};
if(act==='progress'){const b=Number(a.book),c=Number(a.chapter);if(!Number.isInteger(b)||b<0||b>10||!Number.isInteger(c)||c<0||c>11||(b!==10&&c>5))throw Error('Invalid chapter');if(!rows('Progress').some(r=>r.v[0]===u.v[0]&&Number(r.v[1])===b&&Number(r.v[2])===c))append('Progress',[u.v[0],b,c,new Date().toISOString()]);return {ok:true,student:studentView(u)};}
if(act==='leaderboard'){const leaders=rows('Students').filter(r=>r.v[9]!==true).sort((x,y)=>Number(y.v[6])-Number(x.v[6])).slice(0,20).map(r=>({name:r.v[1],points:Number(r.v[6])}));return {ok:true,rows:leaders};}
if(act==='startQuiz'){
 const pool=rows('Questions').filter(r=>r.v[7]===true||String(r.v[7]).toLowerCase()==='true');if(pool.length<5)throw Error('Competition questions are not published yet. Ask the administrator to add questions.');const shuffled=pool.map(x=>({x,k:Math.random()})).sort((a,b)=>a.k-b.k).slice(0,Math.min(a.competition?5:10,pool.length)).map(x=>x.x);const id=uid();append('Attempts',[id,u.v[0],Boolean(a.competition),shuffled.map(r=>r.v[0]).join(','),Date.now(),Date.now()+30*60*1000,'',0,shuffled.length,0]);return {ok:true,attemptId:id,questions:shuffled.map(r=>({text:r.v[1],options:r.v.slice(2,6)}))};}
if(act==='submitQuiz'){
 const attempt=rows('Attempts').find(r=>r.v[0]===a.attemptId&&r.v[1]===u.v[0]);if(!attempt)throw Error('Quiz attempt not found');if(attempt.v[6])throw Error('Quiz already submitted');if(Date.now()>Number(attempt.v[5]))throw Error('Quiz expired');const ids=String(attempt.v[3]).split(','),ans=a.answers;if(!Array.isArray(ans)||ans.length!==ids.length||ans.some(x=>![0,1,2,3].includes(x)))throw Error('Complete all answers first');const all=rows('Questions');let score=0;ids.forEach((id,i)=>{const q=all.find(r=>r.v[0]===id);if(!q)throw Error('Question unavailable');if(ans[i]===Number(q.v[6]))score++});const pts=score*10;patch('Attempts',attempt.row,7,new Date().toISOString());patch('Attempts',attempt.row,8,score);patch('Attempts',attempt.row,10,pts);patch('Students',u.row,7,Number(u.v[6])+pts);patch('Students',u.row,8,Number(u.v[7])+1);let cert=null;const passed=attempt.v[2]===true&&score/ids.length>=.8;if(passed){const id='SIMA-'+uid().slice(0,12).toUpperCase();append('Certificates',[id,u.v[0],attempt.v[0],score,ids.length,new Date().toISOString()]);cert=id}return {ok:true,score,total:ids.length,passed,certificate:cert,student:studentView(studentById(u.v[0]))};}
throw Error('Unsupported action');}
/** Run after setupSIMA to populate a real starter quiz question bank. */
function seedStarterQuestions(){const s=sheet('Questions');if(s.getLastRow()>1)throw Error('Questions already exist; add new questions from Creator Studio');const bank=[
['Which planet is called the Red Planet?','Venus','Mars','Saturn','Neptune',1],
['What is the largest ocean on Earth?','Atlantic','Indian','Arctic','Pacific',3],
['Which gas do green plants absorb during photosynthesis?','Oxygen','Nitrogen','Carbon dioxide','Helium',2],
['What does AI stand for?','Automatic Internet','Artificial Intelligence','Advanced Illustration','Applied Information',1],
['Which part of a prompt describes where the scene happens?','Setting','Password','Filename','Battery',0],
['Which is a responsible way to use generative AI?','Trust every result','Share a friend’s private data','Check facts and respect privacy','Copy without attribution',2],
['How many players are on the field for one football (soccer) team?','9','10','11','12',2],
['What is the smallest prime number?','0','1','2','4',2],
['Which is a renewable energy source?','Coal','Petrol','Sunlight','Diesel',2],
['What is the capital of Tripura?','Agartala','Shillong','Imphal','Aizawl',0],
['What does a map legend explain?','Map symbols','Weather forecast','Time zones only','A book author',0],
['Which tool can help explain a science idea visually?','Labelled diagram','Unrelated slogan','Random password','Blank page',0],
['What is a good first step when solving a riddle?','Ignore clues','Identify the clues','Guess without reading','Copy someone',1],
['What is the main source of energy for Earth?','The Moon','The Sun','Jupiter','Volcanoes',1],
['Which is an example of good teamwork?','Listening and sharing tasks','Excluding others','Ignoring ideas','Taking all credit',0],
['Which element makes an AI image prompt more specific?','Clear subject and details','Only one vague word','A secret PIN','An unrelated URL',0],
['Which is a good habit when reading online information?','Verify reliable sources','Believe every headline','Share rumors','Skip context',0],
['What is the purpose of a budget?','Plan income and expenses','Make money appear','Avoid saving','Remove all goals',0],
['Which is a primary historical source?','A diary from the time','A modern fictional film','An invented quote','An unrelated advertisement',0],
['Which sentence best expresses SIMA’s philosophy?','AI vs. Human','AI and Human, learning together','AI replaces all thinking','Humans should stop creating',1]
];bank.forEach(q=>append('Questions',[uid(),...q.slice(0,5),q[5],true]));}
