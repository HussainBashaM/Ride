/* =========================================================
   GoRide BOOKING.JS
   Real pickup + destination + route + fare
   ========================================================= */

(function () {

    let selectedVehicle = "Bike";
    let calculating = false;

    const API_BASE =
        window.GORIDE_API ||
        window.API_BASE_URL ||
        localStorage.getItem("API_BASE_URL") ||
        "https://ride-f6la.onrender.com";


    /* =====================================================
       AUTH
       ===================================================== */

    function getToken() {

        return (
            localStorage.getItem("token") ||
            localStorage.getItem("goride_token") ||
            ""
        );
    }


    function authHeaders() {

        const headers = {
            "Content-Type": "application/json"
        };

        const token = getToken();

        if (token) {
            headers.Authorization =
                "Bearer " + token;
        }

        return headers;
    }


    /* =====================================================
       VEHICLE SELECTION
       ===================================================== */

    window.selectVehicle = function (vehicle, element) {

    selectedVehicle = vehicle;

    // Remove active from ALL vehicle buttons
    document
        .querySelectorAll(".vehicle-btn")
        .forEach(function (button) {
            button.classList.remove("active");
        });

    // Add active ONLY to selected button
    if (element) {
        element.classList.add("active");
    }

    // Recalculate fare
    calculateFare();
};

    /* =====================================================
       GET INPUTS
       ===================================================== */

    function getPickupText() {

        const input =
            document.getElementById("pickup");

        return input
            ? input.value.trim()
            : "";
    }


    function getDestinationText() {

        const input =
            document.getElementById("destination");

        return input
            ? input.value.trim()
            : "";
    }


    /* =====================================================
       CURRENT LOCATION
       ===================================================== */

    function getCurrentPickup() {

        if (
            window.GoRideCurrentLocation
        ) {

            return {
                lat:
                    Number(
                        window.GoRideCurrentLocation.lat
                    ),

                lng:
                    Number(
                        window.GoRideCurrentLocation.lng
                    ),

                name:
                    "Current location"
            };
        }

        return null;
    }


    /* =====================================================
       GET REAL ROUTE
       ===================================================== */

    function getRealRoute() {

        if (
            window.GoRideRealRoute &&
            Number(window.GoRideRealRoute.distance) > 0
        ) {

            return window.GoRideRealRoute;
        }

        return null;
    }


    /* =====================================================
       UPDATE DISPLAY
       ===================================================== */

    function updateDisplay(
        distance,
        time,
        fare
    ) {

        const distanceElement =
            document.getElementById("distance");

        const timeElement =
            document.getElementById("time");

        const fareElement =
            document.getElementById("fare");


        if (distanceElement) {

            distanceElement.textContent =
                Number(distance).toFixed(1) +
                " km";
        }


        if (timeElement) {

            timeElement.textContent =
                Math.max(
                    1,
                    Math.ceil(Number(time))
                ) +
                " min";
        }


        if (fareElement) {

            fareElement.textContent =
                "₹" +
                Math.round(Number(fare));
        }
    }


    /* =====================================================
       CALCULATE FARE
       ===================================================== */

    async function calculateFare() {

        if (calculating) {
            return;
        }

        const pickup =
            getPickupText();

        const destination =
            getDestinationText();

        /*
         * Don't calculate until both
         * locations are selected.
         */

        if (!pickup || !destination) {

            const distance =
                document.getElementById("distance");

            const time =
                document.getElementById("time");

            const fare =
                document.getElementById("fare");

            if (distance)
                distance.textContent = "--";

            if (time)
                time.textContent = "--";

            if (fare)
                fare.textContent = "--";

            return;
        }


        /*
         * First use the real route
         * calculated by map.js.
         */

        const route =
            getRealRoute();

        if (
            route &&
            route.distance
        ) {

            await getServerFare(
                route.distance,
                route.duration
            );

            return;
        }


        /*
         * If map route is not ready,
         * wait a little and try again.
         */

        setTimeout(
            function () {

                const latestRoute =
                    getRealRoute();

                if (
                    latestRoute &&
                    latestRoute.distance
                ) {

                    getServerFare(
                        latestRoute.distance,
                        latestRoute.duration
                    );
                }

            },
            700
        );
    }


    /* =====================================================
       SERVER FARE
       ===================================================== */

    async function getServerFare(
        distance,
        routeTime
    ) {

        if (calculating) {
            return;
        }

        calculating = true;

        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/rides/estimate",
                    {
                        method: "POST",

                        headers:
                            authHeaders(),

                        body:
                            JSON.stringify({
                                distance:
                                    Number(distance),

                                vehicleType:
                                    selectedVehicle
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Fare calculation failed"
                );
            }


            /*
             * Server calculates the fare.
             * This keeps fare calculation
             * consistent with your backend.
             */

            const serverDistance =
                Number(data.distance) ||
                Number(distance);

            const serverTime =
                Number(data.estimatedTime) ||
                Number(routeTime) ||
                0;

            const serverFare =
                Number(data.fare) ||
                0;


            updateDisplay(
                serverDistance,
                serverTime,
                serverFare
            );


            /*
             * Save current estimate so
             * confirmRide() can use it.
             */

            window.GoRideBookingEstimate = {

                distance:
                    serverDistance,

                estimatedTime:
                    serverTime,

                fare:
                    serverFare,

                vehicleType:
                    selectedVehicle
            };


        } catch (error) {

            console.error(
                "Fare calculation error:",
                error
            );

        } finally {

            calculating = false;
        }
    }


    /* =====================================================
       ESTIMATE
       ===================================================== */

    window.estimate = function () {

        /*
         * Don't call the server on every
         * character while typing.
         */

        clearTimeout(
            window.GoRideEstimateTimer
        );

        window.GoRideEstimateTimer =
            setTimeout(
                calculateFare,
                600
            );
    };


    /* =====================================================
       CONFIRM RIDE
       ===================================================== */

    window.confirmRide = async function () {

        const pickupText =
            getPickupText();

        const destinationText =
            getDestinationText();


        if (!pickupText) {

            alert(
                "Please select your pickup location."
            );

            return;
        }


        if (!destinationText) {

            alert(
                "Please select your destination."
            );

            return;
        }


        /*
         * Get actual route.
         */

        let route =
            getRealRoute();


        /*
         * Give map.js a moment to finish
         * calculating the route.
         */

        if (!route) {

            await new Promise(
                function (resolve) {
                    setTimeout(
                        resolve,
                        800
                    );
                }
            );

            route =
                getRealRoute();
        }


        if (!route) {

            alert(
                "Please wait for the route and fare to calculate."
            );

            return;
        }


        const distance =
            Number(route.distance);


        const estimatedTime =
            Number(route.duration);


        if (
            !distance ||
            distance <= 0
        ) {

            alert(
                "Unable to calculate route distance."
            );

            return;
        }


        /*
         * Get latest server fare.
         */

        let estimate =
            window.GoRideBookingEstimate;


        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/rides/estimate",
                    {
                        method: "POST",

                        headers:
                            authHeaders(),

                        body:
                            JSON.stringify({
                                distance:
                                    distance,

                                vehicleType:
                                    selectedVehicle
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Unable to calculate fare"
                );
            }


            estimate = data;

        } catch (error) {

            console.error(error);

            alert(
                "Unable to calculate fare. Please try again."
            );

            return;
        }


        /*
         * Pickup coordinates.
         */

        let pickupLocation = null;


        if (
            window.GoRideRouteLocations &&
            window.GoRideRouteLocations.pickup
        ) {

            pickupLocation =
                window.GoRideRouteLocations.pickup;

        } else {

            pickupLocation =
                getCurrentPickup();
        }


        /*
         * Destination coordinates.
         */

        let destinationLocation = null;


        if (
            window.GoRideRouteLocations &&
            window.GoRideRouteLocations.destination
        ) {

            destinationLocation =
                window.GoRideRouteLocations.destination;
        }


        /*
         * Build ride data.
         */

        const rideBody = {

            pickup: {

                name:
                    pickupText,

                lat:
                    pickupLocation
                        ? Number(
                            pickupLocation.lat
                        )
                        : undefined,

                lng:
                    pickupLocation
                        ? Number(
                            pickupLocation.lng
                        )
                        : undefined
            },


            destination: {

                name:
                    destinationText,

                lat:
                    destinationLocation
                        ? Number(
                            destinationLocation.lat
                        )
                        : undefined,

                lng:
                    destinationLocation
                        ? Number(
                            destinationLocation.lng
                        )
                        : undefined
            },


            vehicleType:
                selectedVehicle,

            distance:
                Number(
                    estimate.distance ||
                    distance
                ),

            estimatedTime:
                Number(
                    estimate.estimatedTime ||
                    estimatedTime
                ),

            fare:
                Number(
                    estimate.fare
                )
        };


        /*
         * Disable button while booking.
         */

        const button =
            document.querySelector(
                ".primary.full"
            );


        if (button) {

            button.disabled = true;

            button.textContent =
                "Booking...";
        }


        try {

            const response =
                await fetch(
                    API_BASE +
                    "/api/rides",
                    {
                        method: "POST",

                        headers:
                            authHeaders(),

                        body:
                            JSON.stringify(
                                rideBody
                            )
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Unable to book ride"
                );
            }


            if (!result.success) {

                throw new Error(
                    result.message ||
                    "Unable to book ride"
                );
            }


            /*
             * Save active ride.
             */

            localStorage.setItem(
                "goride_active_ride",
                JSON.stringify(
                    result.ride
                )
            );


            /*
             * Show confirmation.
             */

            alert(
                "Ride confirmed! GoRide is searching for a nearby driver."
            );


            /*
             * Open live ride page.
             */

            window.location.href =
                "live-ride.html";


        } catch (error) {

            console.error(
                "Booking error:",
                error
            );

            alert(
                error.message ||
                "Unable to book ride."
            );


            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Confirm Ride";
            }
        }
    };


    /* =====================================================
       AUTO CURRENT LOCATION
       ===================================================== */

    function setupCurrentLocation() {

        const pickup =
            document.getElementById("pickup");

        if (!pickup) {
            return;
        }


        /*
         * When map.js gets GPS location,
         * use it as pickup.
         */

        const check =
            setInterval(
                function () {

                    const location =
                        window.GoRideCurrentLocation;

                    if (!location) {
                        return;
                    }


                    /*
                     * Don't overwrite a location
                     * the user already typed.
                     */

                    if (
                        !pickup.value.trim() ||
                        pickup.value ===
                        "Enter pickup location"
                    ) {

                        pickup.value =
                            "Current location";
                    }


                    clearInterval(check);

                },
                500
            );


        /*
         * Stop checking after 10 seconds.
         */

        setTimeout(
            function () {
                clearInterval(check);
            },
            10000
        );
    }


    /* =====================================================
       INPUT EVENTS
       ===================================================== */

    function setupBookingEvents() {

        const pickup =
            document.getElementById("pickup");

        const destination =
            document.getElementById(
                "destination"
            );


        if (pickup) {

            pickup.addEventListener(
                "change",
                function () {

                    estimate();

                }
            );
        }


        if (destination) {

            destination.addEventListener(
                "change",
                function () {

                    estimate();

                }
            );
        }
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            setupCurrentLocation();

            setupBookingEvents();

            /*
             * Default vehicle.
             */

            selectedVehicle =
                "Bike";

            console.log(
                "GoRide booking.js loaded."
            );
        }
    );


    /* =====================================================
       PUBLIC OBJECT
       ===================================================== */

    window.GoRideBooking = {

        getVehicle:
            function () {
                return selectedVehicle;
            },

        getEstimate:
            function () {
                return (
                    window.GoRideBookingEstimate ||
                    null
                );
            },

        calculate:
            calculateFare

    };

})();
