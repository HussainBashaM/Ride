/* =========================================================
   GoRide APP.JS — PART 1
   Homepage + Authentication + Navigation
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* -----------------------------------------------------
       API CONFIGURATION
       ----------------------------------------------------- */

    const API_BASE =
        window.API_BASE_URL ||
        localStorage.getItem("API_BASE_URL") ||
        "https://ridego-m7tz.onrender.com";


    /* -----------------------------------------------------
       COMMON HELPERS
       ----------------------------------------------------- */

    function getToken() {
        return (
            localStorage.getItem("token") ||
            localStorage.getItem("goride_token") ||
            ""
        );
    }

    function getUser() {
        try {
            return JSON.parse(
                localStorage.getItem("user") ||
                localStorage.getItem("goride_user") ||
                "null"
            );
        } catch (error) {
            return null;
        }
    }

    function saveUser(user, token) {
        if (user) {
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("goride_user", JSON.stringify(user));
        }

        if (token) {
            localStorage.setItem("token", token);
            localStorage.setItem("goride_token", token);
        }
    }

    function isLoggedIn() {
        return !!getToken();
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("goride_token");
        localStorage.removeItem("user");
        localStorage.removeItem("goride_user");

        window.location.href = "../index.html";
    }


    /* -----------------------------------------------------
       MAKE API BASE AVAILABLE TO OTHER JS FILES
       ----------------------------------------------------- */

    window.GORIDE_API = API_BASE;
    window.API_BASE_URL = API_BASE;


    /* -----------------------------------------------------
       PAGE PATH HELPER
       ----------------------------------------------------- */

    function goTo(path) {
        window.location.href = path;
    }


    /* -----------------------------------------------------
       BOOK A RIDE
       ----------------------------------------------------- */

    const bookButtons = document.querySelectorAll(
        "#bookRideBtn, .book-ride-btn, [data-action='book-ride']"
    );

    bookButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            if (isLoggedIn()) {

                /*
                 * Logged-in user goes directly
                 * to the passenger dashboard.
                 */

                goTo("user/dashboard.html");

            } else {

                /*
                 * User is not logged in.
                 * Send them to login page.
                 */

                goTo("user/login.html");
            }
        });
    });


    /* -----------------------------------------------------
       USER LOGIN LINKS
       ----------------------------------------------------- */

    const userLoginLinks = document.querySelectorAll(
        "#userLoginBtn, .user-login-btn, [data-action='user-login']"
    );

    userLoginLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            goTo("user/login.html");
        });
    });


    /* -----------------------------------------------------
       USER REGISTRATION LINKS
       ----------------------------------------------------- */

    const userRegisterLinks = document.querySelectorAll(
        "#userRegisterBtn, .user-register-btn, [data-action='user-register']"
    );

    userRegisterLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            goTo("user/register.html");
        });
    });


    /* -----------------------------------------------------
       CREATE USER ACCOUNT LINKS
       ----------------------------------------------------- */

    const createAccountLinks = document.querySelectorAll(
        ".create-user-account, #createUserAccount"
    );

    createAccountLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            goTo("user/register.html");
        });
    });


    /* -----------------------------------------------------
       BECOME A DRIVER
       ----------------------------------------------------- */

    const driverRegisterLinks = document.querySelectorAll(
        "#becomeDriverBtn, .become-driver-btn, [data-action='become-driver']"
    );

    driverRegisterLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            goTo("driver/register.html");
        });
    });


    /* -----------------------------------------------------
       DRIVER LOGIN
       ----------------------------------------------------- */

    const driverLoginLinks = document.querySelectorAll(
        "#driverLoginBtn, .driver-login-btn, [data-action='driver-login']"
    );

    driverLoginLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            goTo("driver/login.html");
        });
    });


    /* -----------------------------------------------------
       FORGOT PASSWORD
       ----------------------------------------------------- */

    const forgotLinks = document.querySelectorAll(
        "#forgotPasswordBtn, .forgot-password, [data-action='forgot-password']"
    );

    forgotLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            /*
             * Forgot password belongs ONLY
             * inside the login flow.
             */

            if (window.location.pathname.includes("/user/")) {

                goTo("forgot-password.html");

            } else {

                goTo("user/forgot-password.html");
            }
        });
    });


    /* -----------------------------------------------------
       RESET PASSWORD
       ----------------------------------------------------- */

    const resetLinks = document.querySelectorAll(
        "#resetPasswordBtn, .reset-password, [data-action='reset-password']"
    );

    resetLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            if (window.location.pathname.includes("/user/")) {

                goTo("reset-password.html");

            } else {

                goTo("user/reset-password.html");
            }
        });
    });


    /* -----------------------------------------------------
       LOGOUT BUTTONS
       ----------------------------------------------------- */

    const logoutButtons = document.querySelectorAll(
        "#logoutBtn, .logout-btn, [data-action='logout']"
    );

    logoutButtons.forEach(function (button) {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            logout();
        });
    });


    /* -----------------------------------------------------
       DASHBOARD LINK
       ----------------------------------------------------- */

    const dashboardLinks = document.querySelectorAll(
        "#dashboardBtn, .dashboard-btn, [data-action='dashboard']"
    );

    dashboardLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            if (isLoggedIn()) {

                goTo("user/dashboard.html");

            } else {

                goTo("user/login.html");
            }
        });
    });


    /* -----------------------------------------------------
       HOME / GORIDE LOGO
       ----------------------------------------------------- */

    const homeLinks = document.querySelectorAll(
        ".brand, .goride-logo, [data-action='home']"
    );

    homeLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            /*
             * Only intercept elements that are actually
             * intended to be home links.
             */

            const href = link.getAttribute("href");

            if (!href || href === "#" || href === "index.html") {

                event.preventDefault();

                if (
                    window.location.pathname.includes("/user/") ||
                    window.location.pathname.includes("/driver/")
                ) {

                    goTo("../index.html");

                } else {

                    goTo("index.html");
                }
            }
        });
    });


    /* -----------------------------------------------------
       USER PROFILE
       ----------------------------------------------------- */

    const profileLinks = document.querySelectorAll(
        "#profileBtn, .profile-btn, [data-action='profile']"
    );

    profileLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            if (!isLoggedIn()) {

                goTo("user/login.html");
                return;
            }

            goTo("user/profile.html");
        });
    });


    /* -----------------------------------------------------
       RIDE HISTORY
       ----------------------------------------------------- */

    const historyLinks = document.querySelectorAll(
        "#rideHistoryBtn, .ride-history-btn, [data-action='ride-history']"
    );

    historyLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            if (!isLoggedIn()) {

                goTo("user/login.html");
                return;
            }

            goTo("user/ride-history.html");
        });
    });


    /* -----------------------------------------------------
       SETTINGS
       ----------------------------------------------------- */

    const settingsLinks = document.querySelectorAll(
        "#settingsBtn, .settings-btn, [data-action='settings']"
    );

    settingsLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            if (!isLoggedIn()) {

                goTo("user/login.html");
                return;
            }

            goTo("user/settings.html");
        });
    });


    /* -----------------------------------------------------
       AUTH STATE — HOMEPAGE
       ----------------------------------------------------- */

    const user = getUser();

    const loggedInElements = document.querySelectorAll(
        ".logged-in-only"
    );

    const loggedOutElements = document.querySelectorAll(
        ".logged-out-only"
    );

    if (isLoggedIn()) {

        loggedInElements.forEach(function (element) {
            element.style.display = "";
        });

        loggedOutElements.forEach(function (element) {
            element.style.display = "none";
        });

    } else {

        loggedInElements.forEach(function (element) {
            element.style.display = "none";
        });

        loggedOutElements.forEach(function (element) {
            element.style.display = "";
        });
    }


    /* -----------------------------------------------------
       SHOW USER NAME
       ----------------------------------------------------- */

    const userNameElements = document.querySelectorAll(
        "#userName, .user-name"
    );

    if (user) {

        const name =
            user.fullName ||
            user.name ||
            user.username ||
            "GoRide User";

        userNameElements.forEach(function (element) {
            element.textContent = name;
        });
    }


    /* -----------------------------------------------------
       PREVENT EMPTY # LINKS
       ----------------------------------------------------- */

    document.querySelectorAll("a[href='#']").forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

        });
    });


    /* -----------------------------------------------------
       GLOBAL FUNCTIONS
       ----------------------------------------------------- */

    window.GoRide = {

        API_BASE: API_BASE,

        getToken: getToken,

        getUser: getUser,

        isLoggedIn: isLoggedIn,

        saveUser: saveUser,

        logout: logout,

        goTo: goTo

    };


    console.log("GoRide app.js Part 1 loaded successfully.");

});

