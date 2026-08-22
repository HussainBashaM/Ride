const API = "/api";
const state = {
  token: localStorage.getItem("goride_token"),
  user: JSON.parse(localStorage.getItem("goride_user") || "null"),
  selectedVehicle: "bike",
  pickup: null,
  destination: null,
  route: null,
  riderMap: null,
  driverMap: null,
  riderLayer: null,
  driverLayer: null,
  online: false,
  activeRide: null,
  timers: []
};

const rates = {
  bike: { base: 30, perKm: 9 },
  auto: { base: 45, perKm: 13 },
  car: { base: 70, perKm: 18 }
};

const $ = id => document.getElementById(id);
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
function saveAuth(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("goride_token", state.token);
  localStorage.setItem("goride_user", JSON.stringify(state.user));
  updateNav();
}
function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem("goride_token"); localStorage.removeItem("goride_user");
  state.timers.forEach(clearInterval); state.timers = [];
  updateNav(); showPage("home"); toast("Logged out.");
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
function updateNav() {
  $("navDashboard").classList.toggle("hidden", !state.user);
  $("navLogout").classList.toggle("hidden", !state.user);
  if (state.user) {
    $("navDashboard").textContent = state.user.role === "driver" ? "Driver Dashboard" : "Dashboard";
  }
}
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const map = { home:"home", login:"auth", register:"auth", driverRegister:"driverRegister", rider:"riderDashboard", driver:"driverDashboard", forgot:"forgot", reset:"reset" };
  $(map[name] || name).classList.add("active");
  if (name === "rider") initRiderMap();
  if (name === "driver") initDriverMap();
  window.scrollTo(0,0);
}
function goDashboard() {
  if (!state.user) return showPage("login");
  showPage(state.user.role === "driver" ? "driver" : "rider");
}
function configureAuth(mode) {
  const register = mode === "register";
  $("authTitle").innerHTML = `<span class="eyebrow">${register ? "JOIN GORIDE" : "WELCOME BACK"}</span><h2>${register ? "Create your account" : "Log in to GoRide"}</h2>`;
  $("name").required = register;
  $("phone").required = register;
  $("name").style.display = register ? "" : "none";
  $("phone").style.display = register ? "" : "none";
  $("roleBox").style.display = register ? "flex" : "none";
  $("authSubmit").textContent = register ? "Create account" : "Log in";
  $("forgotBtn").style.display = register ? "none" : "";
  $("authSwitch").innerHTML = register ? `Already have an account? <button class="text-btn" type="button" id="switchLogin">Login</button>` : `New to GoRide? <button class="text-btn" type="button" id="switchRegister">Register</button>`;
  $("switchLogin")?.addEventListener("click", () => { configureAuth("login"); });
  $("switchRegister")?.addEventListener("click", () => { configureAuth("register"); });
}
function initAuth(mode) { configureAuth(mode); showPage(mode); }

document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", () => {
  const route = btn.dataset.route;
  if (route === "login" || route === "register") initAuth(route);
  else if (route === "driver-register") showPage("driverRegister");
  else if (route === "home") showPage("home");
}));

$("bookRide").addEventListener("click", () => {
  if (!state.user) initAuth("login");
  else if (state.user.role !== "rider") { toast("Driver accounts cannot book rider trips."); showPage("driver"); }
  else showPage("rider");
});
$("navDashboard").addEventListener("click", goDashboard);
$("navLogout").addEventListener("click", logout);
$("forgotBtn").addEventListener("click", () => showPage("forgot"));

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const mode = $("authSubmit").textContent.includes("Create");
  const role = document.querySelector('input[name="role"]:checked')?.value || "rider";
  try {
    const data = await api("/auth/" + (mode ? "register" : "login"), {
      method:"POST",
      body: JSON.stringify({
        name:$("name").value, email:$("email").value, phone:$("phone").value,
        password:$("password").value, role
      })
    });
    saveAuth(data); toast(data.message || "Success"); goDashboard();
  } catch(err) { toast(err.message); }
});

$("forgotForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { const d = await api("/auth/forgot-password",{method:"POST",body:JSON.stringify({email:$("forgotEmail").value})}); toast(d.message); showPage("reset"); }
  catch(err){toast(err.message)}
});
$("resetForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { const d=await api("/auth/reset-password",{method:"POST",body:JSON.stringify({newPassword:$("newPassword").value})}); toast(d.message); showPage("home"); }
  catch(err){toast(err.message)}
});

$("driverForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const d=await api("/auth/register",{method:"POST",body:JSON.stringify({
      name:$("dName").value,email:$("dEmail").value,phone:$("dPhone").value,password:$("dPassword").value,role:"driver",
      vehicleType:$("dVehicle").value,vehicleNumber:$("dVehicleNumber").value,licenseNumber:$("dLicense").value,documentName:$("dDocument").value
    })});
    saveAuth(d); toast("Driver application submitted."); showPage("driver");
  } catch(err){toast(err.message)}
});

