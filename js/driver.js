/* =========================================================
   GoRide DRIVER.JS
   Driver online + GPS + real-time ride requests
   ========================================================= */

const API_BASE =
    window.GORIDE_API ||
    window.API_BASE_URL ||
    localStorage.getItem("API_BASE_URL") ||
    "https://ride-f6la.onrender.com";

const socket =
    typeof io === "function"
        ? io(API_BASE, {
            transports: ["websocket", "polling"]
        })
        : null;

let online = false;
let locationWatcher = null;


/* =========================================================
   AUTH
   ========================================================= */

function authHeaders() {

    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("goride_token") ||
        "";

    return {
        "Content-Type": "application/json",

        ...(token
            ? {
                Authorization:
                    "Bearer " + token
            }
            : {})
    };
}


/* =========================================================
   DRIVER ID
   ========================================================= */

function getDriverId() {

    try {

        const user =
            JSON.parse(
                localStorage.getItem("user") ||
                localStorage.getItem("goride_user") ||
                "null"
            );

        return (
            user?.id ||
            user?._id ||
            null
        );

    } catch {

        return null;
    }
}


/* =========================================================
   CURRENT GPS
   ========================================================= */

function getCurrentLocation() {

    return new Promise(function (resolve) {

        if (!navigator.geolocation) {

            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(

            function (position) {

                resolve({
                    lat:
                        position.coords.latitude,

                    lng:
                        position.coords.longitude
                });
            },

            function (error) {

                console.warn(
                    "GPS error:",
                    error.message
                );

                resolve(null);
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    });
}


/* =========================================================
   SEND DRIVER LOCATION
   ========================================================= */

async function sendDriverLocation(
    location
) {

    if (!online || !location) {
        return;
    }

    try {

        const response =
            await fetch(
                API_BASE +
                "/api/drivers/status",
                {
                    method: "POST",

                    headers:
                        authHeaders(),

                    body:
                        JSON.stringify({
                            online: true,
                            location: location
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok || !data.success) {

            console.warn(
                "Location update failed:",
                data.message
            );

            return;
        }

        /*
         * Also send live location
         * through Socket.IO.
         */

        const driverId =
            getDriverId();

        if (
            socket &&
            driverId
        ) {

            socket.emit(
                "driver:location",
                {
                    driverId:
                        driverId,

                    location:
                        location
                }
            );
        }

    } catch (error) {

        console.error(
            "Driver location error:",
            error
        );
    }
}


/* =========================================================
   START GPS TRACKING
   ========================================================= */

function startLocationTracking() {

    if (!navigator.geolocation) {

        console.warn(
            "Geolocation is not supported."
        );

        return;
    }


    stopLocationTracking();


    locationWatcher =
        navigator.geolocation.watchPosition(

            function (position) {

                if (!online) {
                    return;
                }

                const location = {

                    lat:
                        position.coords.latitude,

                    lng:
                        position.coords.longitude
                };

                sendDriverLocation(
                    location
                );
            },

            function (error) {

                console.warn(
                    "GPS tracking:",
                    error.message
                );
            },

            {
                enableHighAccuracy: true,

                maximumAge: 5000,

                timeout: 10000
            }
        );
}


/* =========================================================
   STOP GPS TRACKING
   ========================================================= */

function stopLocationTracking() {

    if (
        locationWatcher !== null
    ) {

        navigator.geolocation.clearWatch(
            locationWatcher
        );

        locationWatcher = null;
    }
}


/* =========================================================
   DRIVER ONLINE / OFFLINE
   ========================================================= */

async function setOnline() {

    const newState =
        !online;

    const button =
        document.getElementById(
            "onlineBtn"
        );

    const state =
        document.getElementById(
            "onlineState"
        );


    if (button) {

        button.disabled = true;
    }


    try {

        let location = null;


        /*
         * Get GPS when going online.
         */

        if (newState) {

            location =
                await getCurrentLocation();

            if (!location) {

                throw new Error(
                    "Please allow location permission to go online."
                );
            }
        }


        const response =
            await fetch(
                API_BASE +
                "/api/drivers/status",
                {
                    method: "POST",

                    headers:
                        authHeaders(),

                    body:
                        JSON.stringify({

                            online:
                                newState,

                            location:
                                location
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to update driver status"
            );
        }


        /*
         * Update local state
         */

        online =
            newState;


        /*
         * Update UI
         */

        if (state) {

            state.textContent =
                online
                    ? "ONLINE"
                    : "OFFLINE";

            state.className =
                online
                    ? "status"
                    : "muted";
        }


        if (button) {

            button.textContent =
                online
                    ? "Go Offline"
                    : "Go Online";
        }


        /*
         * Socket room
         */

        const driverId =
            getDriverId();


        if (
            socket &&
            driverId
        ) {

            if (online) {

                socket.emit(
                    "join:driver",
                    driverId
                );

            } else {

                socket.emit(
                    "leave:driver",
                    driverId
                );
            }
        }


        /*
         * Start / stop GPS tracking
         */

        if (online) {

            startLocationTracking();

        } else {

            stopLocationTracking();
        }


        console.log(
            "Driver status:",
            online
                ? "ONLINE"
                : "OFFLINE"
        );


    } catch (error) {

        console.error(
            "Driver status error:",
            error
        );


        alert(
            error.message ||
            "Unable to connect to server."
        );

    } finally {

        if (button) {

            button.disabled = false;
        }
    }
}


/* =========================================================
   SOCKET CONNECTION
   ========================================================= */

if (socket) {

    socket.on(
        "connect",
        function () {

            console.log(
                "GoRide Driver Socket connected:",
                socket.id
            );


            const driverId =
                getDriverId();


            if (
                online &&
                driverId
            ) {

                socket.emit(
                    "join:driver",
                    driverId
                );
            }
        }
    );


    /* =====================================================
       NEW RIDE
       ===================================================== */

    socket.on(
        "ride:new",
        function (ride) {

            console.log(
                "New GoRide request:",
                ride
            );


            if (!online) {
                return;
            }


            addRideRequest(ride);
        }
    );


    /* =====================================================
       RIDE UPDATE
       ===================================================== */

    socket.on(
        "ride:update",
        function (ride) {

            console.log(
                "Ride updated:",
                ride
            );

            updateRideRequest(
                ride
            );
        }
    );


    /*
     * Passenger / driver live location
     */

    socket.on(
        "driver:location",
        function (data) {

            console.log(
                "Driver location:",
                data
            );
        }
    );


    socket.on(
        "disconnect",
        function () {

            console.log(
                "GoRide Driver Socket disconnected"
            );
        }
    );
}


/* =========================================================
   ADD RIDE REQUEST
   ========================================================= */

function addRideRequest(ride) {

    const requests =
        document.getElementById(
            "requests"
        );

    if (!requests) {
        return;
    }


    if (!ride || !ride._id) {
        return;
    }


    /*
     * Only show searching rides.
     */

    if (
        ride.status &&
        ride.status !==
        "SEARCHING_DRIVER"
    ) {

        return;
    }


    /*
     * Prevent duplicates.
     */

    if (
        document.querySelector(
            `[data-ride-id="${ride._id}"]`
        )
    ) {

        return;
    }


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "ride-request";


    card.dataset.rideId =
        ride._id;


    card.innerHTML = `

        <div class="ride-request-top">

            <strong>
                New Ride Request
            </strong>

            <span class="ride-status">
                ${escapeHTML(
                    ride.vehicleType ||
                    "Ride"
                )}
            </span>

        </div>


        <div class="ride-location">

            <div>

                <span class="dot pickup-dot"></span>

                <div>

                    <small>
                        Pickup
                    </small>

                    <strong>
                        ${escapeHTML(
                            ride.pickup?.name ||
                            "Pickup location"
                        )}
                    </strong>

                </div>

            </div>


            <div>

                <span class="dot destination-dot"></span>

                <div>

                    <small>
                        Destination
                    </small>

                    <strong>
                        ${escapeHTML(
                            ride.destination?.name ||
                            "Destination"
                        )}
                    </strong>

                </div>

            </div>

        </div>


        <div class="ride-details">

            <span>
                📏
                ${Number(
                    ride.distance || 0
                ).toFixed(1)}
                km
            </span>


            <span>
                ⏱️
                ${Number(
                    ride.estimatedTime || 0
                )}
                min
            </span>


            <strong>
                ₹${Math.round(
                    ride.fare || 0
                )}
            </strong>

        </div>


        <div class="ride-actions">

            <button
                type="button"
                class="primary"
                onclick="acceptRide('${ride._id}')">

                Accept

            </button>


            <button
                type="button"
                class="secondary"
                onclick="skipRide('${ride._id}')">

                Skip

            </button>

        </div>
    `;


    /*
     * Remove "no new rides"
     */

    const empty =
        requests.querySelector(
            ".empty"
        );

    if (empty) {
        empty.remove();
    }


    requests.prepend(
        card
    );
}


/* =========================================================
   ACCEPT RIDE
   ========================================================= */

async function acceptRide(id) {

    if (!id) {
        return;
    }


    try {

        const response =
            await fetch(
                API_BASE +
                "/api/rides/" +
                id +
                "/accept",
                {
                    method: "POST",

                    headers:
                        authHeaders()
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to accept ride"
            );
        }


        localStorage.setItem(
            "driver_active_ride",
            JSON.stringify(
                data.ride
            )
        );


        /*
         * Notify passenger
         */

        if (
            socket &&
            data.ride.passengerId
        ) {

            socket.emit(
                "driver:rideAccepted",
                {
                    rideId:
                        data.ride._id,

                    passengerId:
                        data.ride.passengerId
                }
            );
        }


        window.location.href =
            "active-ride.html";


    } catch (error) {

        console.error(
            "Accept ride error:",
            error
        );


        alert(
            error.message ||
            "Unable to accept ride."
        );
    }
}


/* =========================================================
   SKIP RIDE
   ========================================================= */

function skipRide(id) {

    const card =
        document.querySelector(
            `[data-ride-id="${id}"]`
        );


    if (card) {

        card.remove();
    }
}


/* =========================================================
   RIDE REQUEST UPDATE
   ========================================================= */

function updateRideRequest(ride) {

    if (!ride || !ride._id) {
        return;
    }


    const card =
        document.querySelector(
            `[data-ride-id="${ride._id}"]`
        );


    /*
     * Ride accepted / completed /
     * cancelled -> remove request.
     */

    if (
        ride.status !==
        "SEARCHING_DRIVER"
    ) {

        if (card) {
            card.remove();
        }

        return;
    }
}


/* =========================================================
   UPDATE ACTIVE RIDE STATUS
   ========================================================= */

async function updateRideStatus(status) {

    const ride =
        JSON.parse(
            localStorage.getItem(
                "driver_active_ride"
            ) || "null"
        );


    if (!ride) {

        alert(
            "No active ride."
        );

        return;
    }


    try {

        const response =
            await fetch(
                API_BASE +
                "/api/rides/" +
                ride._id +
                "/status",
                {
                    method: "POST",

                    headers:
                        authHeaders(),

                    body:
                        JSON.stringify({
                            status:
                                status
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to update ride"
            );
        }


        localStorage.setItem(
            "driver_active_ride",
            JSON.stringify(
                data.ride
            )
        );


        if (
            status ===
            "RIDE_COMPLETED" ||
            status ===
            "CANCELLED"
        ) {

            localStorage.removeItem(
                "driver_active_ride"
            );
        }


        alert(
            "Ride status updated."
        );


    } catch (error) {

        console.error(
            "Ride status error:",
            error
        );


        alert(
            error.message ||
            "Unable to update ride."
        );
    }
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    return String(
        value || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   PAGE CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
         * Do NOT automatically set
         * driver offline here.
         *
         * Driver may move between
         * dashboard and active ride.
         */

    }
);


/* =========================================================
   PUBLIC FUNCTIONS
   ========================================================= */

window.setOnline =
    setOnline;

window.acceptRide =
    acceptRide;

window.skipRide =
    skipRide;

window.updateRideStatus =
    updateRideStatus;

window.getCurrentLocation =
    getCurrentLocation;
