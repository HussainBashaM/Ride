function bookRide(){
  const token = localStorage.getItem("goride_token");
  location.href = token ? "user/dashboard.html" : "user/login.html?next=dashboard";
}
function saveAuth(data){
  localStorage.setItem("goride_token", data.token);
  localStorage.setItem("goride_user", JSON.stringify(data.user));
}
function authHeaders(){
  return { "Content-Type":"application/json", "Authorization":"Bearer "+localStorage.getItem("goride_token") };
}
