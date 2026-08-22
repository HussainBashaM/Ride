let selectedVehicle="Bike";
function selectVehicle(v, el){
  selectedVehicle=v;
  document.querySelectorAll(".vehicle button").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  estimate();
}
function distanceEstimate(){
  const pickup=document.getElementById("pickup").value.trim();
  const destination=document.getElementById("destination").value.trim();
  if(!pickup || !destination) return 4.2;
  let seed=0; for(const c of pickup+destination) seed=(seed+c.charCodeAt(0))%1000;
  return +(2.5+(seed%1000)/100).toFixed(1);
}
async function estimate(){
  const distance=distanceEstimate();
  try{
    const r=await fetch("/api/rides/estimate",{method:"POST",headers:authHeaders(),body:JSON.stringify({distance,vehicleType:selectedVehicle})});
    const d=await r.json();
    document.getElementById("distance").textContent=d.distance+" km";
    document.getElementById("time").textContent=d.estimatedTime+" min";
    document.getElementById("fare").textContent="₹"+d.fare;
  }catch{}
}
async function confirmRide(){
  const pickup=document.getElementById("pickup").value.trim();
  const destination=document.getElementById("destination").value.trim();
  if(!pickup || !destination) return alert("Enter pickup and destination.");
  const distance=distanceEstimate();
  const est=await fetch("/api/rides/estimate",{method:"POST",headers:authHeaders(),body:JSON.stringify({distance,vehicleType:selectedVehicle})}).then(r=>r.json());
  const body={pickup:{name:pickup},destination:{name:destination},vehicleType:selectedVehicle,distance,estimatedTime:est.estimatedTime,fare:est.fare};
  const result=await fetch("/api/rides",{method:"POST",headers:authHeaders(),body:JSON.stringify(body)}).then(r=>r.json());
  if(result.success){
    localStorage.setItem("goride_active_ride",JSON.stringify(result.ride));
    alert("Ride confirmed! GoRide is searching for a nearby driver.");
    location.href="live-ride.html";
  }else alert(result.message||"Unable to book ride.");
}
