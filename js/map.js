/* =========================================================
   GoRide MAP.JS
   Fast GPS + Leaflet map + current location + route
   ========================================================= */

(function () {

    let map = null;
    let currentMarker = null;
    let pickupMarker = null;
    let destinationMarker = null;
    let routeLine = null;

    let pickupLocation = null;
    let destinationLocation = null;

    let gpsLocation = null;
    let leafletLoading = null;

    /* =====================================================
       START GPS IMMEDIATELY
       ===================================================== */

    function getCurrentLocation() {

        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition(

            function (position) {

                const lat =
                    position.coords.latitude;

                const lng =
                    position.coords.longitude;

                gpsLocation = {
                    lat: lat,
                    lng: lng
                };

                window.GoRideCurrentLocation = {
                    lat: lat,
                    lng: lng
                };

                console.log(
                    "GoRide GPS:",
                    lat,
                    lng
                );

                /*
                 * Update current marker if map
                 * has already loaded.
                 */

                updateCurrentMarker();

                /*
                 * Automatically use GPS
                 * as pickup location.
                 */

                const pickup =
                    document.getElementById("pickup");

                if (
                    pickup &&
                    (
                        !pickup.value.trim() ||
                        pickup.value.trim() ===
                        "Current location"
                    )
                ) {

                    pickup.value =
                        "Current location";

                    setLocation(
                        "pickup",
                        lat,
                        lng,
                        "Current location"
                    );
                }

            },

            function (error) {

                console.warn(
                    "GoRide GPS error:",
                    error.message
                );

                /*
                 * Do not break the map if
                 * location permission is denied.
                 */

            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        );
    }


    /* =====================================================
       LOAD LEAFLET
       ===================================================== */

    function loadLeaflet() {

        if (window.L) {
            return Promise.resolve();
        }

        if (leafletLoading) {
            return leafletLoading;
        }

        leafletLoading =
            new Promise(function (resolve, reject) {

                const css =
                    document.createElement("link");

                css.rel = "stylesheet";

                css.href =
                    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

                document.head.appendChild(css);


                const script =
                    document.createElement("script");

                script.src =
                    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

                script.onload =
                    function () {

                        resolve();
                    };

                script.onerror =
                    function () {

                        reject(
                            new Error(
                                "Unable to load Leaflet"
                            )
                        );
                    };

                document.head.appendChild(script);
            });

        return leafletLoading;
    }


    /* =====================================================
       INITIALIZE MAP
       ===================================================== */

    async function initMap() {

        const mapElement =
            document.getElementById("map");

        if (!mapElement) {
            return;
        }

        /*
         * IMPORTANT:
         * Start GPS without waiting for Leaflet.
         */

        getCurrentLocation();

        try {

            await loadLeaflet();

            if (map) {

                setTimeout(function () {
                    map.invalidateSize();
                }, 100);

                updateCurrentMarker();

                return;
            }

            map =
                L.map("map", {
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


            /*
             * If GPS arrived while Leaflet
             * was loading, use it now.
             */

            updateCurrentMarker();


            setupLocationInputs();


            /*
             * Fix map size after rendering.
             */

            setTimeout(function () {

                if (map) {
                    map.invalidateSize();
                }

            }, 300);


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
       CURRENT MARKER
       ===================================================== */

    function updateCurrentMarker() {

        if (!map || !gpsLocation) {
            return;
        }

        const position = [
            gpsLocation.lat,
            gpsLocation.lng
        ];


        if (currentMarker) {

            currentMarker.setLatLng(
                position
            );

        } else {

            currentMarker =
                L.marker(position)
                    .addTo(map)
                    .bindPopup(
                        "📍 Your current location"
                    );
        }


        /*
         * If no locations have been
         * selected, center on GPS.
         */

        if (
            !pickupLocation &&
            !destinationLocation
        ) {

            map.setView(
                position,
                15
            );
        }
    }


    /* =====================================================
       USE CURRENT LOCATION
       ===================================================== */

    function useCurrentLocation() {

        const pickup =
            document.getElementById("pickup");

        /*
         * Already have GPS.
         */

        if (gpsLocation) {

            if (pickup) {

                pickup.value =
                    "Current location";
            }

            setLocation(
                "pickup",
                gpsLocation.lat,
                gpsLocation.lng,
                "Current location"
            );

            return;
        }


        /*
         * GPS not ready yet.
         */

        if (!navigator.geolocation) {

            alert(
                "Your device does not support location."
            );

            return;
        }


        navigator.geolocation.getCurrentPosition(

            function (position) {

                const lat =
                    position.coords.latitude;

                const lng =
                    position.coords.longitude;

                gpsLocation = {
                    lat: lat,
                    lng: lng
                };

                window.GoRideCurrentLocation = {
                    lat: lat,
                    lng: lng
                };


                if (pickup) {

                    pickup.value =
                        "Current location";
                }


                setLocation(
                    "pickup",
                    lat,
                    lng,
                    "Current location"
                );


                updateCurrentMarker();

            },

            function (error) {

                console.error(
                    "Location error:",
                    error
                );

                alert(
                    "Please allow location permission and try again."
                );

            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
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

                const value =
                    pickup.value.trim();

                if (
                    value.toLowerCase() ===
                    "current location"
                ) {

                    useCurrentLocation();

                } else {

                    geocodeLocation(
                        value,
                        "pickup"
                    );
                }
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


        pickup.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    const value =
                        pickup.value.trim();

                    if (
                        value.toLowerCase() ===
                        "current location"
                    ) {

                        useCurrentLocation();

                    } else {

                        geocodeLocation(
                            value,
                            "pickup"
                        );
                    }
                }
            }
        );


        destination.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Enter"
                ) {

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

        if (!query) {
            return;
        }


        if (
            type === "pickup" &&
            query.toLowerCase() ===
            "current location"
        ) {

            useCurrentLocation();

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

                alert(
                    "Location not found. Try a more specific area name."
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

            alert(
                "Unable to find this location. Please check your internet connection."
            );
        }
    }


    /* =====================================================
       SET LOCATION
       ===================================================== */

    function setLocation(
        type,
        lat,
        lng,
        name
    ) {

        /*
         * Save location FIRST.
         * Don't wait for map.
         */

        const location = {

            lat: Number(lat),

            lng: Number(lng),

            name:
                name ||
                "Selected location"
        };


        if (type === "pickup") {

            pickupLocation =
                location;

        } else {

            destinationLocation =
                location;
        }


        /*
         * Make location available
         * to booking.js immediately.
         */

        window.GoRideRouteLocations = {

            pickup:
                pickupLocation,

            destination:
                destinationLocation
        };


        /*
         * If Leaflet isn't ready yet,
         * stop here. The location is still saved.
         */

        if (!map || !window.L) {
            return;
        }


        updateLocationMarker(
            type,
            location
        );


        fitLocations();


        if (
            pickupLocation &&
            destinationLocation
        ) {

            drawRoute();
        }
    }


    /* =====================================================
       UPDATE LOCATION MARKER
       ===================================================== */

    function updateLocationMarker(
        type,
        location
    ) {

        const point = [
            location.lat,
            location.lng
        ];


        if (type === "pickup") {

            if (pickupMarker) {

                pickupMarker.setLatLng(
                    point
                );

            } else {

                pickupMarker =
                    L.marker(point)
                        .addTo(map)
                        .bindPopup(
                            "📍 Pickup"
                        );
            }

        } else {

            if (destinationMarker) {

                destinationMarker.setLatLng(
                    point
                );

            } else {

                destinationMarker =
                    L.marker(point)
                        .addTo(map)
                        .bindPopup(
                            "🏁 Destination"
                        );
            }
        }
                           }


     /* =====================================================
       FIT MAP TO LOCATIONS
       ===================================================== */

    function fitLocations() {

        if (!map) {
            return;
        }


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
                    padding: [
                        40,
                        40
                    ]
                }
            );
        }
    }


    /* =====================================================
       DRAW REAL ROAD ROUTE
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
                start.lng +
                "," +
                start.lat +
                ";" +
                end.lng +
                "," +
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
             * Real road distance.
             */

            const distanceKm =
                route.distance / 1000;


            /*
             * Real road duration.
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
             * Update UI.
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
             * Tell booking.js to
             * calculate the fare.
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
       PUBLIC API
       ===================================================== */

    window.GoRideMap = {

        init:
            initMap,

        getCurrentLocation:
            getCurrentLocation,

        useCurrentLocation:
            useCurrentLocation,

        geocode:
            geocodeLocation,

        getPickup:
            function () {
                return pickupLocation;
            },

        getDestination:
            function () {
                return destinationLocation;
            },

        getRoute:
            function () {

                return (
                    window.GoRideRealRoute ||
                    null
                );
            }
    };


    /*
     * Easy global function for HTML.
     */

    window.useCurrentLocation =
        useCurrentLocation;


    /* =====================================================
       INITIALIZE
       ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            /*
             * Start GPS immediately.
             */

            getCurrentLocation();

            /*
             * Start map separately.
             */

            initMap();
        }
    );

})();
