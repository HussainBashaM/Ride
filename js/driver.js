/* =========================================================
   GoRide DRIVER.JS
   Corrected Step 3 Version
   ========================================================= */


/* =========================================================
   API
   ========================================================= */

const API_BASE =
    window.GORIDE_API ||
    window.API_BASE_URL ||
    localStorage.getItem("API_BASE_URL") ||
    "https://ride-f6la.onrender.com";


/* =========================================================
   SOCKET
   ========================================================= */

const socket =
    typeof io === "function"
        ? io(API_BASE, {
            transports: ["websocket", "polling"]
        })
        : null;


/* =========================================================
   DRIVER STATE
   ========================================================= */

let online = false;

let activeRideMode = false;

let locationWatcher = null;

let activeRide =
    JSON.parse(
        localStorage.getItem(
            "driver_active_ride"
        ) || "null"
    );


/* =========================================================
   TOKEN
   ========================================================= */

function getToken() {

    return (
        localStorage.getItem("token") ||
        localStorage.getItem("goride_token") ||
        ""
    );

}


/* =========================================================
   AUTH HEADERS
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
                "Authorization":
                    "Bearer " + token
            }
            : {})
    };
}
/* =========================================================
   GET DRIVER ID
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

    } catch (error) {

        console.error(
            "Driver ID error:",
            error
        );

        return null;
    }

}


/* =========================================================
   GET ACTIVE RIDE
   ========================================================= */

function getActiveRide() {

    try {

        const ride =
            JSON.parse(
                localStorage.getItem(
                    "driver_active_ride"
                ) || "null"
            );

        if (ride && ride._id) {

            activeRide = ride;

            return ride;

        }

    } catch (error) {

        console.error(
            "Active ride read error:",
            error
        );

    }

    return activeRide;

}


/* =========================================================
   SAVE ACTIVE RIDE
   ========================================================= */

function saveActiveRide(ride) {

    if (!ride) {

        activeRide = null;

        localStorage.removeItem(
            "driver_active_ride"
        );

        return;
    }

    activeRide = ride;

    localStorage.setItem(
        "driver_active_ride",
        JSON.stringify(ride)
    );

}


/* =========================================================
   CHECK ACTIVE RIDE
   ========================================================= */

function hasActiveDriverRide() {

    const ride =
        getActiveRide();

    if (!ride) {

        return false;

    }

    return [

        "DRIVER_ASSIGNED",

        "DRIVER_ARRIVING",

        "DRIVER_AT_PICKUP",

        "RIDE_STARTED"

    ].includes(
        ride.status
    );

}


/* =========================================================
   GET CURRENT LOCATION
   ========================================================= */

function getCurrentLocation() {

    return new Promise(
        function (resolve) {

            if (
                !navigator.geolocation
            ) {

                alert(
                    "Location is not supported on this device."
                );

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
                        "GPS first attempt failed:",
                        error
                    );


                    navigator.geolocation.getCurrentPosition(

                        function (position) {

                            resolve({

                                lat:
                                    position.coords.latitude,

                                lng:
                                    position.coords.longitude

                            });

                        },

                        function (secondError) {

                            console.error(
                                "GPS failed:",
                                secondError
                            );


                            if (
                                secondError.code === 1
                            ) {

                                alert(
                                    "Location permission is blocked. Please allow location permission for GoRide."
                                );

                            }

                            else if (
                                secondError.code === 2
                            ) {

                                alert(
                                    "Unable to detect your location. Please turn ON GPS/Location and try again."
                                );

                            }

                            else {

                                alert(
                                    "Unable to get your location. Please turn ON GPS and try again."
                                );

                            }


                            resolve(null);

                        },

                        {

                            enableHighAccuracy:
                                false,

                            timeout:
                                30000,

                            maximumAge:
                                60000

                        }

                    );

                },

                {

                    enableHighAccuracy:
                        true,

                    timeout:
                        30000,

                    maximumAge:
                        10000

                }

            );

        }
    );

}


