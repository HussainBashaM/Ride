const API = "";
async function postJSON(url, body){
  const r = await fetch(API + url, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  return r.json();
}
function goAfterLogin(){
  const next = new URLSearchParams(location.search).get("next");
  location.href = next === "dashboard" ? "dashboard.html" : "../index.html";
}
