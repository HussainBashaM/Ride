const socket = typeof io==="function" ? io() : null;
let online=false;
async function setOnline(){
  online=!online;
  const locationData={lat:16.52,lng:77.73};
  const r=await fetch("/api/drivers/status",{method:"POST",headers:authHeaders(),body:JSON.stringify({online,location:locationData})});
  const d=await r.json();
  document.getElementById("onlineState").textContent=online?"ONLINE":"OFFLINE";
  document.getElementById("onlineState").className=online?"status":"muted";
}
async function acceptRide(id){
  const r=await fetch("/api/rides/"+id+"/accept",{method:"POST",headers:authHeaders()});
  const d=await r.json(); if(d.success){localStorage.setItem("driver_active_ride",JSON.stringify(d.ride));location.href="active-ride.html";}
}
async function updateRideStatus(status){
  const ride=JSON.parse(localStorage.getItem("driver_active_ride")||"null");
  if(!ride)return;
  const r=await fetch("/api/rides/"+ride._id+"/status",{method:"POST",headers:authHeaders(),body:JSON.stringify({status})});
  const d=await r.json();
  if(d.success){localStorage.setItem("driver_active_ride",JSON.stringify(d.ride));alert("Ride status: "+status);}
}
