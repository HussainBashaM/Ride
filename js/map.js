/* =========================================================
   GoRide MAP.JS
   Real map + current location + route
   ========================================================= */

(function () {

    let map = null;
    let currentMarker = null;
    let pickupMarker = null;
    let destinationMarker = null;
    let routeLine = null;

    let pickupLocation = null;
    let destinationLocation = null;

    let leafletLoaded = false;

    /* =====================================================
       LOAD LEAFLET
       ===================================================== */

    function loadLeaflet() {

        return new Promise(function (resolve, reject) {

            if (window.L) {
                leafletLoaded = true;
                resolve();
                return;
            }

            const css = document.createElement("link");

            css.rel = "stylesheet";
            css.href =
                "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

            document.head.appendChild(css);

            const script =
                document.createElement("script");

            script.src =
                "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

            script.onload = function () {
                leafletLoaded = true;
                resolve();
            };

            script.onerror = function () {
                reject(
                    new Error("Unable to load map library")
                );
            };

            document.head.appendChild(script);
        });
    }


    /* =====================================================
       INITIALIZE MAP
       ===================================================== */

    async function initMap() {

        const mapElement =
            document.getElementById("map");

        if (!mapElement) return;

        try {

            await loadLeaflet();

            if (map) {
                map.invalidateSize();
                return;
            }

            /*
             * Default location:
             * India center
             */

            map = L.map("map", {
                zoomControl: true
            }).setView(
                [20.5937, 78.9629],
                5
            );

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                        "&copy; OpenStreetMap contributors"
                }
            ).addTo(map);

            getCurrentLocation();

            setupLocationInputs();

        } catch (error) {

            console.error(
                "GoRide map error:",
                error
            );

            mapElement.innerHTML = `
                <div style="
                    height:100%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    padding:20px;
                    text-align:center;
                    color:#777;
                    background:#f5f3f8;
                ">
                    Unable to load map.<br>
                    Please check your internet connection.
                </div>
            `;
        }
    }


    /* =====================================================
       CURRENT LOCATION
       ===================================================== */

    function getCurrentLocation() {

        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(

            function (position) {

                const lat =
                    position.coords.latitude;

                const lng =
                    position.coords.longitude;

                const current =
                    [lat, lng];

                if (!map) return;

                if (currentMarker) {
                    currentMarker.setLatLng(current);
                } else {

                    currentMarker =
                        L.marker(current)
                        .addTo(map)
                        .bindPopup(
                            "📍 Your current location"
                        );
                }

                /*
                 * Only zoom to current location
                 * if no pickup/destination is selected.
                 */

                if (
                    !pickupLocation &&
                    !destinationLocation
                ) {

                    map.setView(
                        current,
                        15
                    );
                }

                const pickup =
                    document.getElementById("pickup");

                if (
                    pickup &&
                    !pickup.value.trim()
                ) {

                    pickup.value =
                        "Current location";
                }

                window.GoRideCurrentLocation = {
                    lat: lat,
                    lng: lng
                };
            },

            function (error) {

                console.warn(
                    "Location permission:",
                    error.message
                );
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    }


    /* =====================================================
       LOCATION INPUTS
       ===================================================== */

    function setupLocationInputs() {

        const pickup =
            document.getElementById("pickup");

        const destination =
            document.getElementById("destination");

        if (!pickup || !destination) {
            return;
        }

        pickup.addEventListener(
            "change",
            function () {

                geocodeLocation(
                    pickup.value.trim(),
                    "pickup"
                );
            }
        );

        destination.addEventListener(
            "change",
            function () {

                geocodeLocation(
                    destination.value.trim(),
                    "destination"
                );
            }
        );

        /*
         * Also support pressing Enter.
         */

        pickup.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    geocodeLocation(
                        pickup.value.trim(),
                        "pickup"
                    );
                }
            }
        );

        destination.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    geocodeLocation(
                        destination.value.trim(),
                        "destination"
                    );
                }
            }
        );
    }


    /* =====================================================
       GEOCODING
       ===================================================== */

    async function geocodeLocation(
        query,
        type
    ) {

        if (!query) return;

        /*
         * If user selects current location,
         * use browser GPS.
         */

        if (
            type === "pickup" &&
            query.toLowerCase() ===
            "current location"
        ) {

            if (
                window.GoRideCurrentLocation
            ) {

                setLocation(
                    "pickup",
                    window.GoRideCurrentLocation.lat,
                    window.GoRideCurrentLocation.lng,
                    "Current location"
                );

            } else {

                getCurrentLocation();
            }

            return;
        }

        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=json" +
                "&limit=1" +
                "&q=" +
                encodeURIComponent(query);

            const response =
                await fetch(url);

            if (!response.ok) {
                throw new Error(
                    "Geocoding failed"
                );
            }

            const results =
                await response.json();

            if (
                !results ||
                !results.length
            ) {

                console.warn(
                    "Location not found:",
                    query
                );

                return;
            }

            const result =
                results[0];

            const lat =
                Number(result.lat);

            const lng =
                Number(result.lon);

            setLocation(
                type,
                lat,
                lng,
                result.display_name
            );

        } catch (error) {

            console.error(
                "Geocoding error:",
                error
            );
        }
    }


    /* =====================================================
       SET PICKUP / DESTINATION
       ===================================================== */

    function setLocation(
        type,
        lat,
        lng,
        name
    ) {

        if (!map) return;

        const location = {
            lat: lat,
            lng: lng,
            name: name
        };

        if (type === "pickup") {

            pickupLocation = location;

            if (pickupMarker) {
                pickupMarker.setLatLng(
                    [lat, lng]
                );
            } else {

                pickupMarker =
                    L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup(
                        "📍 Pickup"
                    );
            }

        } else {

            destinationLocation =
                location;

            if (destinationMarker) {
                destinationMarker.setLatLng(
                    [lat, lng]
                );
            } else {

                destinationMarker =
                    L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup(
                        "🏁 Destination"
                    );
            }
        }

        /*
         * Show both points on screen.
         */

        fitLocations();

        /*
         * Draw route when both are available.
         */

        if (
            pickupLocation &&
            destinationLocation
        ) {

            drawRoute();
        }

        /*
         * Tell booking.js about
         * the real distance.
         */

        window.GoRideRouteLocations = {
            pickup: pickupLocation,
            destination: destinationLocation
        };
    }


    /* =====================================================
       FIT MAP TO LOCATIONS
       ===================================================== */

    function fitLocations() {

        if (!map) return;

        const points = [];

        if (pickupLocation) {

            points.push([
                pickupLocation.lat,
                pickupLocation.lng
            ]);
        }

        if (destinationLocation) {

            points.push([
                destinationLocation.lat,
                destinationLocation.lng
            ]);
        }

        if (points.length === 1) {

            map.setView(
                points[0],
                14
            );

        } else if (points.length === 2) {

            map.fitBounds(
                L.latLngBounds(points),
                {
                    padding: [40, 40]
                }
            );
        }
    }


    /* =====================================================
       DRAW REAL ROUTE
       ===================================================== */

    async function drawRoute() {

        if (
            !pickupLocation ||
            !destinationLocation 
        ) {
            return;
        }

        const start =
            pickupLocation;

        const end =
            destinationLocation;

        try {

            const url =
                "https://router.project-osrm.org/route/v1/driving/" +
                start.lng + "," +
                start.lat + ";" +
                end.lng + "," +
                end.lat +
                "?overview=full&geometries=geojson";

            const response =
                await fetch(url);

            if (!response.ok) {
                throw new Error(
                    "Routing failed"
                );
            }

            const data =
                await response.json();

            if (
                !data.routes ||
                !data.routes.length
            ) {
                return;
            }

            const route =
                data.routes[0];

            /*
             * Remove old route.
             */

            if (routeLine) {

                map.removeLayer(
                    routeLine
                );
            }

            routeLine =
                L.geoJSON(
                    route.geometry,
                    {
                        style: {
                            weight: 5,
                            opacity: 0.85
                        }
                    }
                ).addTo(map);

            /*
             * Actual road distance.
             */

            const distanceKm =
                route.distance / 1000;

            /*
             * Actual route duration.
             */

            const durationMin =
                Math.max(
                    1,
                    Math.ceil(
                        route.duration / 60
                    )
                );

            window.GoRideRealRoute = {

                distance:
                    Number(
                        distanceKm.toFixed(1)
                    ),

                duration:
                    durationMin,

                pickup:
                    start,

                destination:
                    end
            };

            /*
             * Update dashboard values
             * immediately if elements exist.
             */

            const distance =
                document.getElementById(
                    "distance"
                );

            const time =
                document.getElementById(
                    "time"
                );

            if (distance) {

                distance.textContent =
                    distanceKm.toFixed(1) +
                    " km";
            }

            if (time) {

                time.textContent =
                    durationMin +
                    " min";
            }

            /*
             * Let booking.js recalculate fare.
             */

            if (
                typeof window.estimate ===
                "function"
            ) {

                window.estimate();
            }

        } catch (error) {

            console.error(
                "Route error:",
                error
            );
        }
    }


    /* =====================================================
       PUBLIC FUNCTIONS
       ===================================================== */

    window.GoRideMap = {

        init: initMap,

        getCurrentLocation:
            getCurrentLocation,

        geocode:
            geocodeLocation,

        getPickup: function () {
            return pickupLocation;
        },

        getDestination: function () {
            return destinationLocation;
        },

        getRoute: function () {
            return window.GoRideRealRoute || null;
        }
    };


    /*
     * Initialize automatically.
     */

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            initMap();
        }
    );

})();
