/* =========================================================
   GoRide DRIVER.JS
   Driver online + real-time ride requests
   ========================================================= */

const socket =
    typeof io === "function"
        ? io(window.GORIDE_API || window.API_BASE_URL)
        : null;

let online = false;


/* =========================================================
   API
   ========================================================= */

const API_BASE =
    window.GORIDE_API ||
    window.API_BASE_URL ||
    localStorage.getItem("API_BASE_URL") ||
    "https://ride-f6la.onrender.com";


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

        return user?.id || user?._id || null;

    } catch (error) {

        return null;
    }
}


/* =========================================================
   DRIVER ONLINE / OFFLINE
   ========================================================= */

async function setOnline() {

    online = !online;

    const button =
        document.getElementById("onlineBtn");

    const state =
        document.getElementById("onlineState");


    if (button) {

        button.disabled = true;
    }


    try {

        const locationData =
            await getCurrentLocation();


        const response =
            await fetch(
                API_BASE +
                "/api/drivers/status",
                {
                    method: "POST",
                    headers: authHeaders(),

                    body: JSON.stringify({
                        online: online,
                        location: locationData
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to update driver status"
            );
        }


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
         * Join driver Socket.IO room
         */

        const driverId =
            getDriverId();

        if (
            online &&
            socket &&
            driverId
        ) {

            socket.emit(
                "join:driver",
                driverId
            );
        }


    } catch (error) {

        console.error(
            "Driver status error:",
            error
        );


        /*
         * Roll back UI if server failed
         */

        online = !online;


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
   GET CURRENT GPS LOCATION
   ========================================================= */

function getCurrentLocation() {

    return new Promise(function (resolve) {

        if (!navigator.geolocation) {

            resolve({
                lat: 0,
                lng: 0
            });

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

            function () {

                /*
                 * If GPS permission is unavailable,
                 * don't break online status.
                 */

                resolve({
                    lat: 0,
                    lng: 0
                });
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    });
}


/* =========================================================
   NEW RIDE REQUEST
   ========================================================= */

if (socket) {

    socket.on(
        "ride:new",
        function (ride) {

            console.log(
                "New GoRide request:",
                ride
            );


            /*
             * Only show requests while
             * driver is online.
             */

            if (!online) {
                return;
            }


            /*
             * Optional vehicle filtering.
             *
             * If driver vehicle information is
             * available in localStorage, only show
             * matching rides.
             */

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

            updateRideRequest(ride);
        }
    );


    console.log(
        "GoRide Driver Socket connected"
    );
}


/* =========================================================
   ADD REQUEST TO DRIVER DASHBOARD
   ========================================================= */

function addRideRequest(ride) {

    const requests =
        document.getElementById("requests");

    if (!requests) {
        return;
    }


    /*
     * Don't add duplicate request.
     */

    if (
        document.querySelector(
            `[data-ride-id="${ride._id}"]`
        )
    ) {

        return;
    }


    const card =
        document.createElement("div");

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
                ${ride.vehicleType || "Ride"}
            </span>

        </div>

        <div class="ride-location">

            <div>
                <span class="dot pickup-dot"></span>

                <div>
                    <small>Pickup</small>
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
                    <small>Destination</small>
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
                ).toFixed(1)} km
            </span>

            <span>
                ⏱️
                ${ride.estimatedTime || 0} min
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
     * Remove empty message if present.
     */

    const empty =
        requests.querySelector(
            ".empty"
        );

    if (empty) {
        empty.remove();
    }


    requests.prepend(card);
}


/* =========================================================
   ACCEPT RIDE
   ========================================================= */

async function acceptRide(id) {

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


        if (!response.ok || !data.success) {

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
         * Notify passenger through socket.
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
   UPDATE RIDE REQUEST
   ========================================================= */

function updateRideRequest(ride) {

    const card =
        document.querySelector(
            `[data-ride-id="${ride._id}"]`
        );


    /*
     * If ride is no longer searching,
     * remove it from request list.
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


    /*
     * Otherwise keep it visible.
     */
}


/* =========================================================
   UPDATE RIDE STATUS
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
                            status: status
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

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
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