/* =========================================================
   SEND DRIVER LOCATION
   ========================================================= */

async function sendDriverLocation(
    location
) {

    if (!location) {

        return;
    }


    /*
     * During an active ride the driver
     * must continue sending GPS even if
     * the server marks the driver busy.
     */

    if (
        !online &&
        !activeRideMode
    ) {

        return;
    }


    try {

        const response =
            await fetch(

                API_BASE +
                "/api/drivers/status",

                {

                    method:
                        "POST",

                    headers:
                        getAuthHeaders(),

                    body:
                        JSON.stringify({

                            online:
                                true,

                            location:
                                location

                        })

                }

            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (
            !response.ok ||
            !data.success
        ) {

            console.warn(
                "Driver location update failed:",
                data.message
            );

            return;
        }


        const driverId =
            getDriverId();


        /*
         * Send live location through
         * Socket.IO.
         */

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
                        location,

                    activeRide:
                        activeRideMode

                }

            );

        }

    }

    catch (error) {

        console.error(
            "Driver location error:",
            error
        );

    }

}


/* =========================================================
   START LOCATION TRACKING
   ========================================================= */

function startLocationTracking() {

    if (
        !navigator.geolocation
    ) {

        console.warn(
            "Geolocation is not supported."
        );

        return;
    }


    stopLocationTracking();


    locationWatcher =
        navigator.geolocation.watchPosition(

            function (position) {

                if (
                    !online &&
                    !activeRideMode
                ) {

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

                enableHighAccuracy:
                    true,

                maximumAge:
                    5000,

                timeout:
                    10000

            }

        );

}


/* =========================================================
   STOP LOCATION TRACKING
   ========================================================= */

function stopLocationTracking() {

    if (
        locationWatcher !== null
    ) {

        navigator.geolocation.clearWatch(
            locationWatcher
        );

        locationWatcher =
            null;
    }

}


/* =========================================================
   UPDATE ONLINE UI
   ========================================================= */

function updateDriverOnlineUI() {

    const button =
        document.getElementById(
            "onlineBtn"
        );

    const state =
        document.getElementById(
            "onlineState"
        );


    if (state) {

        state.textContent =
            online
                ? "ONLINE"
                : "OFFLINE";

    }


    if (button) {

        button.textContent =
            online
                ? "Go Offline"
                : "Go Online";

    }

}


/* =========================================================
   GO ONLINE / OFFLINE
   ========================================================= */

async function setOnline() {

    if (
        online &&
        activeRideMode
    ) {

        alert(
            "You cannot go offline while a ride is active."
        );

        return;
    }


    const newState =
        !online;


    const button =
        document.getElementById(
            "onlineBtn"
        );


    if (button) {

        button.disabled =
            true;

    }


    try {

        let location =
            null;


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

                    method:
                        "POST",

                    headers:
                        getAuthHeaders(),

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
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.message ||
                "Unable to update driver status"

            );

        }


        online =
            newState;


        updateDriverOnlineUI();


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

            }

            else {

                socket.emit(
                    "leave:driver",
                    driverId
                );

            }

        }


        if (online) {

            startLocationTracking();

        }

        else {

            stopLocationTracking();

        }

    }

    catch (error) {

        console.error(
            "Driver status error:",
            error
        );


        alert(
            error.message ||
            "Unable to connect to server."
        );

    }

    finally {

        if (button) {

            button.disabled =
                false;

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


            if (
                !online ||
                activeRideMode
            ) {

                return;

            }


            addRideRequest(
                ride
            );

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


            if (
                !ride ||
                !ride._id
            ) {

                return;

            }


            /*
             * If this is our active ride,
             * keep local storage synchronized.
             */

            const currentRide =
                getActiveRide();


            if (
                currentRide &&
                String(
                    currentRide._id
                ) ===
                String(
                    ride._id
                )
            ) {

                saveActiveRide(
                    ride
                );


                activeRideMode =
                    hasActiveDriverRide();


                /*
                 * If active-ride.html has
                 * renderRide(), update it.
                 */

                if (
                    typeof window.renderRide ===
                    "function"
                ) {

                    window.renderRide();

                }

            }


            updateRideRequest(
                ride
            );

        }
    );


    /* =====================================================
       DRIVER LOCATION CONFIRMATION
       ===================================================== */

    socket.on(
        "driver:location",
        function (data) {

            console.log(
                "Driver location:",
                data
            );

        }
    );


    /* =====================================================
       RIDE ACCEPTED BY OTHER DRIVER
       ===================================================== */

    socket.on(
        "ride:accepted",
        function (data) {

            if (!data) {

                return;

            }


            const currentDriverId =
                getDriverId();


            /*
             * Remove the ride request from
             * this driver's screen if another
             * driver accepted it.
             */

            if (
                data.driverId &&
                String(
                    data.driverId
                ) !==
                String(
                    currentDriverId
                )
            ) {

                const card =
                    document.querySelector(
                        `[data-ride-id="${data.rideId}"]`
                    );


                if (card) {

                    card.remove();

                }

            }

        }
    );


    /* =====================================================
       DISCONNECT
       ===================================================== */

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