/* =========================================================
   GoRide APP.JS — PART 2
   Login + Register + Password + Booking + Fare
   ========================================================= */

(function () {

    const API_BASE =
        window.GORIDE_API ||
        window.API_BASE_URL ||
        localStorage.getItem("API_BASE_URL") ||
        "https://ridego-m7tz.onrender.com";


    /* =====================================================
       HELPERS
    ===================================================== */

    function token() {
        return (
            localStorage.getItem("token") ||
            localStorage.getItem("goride_token") ||
            ""
        );
    }

    function saveAuth(data) {

        const receivedToken =
            data.token ||
            data.accessToken ||
            data.jwt;

        const receivedUser =
            data.user ||
            data.data?.user ||
            data.account;

        if (receivedToken) {
            localStorage.setItem(
                "token",
                receivedToken
            );

            localStorage.setItem(
                "goride_token",
                receivedToken
            );
        }

        if (receivedUser) {
            localStorage.setItem(
                "user",
                JSON.stringify(receivedUser)
            );

            localStorage.setItem(
                "goride_user",
                JSON.stringify(receivedUser)
            );
        }
    }


    async function apiRequest(
        endpoint,
        options = {}
    ) {

        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        const authToken = token();

        if (authToken) {
            headers.Authorization =
                "Bearer " + authToken;
        }

        const response = await fetch(
            API_BASE + endpoint,
            {
                ...options,
                headers
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Something went wrong."
            );
        }

        return data;
    }


    function showMessage(
        element,
        message,
        type = "error"
    ) {

        if (!element) return;

        element.textContent = message;

        element.className =
            "message show " + type;

        element.style.display = "block";
    }


    function redirectAfterLogin() {

        const role =
            localStorage.getItem("goride_role") ||
            "user";

        if (role === "driver") {

            window.location.href =
                "../driver/dashboard.html";

        } else {

            window.location.href =
                "dashboard.html";
        }
    }


    /* =====================================================
       USER LOGIN
       ===================================================== */

    const loginForm =
        document.querySelector(
            "#loginForm"
        );

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const email =
                    loginForm.querySelector(
                        "[name='email'], #email"
                    );

                const password =
                    loginForm.querySelector(
                        "[name='password'], #password"
                    );

                const message =
                    loginForm.querySelector(
                        ".message, #loginMessage"
                    );

                if (
                    !email ||
                    !password
                ) {
                    return;
                }

                if (
                    !email.value.trim() ||
                    !password.value
                ) {

                    showMessage(
                        message,
                        "Please enter your email and password."
                    );

                    return;
                }

                const button =
                    loginForm.querySelector(
                        "button[type='submit']"
                    );

                if (button) {
                    button.disabled = true;
                    button.textContent =
                        "Logging in...";
                }

                try {

                    const data =
                        await apiRequest(
                            "/api/auth/login",
                            {
                                method: "POST",

                                body: JSON.stringify({
                                    email:
                                        email.value.trim(),

                                    password:
                                        password.value
                                })
                            }
                        );

                    saveAuth(data);

                    localStorage.setItem(
                        "goride_role",
                        "user"
                    );

                    showMessage(
                        message,
                        "Login successful. Redirecting...",
                        "success"
                    );

                    setTimeout(
                        redirectAfterLogin,
                        500
                    );

                } catch (error) {

                    showMessage(
                        message,
                        error.message ||
                        "Login failed."
                    );

                    if (button) {
                        button.disabled = false;
                        button.textContent =
                            "Login";
                    }
                }
            }
        );
    }


    /* =====================================================
       USER REGISTRATION
       ===================================================== */

    const registerForm =
        document.querySelector(
            "#registerForm"
        );

    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const name =
                    registerForm.querySelector(
                        "[name='name'], [name='fullName'], #name, #fullName"
                    );

                const email =
                    registerForm.querySelector(
                        "[name='email'], #email"
                    );

                const phone =
                    registerForm.querySelector(
                        "[name='phone'], #phone"
                    );

                const password =
                    registerForm.querySelector(
                        "[name='password'], #password"
                    );

                const confirmPassword =
                    registerForm.querySelector(
                        "[name='confirmPassword'], #confirmPassword, [name='confirm_password']"
                    );

                const message =
                    registerForm.querySelector(
                        ".message, #registerMessage"
                    );

                if (
                    !email ||
                    !password
                ) {
                    return;
                }

                if (
                    password.value !==
                    confirmPassword?.value
                ) {

                    showMessage(
                        message,
                        "Passwords do not match."
                    );

                    return;
                }

                const button =
                    registerForm.querySelector(
                        "button[type='submit']"
                    );

                if (button) {
                    button.disabled = true;
                    button.textContent =
                        "Creating account...";
                }

                try {

                    const payload = {
                        name:
                            name?.value.trim() || "",

                        fullName:
                            name?.value.trim() || "",

                        email:
                            email.value.trim(),

                        phone:
                            phone?.value.trim() || "",

                        password:
                            password.value
                    };

                    const data =
                        await apiRequest(
                            "/api/auth/register",
                            {
                                method: "POST",
                                body:
                                    JSON.stringify(payload)
                            }
                        );

                    saveAuth(data);

                    showMessage(
                        message,
                        "Registration successful!",
                        "success"
                    );

                    setTimeout(
                        function () {

                            window.location.href =
                                "dashboard.html";

                        },
                        700
                    );

                } catch (error) {

                    showMessage(
                        message,
                        error.message ||
                        "Registration failed."
                    );

                    if (button) {
                        button.disabled = false;
                        button.textContent =
                            "Register";
                    }
                }
            }
        );
    }


    /* =====================================================
       FORGOT PASSWORD
       ===================================================== */

    const forgotForm =
        document.querySelector(
            "#forgotPasswordForm"
        );

    if (forgotForm) {

        forgotForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const email =
                    forgotForm.querySelector(
                        "[name='email'], #email"
                    );

                const message =
                    forgotForm.querySelector(
                        ".message, #forgotMessage"
                    );

                if (
                    !email ||
                    !email.value.trim()
                ) {

                    showMessage(
                        message,
                        "Please enter your email address."
                    );

                    return;
                }

                const button =
                    forgotForm.querySelector(
                        "button[type='submit']"
                    );

                if (button) {
                    button.disabled = true;
                    button.textContent =
                        "Sending...";
                }

                try {

                    const data =
                        await apiRequest(
                            "/api/auth/forgot-password",
                            {
                                method: "POST",

                                body:
                                    JSON.stringify({
                                        email:
                                            email.value.trim()
                                    })
                            }
                        );

                    showMessage(
                        message,
                        data.message ||
                        "Password reset instructions have been sent.",
                        "success"
                    );

                } catch (error) {

                    showMessage(
                        message,
                        error.message ||
                        "Unable to process request."
                    );

                } finally {

                    if (button) {
                        button.disabled = false;
                        button.textContent =
                            "Send Reset Link";
                    }
                }
            }
        );
    }


    /* =====================================================
       RESET PASSWORD
       ===================================================== */

    const resetForm =
        document.querySelector(
            "#resetPasswordForm"
        );

    if (resetForm) {

        resetForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const password =
                    resetForm.querySelector(
                        "[name='password'], #password"
                    );

                const confirmPassword =
                    resetForm.querySelector(
                        "[name='confirmPassword'], #confirmPassword"
                    );

                const message =
                    resetForm.querySelector(
                        ".message, #resetMessage"
                    );

                const params =
                    new URLSearchParams(
                        window.location.search
                    );

                const resetToken =
                    params.get("token");

                if (!resetToken) {

                    showMessage(
                        message,
                        "Invalid or missing reset token."
                    );

                    return;
                }

                if (
                    !password ||
                    !confirmPassword
                ) {
                    return;
                }

                if (
                    password.value !==
                    confirmPassword.value
                ) {

                    showMessage(
                        message,
                        "Passwords do not match."
                    );

                    return;
                }

                try {

                    const data =
                        await apiRequest(
                            "/api/auth/reset-password",
                            {
                                method: "POST",

                                body:
                                    JSON.stringify({
                                        token:
                                            resetToken,

                                        password:
                                            password.value
                                    })
                            }
                        );

                    showMessage(
                        message,
                        data.message ||
                        "Password reset successfully.",
                        "success"
                    );

                    setTimeout(
                        function () {

                            window.location.href =
                                "login.html";

                        },
                        1000
                    );

                } catch (error) {

                    showMessage(
                        message,
                        error.message ||
                        "Password reset failed."
                    );
                }
            }
        );
    }


    /* =====================================================
       VEHICLE FARE CALCULATION
       ===================================================== */

    const fareRates = {

        bike: {
            base: 25,
            perKm: 8
        },

        auto: {
            base: 35,
            perKm: 11
        },

        car: {
            base: 50,
            perKm: 15
        }
    };


    function calculateFare(
        distance,
        vehicle
    ) {

        const selected =
            fareRates[
                String(vehicle).toLowerCase()
            ] ||
            fareRates.bike;

        const km =
            Number(distance) || 0;

        return Math.round(
            selected.base +
            km * selected.perKm
        );
    }


    function calculateETA(
        distance
    ) {

        const km =
            Number(distance) || 0;

        if (km <= 0) {
            return 0;
        }

        /*
         * Approximate average city speed.
         * Actual routing ETA can be supplied
         * by the map/routing service.
         */

        const averageSpeed = 25;

        return Math.max(
            1,
            Math.ceil(
                (km / averageSpeed) * 60
            )
        );
    }


    window.GoRideFare = {

        calculateFare:
            calculateFare,

        calculateETA:
            calculateETA
    };


    /* =====================================================
       VEHICLE SELECTION
       ===================================================== */

    const vehicleInputs =
        document.querySelectorAll(
            "input[name='vehicle']"
        );

    const fareElement =
        document.querySelector(
            "#fare, #fareAmount, .fare-value"
        );

    const etaElement =
        document.querySelector(
            "#eta, #estimatedTime, .eta-value"
        );

    const distanceElement =
        document.querySelector(
            "#distance, #distanceValue, .distance-value"
        );


    function updateFare() {

        if (!vehicleInputs.length) {
            return;
        }

        let selectedVehicle =
            "bike";

        vehicleInputs.forEach(
            function (input) {

                if (input.checked) {
                    selectedVehicle =
                        input.value.toLowerCase();
                }
            }
        );

        let distance = 0;

        if (distanceElement) {

            distance =
                parseFloat(
                    distanceElement.dataset.distance ||
                    distanceElement.textContent ||
                    "0"
                ) || 0;
        }

        const fare =
            calculateFare(
                distance,
                selectedVehicle
            );

        const eta =
            calculateETA(distance);

        if (fareElement) {
            fareElement.textContent =
                "₹" + fare;
        }

        if (etaElement) {
            etaElement.textContent =
                eta + " min";
        }
    }


    vehicleInputs.forEach(
        function (input) {

            input.addEventListener(
                "change",
                updateFare
            );
        }
    );


    /* =====================================================
       CONFIRM RIDE
       ===================================================== */

    const confirmRideButton =
        document.querySelector(
            "#confirmRideBtn, .confirm-ride-btn"
        );

    if (confirmRideButton) {

        confirmRideButton.addEventListener(
            "click",
            async function (event) {

                event.preventDefault();

                const pickup =
                    document.querySelector(
                        "#pickup, [name='pickup']"
                    );

                const destination =
                    document.querySelector(
                        "#destination, [name='destination']"
                    );

                if (
                    !pickup ||
                     !destination ||
                    !pickup.value.trim() ||
                    !destination.value.trim()
                ) {

                    alert(
                        "Please enter pickup and destination."
                    );

                    return;
                }

                let vehicle =
                    "bike";

                document
                    .querySelectorAll(
                        "input[name='vehicle']"
                    )
                    .forEach(
                        function (input) {

                            if (input.checked) {
                                vehicle =
                                    input.value;
                            }
                        }
                    );


                const originalText =
                    confirmRideButton.textContent;

                confirmRideButton.disabled = true;

                confirmRideButton.textContent =
                    "Booking...";


                try {

                    const data =
                        await apiRequest(
                            "/api/rides",
                            {
                                method: "POST",

                                body:
                                    JSON.stringify({

                                        pickup:
                                            pickup.value.trim(),

                                        destination:
                                            destination.value.trim(),

                                        vehicle:
                                            vehicle,

                                        distance:
                                            parseFloat(
                                                distanceElement?.dataset.distance ||
                                                "0"
                                            ) || 0
                                    })
                            }
                        );


                    localStorage.setItem(
                        "goride_current_ride",
                        JSON.stringify(
                            data.ride ||
                            data
                        )
                    );


                    const confirmation =
                        document.querySelector(
                            "#bookingConfirmation, .booking-confirmation"
                        );


                    if (confirmation) {

                        confirmation.style.display =
                            "block";

                        confirmation.textContent =
                            data.message ||
                            "Ride booked successfully!";
                    }


                    /*
                     * If a dedicated confirmation
                     * page exists, open it.
                     */

                    if (
                        !confirmation &&
                        document.body.dataset.redirectConfirmation === "true"
                    ) {

                        window.location.href =
                            "ride-confirmation.html";
                    }


                } catch (error) {

                    alert(
                        error.message ||
                        "Unable to book ride."
                    );

                } finally {

                    confirmRideButton.disabled =
                        false;

                    confirmRideButton.textContent =
                        originalText;
                }
            }
        );
    }


    /* =====================================================
       CANCEL RIDE
       ===================================================== */

    const cancelButtons =
        document.querySelectorAll(
            "#cancelRideBtn, .cancel-ride-btn"
        );

    cancelButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const ride =
                        JSON.parse(
                            localStorage.getItem(
                                "goride_current_ride"
                            ) ||
                            "null"
                        );

                    if (!ride?._id && !ride?.id) {

                        alert(
                            "No active ride found."
                        );

                        return;
                    }

                    const rideId =
                        ride._id ||
                        ride.id;

                    try {

                        await apiRequest(
                            "/api/rides/" +
                            rideId +
                            "/cancel",
                            {
                                method: "PATCH"
                            }
                        );

                        localStorage.removeItem(
                            "goride_current_ride"
                        );

                        alert(
                            "Ride cancelled."
                        );

                        window.location.reload();

                    } catch (error) {

                        alert(
                            error.message ||
                            "Unable to cancel ride."
                        );
                    }
                }
            );
        }
    );


    /* =====================================================
       COMPLETE RIDE
       ===================================================== */

    const completeButtons =
        document.querySelectorAll(
            "#completeRideBtn, .complete-ride-btn"
        );

    completeButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const ride =
                        JSON.parse(
                            localStorage.getItem(
                                "goride_current_ride"
                            ) ||
                            "null"
                        );

                    const rideId =
                        ride?._id ||
                        ride?.id;

                    if (!rideId) {

                        alert(
                            "No active ride found."
                        );

                        return;
                    }

                    try {

                        await apiRequest(
                            "/api/rides/" +
                            rideId +
                            "/complete",
                            {
                                method: "PATCH"
                            }
                        );

                        localStorage.removeItem(
                            "goride_current_ride"
                        );

                        alert(
                            "Ride completed successfully!"
                        );

                        window.location.reload();

                    } catch (error) {

                        alert(
                            error.message ||
                            "Unable to complete ride."
                        );
                    }
                }
            );
        }
    );


    /* =====================================================
       DRIVER ACCEPT RIDE
       ===================================================== */

    const acceptButtons =
        document.querySelectorAll(
            "#acceptRideBtn, .accept-ride-btn"
        );

    acceptButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const rideId =
                        button.dataset.rideId;

                    if (!rideId) {

                        alert(
                            "Ride ID is missing."
                        );

                        return;
                    }

                    try {

                        const data =
                            await apiRequest(
                                "/api/rides/" +
                                rideId +
                                "/accept",
                                {
                                    method: "PATCH"
                                }
                            );

                        localStorage.setItem(
                            "goride_current_ride",
                            JSON.stringify(
                                data.ride ||
                                data
                            )
                        );

                        window.location.href =
                            "driver/active-ride.html";

                    } catch (error) {

                        alert(
                            error.message ||
                            "Unable to accept ride."
                        );
                    }
                }
            );
        }
    );


    /* =====================================================
       DRIVER SKIP RIDE
       ===================================================== */

    const skipButtons =
        document.querySelectorAll(
            "#skipRideBtn, .skip-ride-btn"
        );

    skipButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const request =
                        button.closest(
                            ".ride-request"
                        );

                    if (request) {
                        request.remove();
                    }
                }
            );
        }
    );


    /* =====================================================
       ONLINE / OFFLINE DRIVER MODE
       ===================================================== */

    const driverToggle =
        document.querySelector(
            "#driverOnlineToggle"
        );

    if (driverToggle) {

        driverToggle.addEventListener(
            "change",
            async function () {

                try {

                    await apiRequest(
                        "/api/drivers/status",
                        {
                            method: "PATCH",

                            body:
                                JSON.stringify({
                                    online:
                                        driverToggle.checked
                                })
                        }
                    );

                } catch (error) {

                    console.error(
                        "Driver status update failed:",
                        error
                    );
                }
            }
        );
    }


    /* =====================================================
       CURRENT RIDE DISPLAY
       ===================================================== */

    const currentRide =
        JSON.parse(
            localStorage.getItem(
                "goride_current_ride"
            ) ||
            "null"
        );

    if (currentRide) {

        document
            .querySelectorAll(
                "[data-current-ride-id]"
            )
            .forEach(
                function (element) {

                    element.textContent =
                        currentRide._id ||
                        currentRide.id ||
                        "";
                }
            );
    }


    /* =====================================================
       FINAL STARTUP MESSAGE
       ===================================================== */

    console.log(
        "GoRide app.js Part 2 loaded successfully."
    );

})();
