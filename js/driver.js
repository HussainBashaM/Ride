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
let activeRideMode = false;
let locationWatcher = null;


/* =====================================================
   AUTH HEADERS
===================================================== */

function authHeaders() {

    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("goride_token") ||
        "";

    return {
        "Content-Type": "application/json",
        ...(token
            ? {
                Authorization: "Bearer " + token
            }
            : {})
    };
}


/* =====================================================
   GET DRIVER ID
===================================================== */

function getDriverId() {

    try {

        const user = JSON.parse(
            localStorage.getItem("user") ||
            localStorage.getItem("goride_user") ||
            "null"
        );

        return user?.id || user?._id || null;

    } catch {

        return null;

    }
}


/* =====================================================
   CHECK ACTIVE RIDE
===================================================== */

function hasActiveDriverRide() {

    try {

        const ride = JSON.parse(
            localStorage.getItem(
                "driver_active_ride"
            ) || "null"
        );

        if (!ride) return false;

        return [
            "DRIVER_ASSIGNED",
            "DRIVER_ARRIVING",
            "DRIVER_AT_PICKUP",
            "RIDE_STARTED"
        ].includes(ride.status);

    } catch {

        return false;

    }
}


/* =====================================================
   GET CURRENT LOCATION
===================================================== */

function getCurrentLocation() {

    return new Promise(function (resolve) {

        if (!navigator.geolocation) {

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
                                "Location request timed out. Please try again."
                            );

                        }


                        resolve(null);

                    },

                    {

                        enableHighAccuracy: false,

                        timeout: 30000,

                        maximumAge: 60000

                    }

                );

            },

            {

                enableHighAccuracy: true,

                timeout: 30000,

                maximumAge: 10000

            }

        );

    });

}


/* =====================================================
   SEND DRIVER LOCATION
===================================================== */

async function sendDriverLocation(location) {

    if (
        (!online && !activeRideMode) ||
        !location
    ) {

        return;

    }


    try {

        const response = await fetch(

            API_BASE +
            "/api/drivers/status",

            {

                method: "POST",

                headers:
                    authHeaders(),

                body:
                    JSON.stringify({

                        online: true,

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

            console.warn(
                "Location update failed:",
                data.message
            );

            return;

        }


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


/* =====================================================
   START LIVE LOCATION TRACKING
===================================================== */

function startLocationTracking() {

    if (!navigator.geolocation) {

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


                sendDriverLocation({

                    lat:
                        position.coords.latitude,

                    lng:
                        position.coords.longitude

                });

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


/* =====================================================
   STOP LOCATION TRACKING
===================================================== */

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


/* =====================================================
   UPDATE DRIVER ONLINE UI
===================================================== */

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


/* =====================================================
   GO ONLINE / OFFLINE
===================================================== */

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

        button.disabled = true;

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

            button.disabled = false;

        }

    }

}


/* =====================================================
   SOCKET CONNECTION
===================================================== */

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


    /* NEW RIDE */

    socket.on(

        "ride:new",

        function (ride) {

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


    /* RIDE UPDATE */

    socket.on(

        "ride:update",

        function (ride) {

            updateRideRequest(
                ride
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


/* =====================================================
   ADD RIDE REQUEST
===================================================== */

function addRideRequest(ride) {

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

                <span
                    class="dot destination-dot"
                ></span>

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


/* =====================================================
   ACCEPT RIDE
===================================================== */

async function acceptRide(id) {

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


        activeRideMode =
            true;


        startLocationTracking();


        const card =
            document.querySelector(

                `[data-ride-id="${id}"]`

            );


        if (card) {

            card.remove();

        }


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


/* =====================================================
   SKIP RIDE
===================================================== */

function skipRide(id) {

    const card =
        document.querySelector(

            `[data-ride-id="${id}"]`

        );


    if (card) {

        card.remove();

    }

}


/* =====================================================
   UPDATE RIDE REQUEST
===================================================== */

function updateRideRequest(ride) {

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


    if (
        ride.status !==
        "SEARCHING_DRIVER"
    ) {

        if (card) {

            card.remove();

        }

    }

}


/* =====================================================
   UPDATE RIDE STATUS
===================================================== */
async function updateRideStatus(status) {

    if (!activeRide || !activeRide._id) {
        alert("No active ride found.");
        return;
    }

    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("goride_token");

    if (!token) {
        alert("Please login again.");
        return;
    }

    try {

        const response = await fetch(
            API_BASE +
            "/api/rides/" +
            activeRide._id +
            "/status",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },

                body: JSON.stringify({
                    status: status
                })
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {

            alert(
                data.message ||
                data.error ||
                "Unable to update ride status."
            );

            return;
        }

        console.log(
            "Ride status updated:",
            data
        );

        if (data.ride) {

            activeRide = data.ride;

        } else if (data) {

            activeRide = {
                ...activeRide,
                ...data
            };

        }

        localStorage.setItem(
            "driver_active_ride",
            JSON.stringify(activeRide)
        );

        renderRide();

        /*
         * If the server/socket sends the updated
         * ride, passenger will receive it too.
         */

        if (status === "DRIVER_AT_PICKUP") {

            alert(
                "Driver marked as arrived."
            );

        }

        if (status === "RIDE_STARTED") {

            alert(
                "Ride started successfully."
            );

        }

        if (status === "RIDE_COMPLETED") {

            alert(
                "Ride completed successfully."
            );

            setTimeout(() => {

                window.location.href =
                    "history.html";

            }, 1200);

        }

    } catch (error) {

        console.error(
            "Ride status error:",
            error
        );

        alert(
            "Unable to connect to server."
        );
    }
}


/* =====================================================
   ESCAPE HTML
===================================================== */

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


/* =====================================================
   CHECK ACTIVE RIDE WHEN PAGE LOADS
===================================================== */

function refreshActiveRideMode() {

    activeRideMode =
        hasActiveDriverRide();


    if (activeRideMode) {

        startLocationTracking();

    }

}


/* =====================================================
   INITIALIZE
===================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        refreshActiveRideMode();

        updateDriverOnlineUI();

        console.log(
            "GoRide driver.js loaded"
        );

        console.log(
            "API:",
            API_BASE
        );

    }

);


/* =====================================================
   MAKE FUNCTIONS AVAILABLE TO HTML
===================================================== */

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


console.log(
    "GoRide DRIVER.JS Step 3 ready."
);
