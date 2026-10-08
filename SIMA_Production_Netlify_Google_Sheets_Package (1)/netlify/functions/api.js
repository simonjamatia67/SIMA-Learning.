const ALLOWED = new Set(['register','login','me','progress','startQuiz','submitQuiz','leaderboard','adminLogin','adminStats','adminStudents','adminAttempts','adminVerify','adminPublish']);
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return {statusCode:405,body:JSON.stringify({ok:false,error:'Method not allowed'})};
  const url=process.env.SIMA_APPS_SCRIPT_URL, secret=process.env.SIMA_BACKEND_SECRET;
  if (!url||!secret) return {statusCode:503,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'SIMA backend has not been configured by the administrator.'})};
  try {
    if ((event.body||'').length>16000) throw Error('Request too large');
    const data=JSON.parse(event.body||'{}');
    if (!ALLOWED.has(data.action)) throw Error('Unsupported action');
    const res=await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...data,secret}),signal:AbortSignal.timeout(22000)});
    if (!res.ok) throw Error('Google Sheets service unavailable');
    const result=await res.text();
    const parsed=JSON.parse(result);
    return {statusCode:parsed.ok?200:400,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(parsed)};
  } catch(e) {return {statusCode:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({ok:false,error:e.message||'Backend request failed'})};}
};