function initRiderMap() {
  if (state.riderMap) { setTimeout(()=>state.riderMap.invalidateSize(),100); return; }
  state.riderMap = L.map("riderMap").setView([16.5062,80.6480], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(state.riderMap);
  locateUser(state.riderMap, true);
}
function initDriverMap() {
  if (state.driverMap) { setTimeout(()=>state.driverMap.invalidateSize(),100); return; }
  state.driverMap = L.map("driverMap").setView([16.5062,80.6480],12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors"}).addTo(state.driverMap);
  sendDriverLocation();
}
function locateUser(map, setPickup) {
  if (!navigator.geolocation) return toast("Location is not supported by this browser.");
  navigator.geolocation.getCurrentPosition(pos=>{
    const loc=[pos.coords.latitude,pos.coords.longitude];
    map.setView(loc,15);
    L.marker(loc).addTo(map).bindPopup("Your location").openPopup();
    if(setPickup){ state.pickup={lat:loc[0],lng:loc[1],address:"Current location"}; $("pickup").value="Current location"; }
  },()=>toast("Location permission was not granted."));
}
async function geocode(q) {
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res=await fetch(url,{headers:{Accept:"application/json"}});
  const data=await res.json();
  if(!data[0]) throw new Error(`Could not find "${q}".`);
  return {lat:Number(data[0].lat),lng:Number(data[0].lon),address:data[0].display_name};
}
async function getRoute(a,b) {
  const url=`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res=await fetch(url); const data=await res.json();
  if(data.code!=="Ok" || !data.routes?.[0]) throw new Error("Route could not be calculated.");
  const r=data.routes[0];
  return {distanceKm:r.distance/1000,etaMin:Math.max(1,Math.round(r.duration/60)),geometry:r.geometry};
}
function drawRiderRoute(route) {
  if(state.riderLayer) state.riderMap.removeLayer(state.riderLayer);
  state.riderLayer=L.geoJSON(route.geometry,{style:{weight:6}}).addTo(state.riderMap);
  state.riderMap.fitBounds(state.riderLayer.getBounds(),{padding:[30,30]});
  L.marker([state.pickup.lat,state.pickup.lng]).addTo(state.riderMap).bindPopup("Pickup");
  L.marker([state.destination.lat,state.destination.lng]).addTo(state.riderMap).bindPopup("Destination");
}
$("routeBtn").addEventListener("click", async()=>{
  try {
    $("routeBtn").disabled=true; $("routeBtn").textContent="Calculating…";
    state.pickup = state.pickup?.address === $("pickup").value ? state.pickup : await geocode($("pickup").value);
    state.destination = await geocode($("destination").value);
    state.route = await getRoute(state.pickup,state.destination);
    drawRiderRoute(state.route);
    const r=rates[state.selectedVehicle];
    const fare=Math.round(r.base+state.route.distanceKm*r.perKm);
    $("fare").textContent=`₹${fare}`;$("distance").textContent=`${state.route.distanceKm.toFixed(1)} km`;$("eta").textContent=`${state.route.etaMin} min`;
    $("routeBtn").textContent="Route updated";
  }catch(err){toast(err.message);$("routeBtn").textContent="Show Route & Estimate"}
  $("routeBtn").disabled=false;
});
document.querySelectorAll(".vehicle").forEach(v=>v.addEventListener("click",()=>{
  document.querySelectorAll(".vehicle").forEach(x=>x.classList.remove("active"));v.classList.add("active");state.selectedVehicle=v.dataset.vehicle;
  if(state.route){const r=rates[state.selectedVehicle];$("fare").textContent=`₹${Math.round(r.base+state.route.distanceKm*r.perKm)}`}
}));
$("centerMap").addEventListener("click",()=>locateUser(state.riderMap,false));

$("confirmRide").addEventListener("click",async()=>{
  if(!state.route) return toast("Show the route first.");
  try{
    const r=rates[state.selectedVehicle];
    const fare=Math.round(r.base+state.route.distanceKm*r.perKm);
    const d=await api("/rides",{method:"POST",body:JSON.stringify({pickup:state.pickup,destination:state.destination,vehicleType:state.selectedVehicle,distanceKm:Number(state.route.distanceKm.toFixed(2)),etaMin:state.route.etaMin,fare})});
    state.currentRide=d.ride;
    renderRideStatus(d.ride); startRiderPolling(d.ride._id); toast("Ride requested.");
  }catch(err){toast(err.message)}
});
function renderRideStatus(ride){
  const el=$("rideStatus");el.classList.remove("hidden");
  const labels={searching:"Searching for a driver…",driver_assigned:"Driver assigned",driver_arriving:"Driver arriving",in_progress:"Trip in progress",completed:"Trip completed",canceled:"Ride canceled"};
  el.innerHTML=`<div>${labels[ride.status]||ride.status}</div><small>${ride.driverId?.name ? "Driver: "+ride.driverId.name : "Please keep this screen open."}</small>${!["completed","canceled"].includes(ride.status)?'<button class="secondary full" id="cancelRiderRide" style="margin-top:10px">Cancel Ride</button>':""}`;
  $("cancelRiderRide")?.addEventListener("click",async()=>{try{const d=await api(`/rides/${ride._id}/cancel`,{method:"PUT"});renderRideStatus(d.ride);toast("Ride canceled.");}catch(e){toast(e.message)}});
}
function startRiderPolling(id){
  const old=state.timers.find(x=>x._gorideRide); if(old) clearInterval(old);
  const timer=setInterval(async()=>{try{const d=await api(`/rides/${id}`);renderRideStatus(d.ride);if(["completed","canceled"].includes(d.ride.status))clearInterval(timer)}catch{}},5000);timer._gorideRide=true;state.timers.push(timer);
}

$("onlineToggle").addEventListener("click",async()=>{
  try{state.online=!state.online;const d=await api("/drivers/status",{method:"PUT",body:JSON.stringify({online:state.online})});state.online=d.online;updateOnline();if(state.online){sendDriverLocation();startDriverPolling()}toast(state.online?"You are online.":"You are offline.");}
  catch(e){toast(e.message)}
});
function updateOnline(){const b=$("onlineToggle");b.className="online "+(state.online?"on":"off");b.textContent=state.online?"● Online":"● Offline"}
async function sendDriverLocation(){
  if(!state.user || state.user.role!=="driver" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async p=>{
    const loc=[p.coords.latitude,p.coords.longitude];state.driverMap?.setView(loc,15);
    L.circleMarker(loc,{radius:9}).addTo(state.driverMap).bindPopup("Driver location");
    try{await api("/drivers/location",{method:"PUT",body:JSON.stringify({lat:loc[0],lng:loc[1]})})}catch{}
  },()=>{});
}
async function startDriverPolling(){
  if(state.driverPoll)clearInterval(state.driverPoll);
  await refreshDriverRequests();
  state.driverPoll=setInterval(refreshDriverRequests,5000);
  state.locationPoll=setInterval(sendDriverLocation,10000);
}
async function refreshDriverRequests(){
  if(!state.online)return;
  try{
    const d=await api("/drivers/requests");
    $("requests").innerHTML=d.rides.length?d.rides.map(r=>`
      <div class="request"><div class="row"><b>${r.vehicleType.toUpperCase()}</b><b>₹${r.fare}</b></div>
      <small>${r.pickup.address||"Pickup"} → ${r.destination.address||"Destination"}</small>
      <div class="request-actions"><button class="primary" onclick="acceptRide('${r._id}')">Accept</button><button class="secondary" onclick="skipRide('${r._id}')">Skip</button></div></div>`).join(""):`<div class="empty">No new ride requests.</div>`;
    const active=await api("/drivers/active-ride");if(active.ride){state.activeRide=active.ride;renderActiveRide(active.ride)}
  }catch(e){}
}
window.acceptRide=async id=>{try{const d=await api(`/drivers/rides/${id}/accept`,{method:"PUT"});state.activeRide=d.ride;renderActiveRide(d.ride);toast("Ride accepted.");}catch(e){toast(e.message)}};
window.skipRide=async id=>{try{await api(`/drivers/rides/${id}/skip`,{method:"PUT"});toast("Request skipped.");refreshDriverRequests()}catch(e){toast(e.message)}};
function renderActiveRide(ride){
  $("activeRidePanel").classList.remove("hidden");
  $("activeRide").innerHTML=`<p><b>Pickup:</b> ${ride.pickup.address||"Pickup"}</p><p><b>Destination:</b> ${ride.destination.address||"Destination"}</p><p><b>Fare:</b> ₹${ride.fare} · <b>Distance:</b> ${Number(ride.distanceKm||0).toFixed(1)} km</p>
  <div class="ride-actions">
  ${ride.status==="driver_assigned"?'<button class="primary" onclick="rideStatus(\'driver_arriving\')">Start Navigation / Arriving</button>':""}
  ${ride.status==="driver_arriving"?'<button class="primary" onclick="rideStatus(\'in_progress\')">Mark Arrival & Start Ride</button>':""}
  ${ride.status==="in_progress"?'<button class="primary" onclick="rideStatus(\'completed\')">Complete Ride</button>':""}
  <button class="secondary" onclick="cancelDriverRide()">Cancel Ride</button></div>`;
  if(state.driverMap){L.marker([ride.pickup.lat,ride.pickup.lng]).addTo(state.driverMap).bindPopup("Pickup");L.marker([ride.destination.lat,ride.destination.lng]).addTo(state.driverMap).bindPopup("Destination");}
}
window.rideStatus=async status=>{try{const d=await api(`/drivers/rides/${state.activeRide._id}/status`,{method:"PUT",body:JSON.stringify({status})});state.activeRide=d.ride;renderActiveRide(d.ride);toast("Ride status updated.");}catch(e){toast(e.message)}};
window.cancelDriverRide=async()=>{try{const d=await api(`/rides/${state.activeRide._id}/cancel`,{method:"PUT"});state.activeRide=d.ride;renderActiveRide(d.ride);toast("Ride canceled.");}catch(e){toast(e.message)}};

updateNav();
if(state.user) $("navDashboard").classList.remove("hidden");
if(location.hash==="#dashboard")goDashboard();
