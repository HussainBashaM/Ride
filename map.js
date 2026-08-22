function startDemoMap(){
  const map=document.getElementById("map");
  if(!map)return;
  const marker=document.createElement("div");
  marker.textContent="🚗";
  marker.style.cssText="position:absolute;font-size:30px;left:20%;top:55%;transition:all 1s";
  map.appendChild(marker);
  let x=20;
  setInterval(()=>{x=x>=72?20:x+2;marker.style.left=x+"%"},1200);
}
document.addEventListener("DOMContentLoaded",startDemoMap);