function addRideRequest(
    ride
) {

    const requests =
        document.getElementById(
            "requests"
        );


    if (
        !requests ||
        !ride ||
        !ride._id
    ) {

        return;

    }


    if (
        ride.status &&
        ride.status !==
        "SEARCHING_DRIVER"
    ) {

        return;

    }


    if (activeRideMode) {

        return;

    }


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
                onclick="acceptRide('${ride._id}')"
            >

                Accept

            </button>


            <button
                type="button"
                class="secondary"
                onclick="skipRide('${ride._id}')"
            >

                Skip

            </button>

        </div>

    `;


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

async function acceptRide(
    id
) {

    if (!id) {

        return;

    }


    if (activeRideMode) {

        alert(
            "You already have an active ride."
        );

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

                    method:
                        "POST",

                    headers:
                        getAuthHeaders()

                }

            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.message ||
                "Unable to accept ride"

            );

        }


        /*
         * Save accepted ride.
         */

        saveActiveRide(
            data.ride
        );


        activeRideMode =
            true;


        /*
         * Continue GPS during
         * the active ride.
         */

        startLocationTracking();


        /*
         * Remove request card.
         */

        const card =
            document.querySelector(
                `[data-ride-id="${id}"]`
            );


        if (card) {

            card.remove();

        }


        /*
         * Open driver active ride.
         */

        window.location.href =
            "active-ride.html";

    }

    catch (error) {

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

function skipRide(
    id
) {

    const card =
        document.querySelector(
            `[data-ride-id="${id}"]`
        );


    if (card) {

        card.remove();

    }

}


/* =========================================================
   UPDATE RIDE REQUEST
   ========================================================= */

function updateRideRequest(
    ride
) {

    if (
        !ride ||
        !ride._id
    ) {

        return;

    }


    const card =
        document.querySelector(
            `[data-ride-id="${ride._id}"]`
        );


    /*
     * Accepted, cancelled or completed
     * rides should disappear from the
     * request list.
     */

    if (
        ride.status !==
        "SEARCHING_DRIVER"
    ) {

        if (card) {

            card.remove();

        }

    }

}


/* =========================================================
   UPDATE ACTIVE RIDE STATUS
   ========================================================= */

async function updateRideStatus(
    status
) {

    /*
     * IMPORTANT:
     * Always reload the ride from
     * localStorage before updating.
     */

    const ride =
        getActiveRide();


    if (
        !ride ||
        !ride._id
    ) {

        alert(
            "No active ride found."
        );

        return;

    }


    const token =
        getToken();


    if (!token) {

        alert(
            "Please login again."
        );

        return;

    }


    /*
     * Prevent invalid status changes.
     */

    const allowedStatuses = [

        "DRIVER_ARRIVING",

        "DRIVER_AT_PICKUP",

        "RIDE_STARTED",

        "RIDE_COMPLETED",

        "CANCELLED"

    ];


    if (
        !allowedStatuses.includes(
            status
        )
    ) {

        alert(
            "Invalid ride status."
        );

        return;

    }


    try {

        console.log(
            "Updating ride status:",
            status
        );


        const response =
            await fetch(

                API_BASE +
                "/api/rides/" +
                ride._id +
                "/status",

                {

                    method:
                        "POST",

                    headers:
                        getAuthHeaders(),

                    body:
                        JSON.stringify({

                            status:
                                status

                        })

                }

            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        console.log(
            "Status API response:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(

                data.message ||
                data.error ||
                "Unable to update ride status."

            );

        }


        /*
         * Store updated ride.
         */

        if (data.ride) {

            saveActiveRide(
                data.ride
            );

        }

        else {

            saveActiveRide({

                ...ride,

                status:
                    status

            });

        }


        /*
         * Recalculate active mode.
         */

        activeRideMode =
            hasActiveDriverRide();


        /*
         * Keep GPS alive while
         * ride is active.
         */

        if (activeRideMode) {

            startLocationTracking();

        }


        /*
         * Update active-ride page
         * if its render function exists.
         */

        if (
            typeof window.renderRide ===
            "function"
        ) {

            window.renderRide();

        }


        /*
         * Status messages.
         */

        if (
            status ===
            "DRIVER_ARRIVING"
        ) {

            alert(
                "Driver is arriving."
            );

        }


        if (
            status ===
            "DRIVER_AT_PICKUP"
        ) {

            alert(
                "Driver marked as arrived."
            );

        }


        if (
            status ===
            "RIDE_STARTED"
        ) {

            alert(
                "Ride started successfully."
            );

        }


        if (
            status ===
            "RIDE_COMPLETED"
        ) {

            alert(
                "Ride completed successfully."
            );


            saveActiveRide(
                null
            );


            stopLocationTracking();


            setTimeout(
                function () {

                    window.location.href =
                        "history.html";

                },
                1200
            );

        }


        if (
            status ===
            "CANCELLED"
        ) {

            alert(
                "Ride cancelled."
            );


            saveActiveRide(
                null
            );


            stopLocationTracking();


            setTimeout(
                function () {

                    window.location.href =
                        "dashboard.html";

                },
                1000
            );

        }

    }

    catch (error) {

        console.error(
            "Ride status error:",
            error
        );


        alert(
            error.message ||
            "Unable to update ride status."
        );

    }

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
    value
) {

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
   REFRESH ACTIVE RIDE MODE
   ========================================================= */

function refreshActiveRideMode() {

    activeRide =
        getActiveRide();


    activeRideMode =
        hasActiveDriverRide();


    if (activeRideMode) {

        /*
         * Keep driver GPS alive after
         * opening active-ride.html.
         */

        online = true;

        startLocationTracking();

    }

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        refreshActiveRideMode();

        updateDriverOnlineUI();


        console.log(
            "================================"
        );

        console.log(
            "GoRide driver.js loaded"
        );

        console.log(
            "API:",
            API_BASE
        );

        console.log(
            "Driver ID:",
            getDriverId()
        );

        console.log(
            "Active Ride:",
            getActiveRide()
        );

        console.log(
            "================================"
        );

    }
);


/* =========================================================
   MAKE FUNCTIONS AVAILABLE TO HTML
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

window.startLocationTracking =
    startLocationTracking;

window.stopLocationTracking =
    stopLocationTracking;

window.getActiveRide =
    getActiveRide;
window.authHeaders = authHeaders;


/* =========================================================
   READY
   ========================================================= */

console.log(
    "GoRide DRIVER.JS corrected version ready."
);
