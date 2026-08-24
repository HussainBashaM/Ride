/* =========================================================
   GORIDE - MAIN APP.JS
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("GoRide application loaded successfully");

});


/* =========================================================
   BOOK A RIDE
========================================================= */

function bookRide(event) {

    if (event) {
        event.preventDefault();
    }

    const token = localStorage.getItem("goride_token");

    if (token) {

        window.location.href = "user/dashboard.html";

    } else {

        window.location.href =
            "user/login.html?next=dashboard";

    }
}


/* =========================================================
   SAVE LOGIN INFORMATION
========================================================= */

function saveAuth(data) {

    if (!data) {
        return false;
    }

    if (data.token) {

        localStorage.setItem(
            "goride_token",
            data.token
        );

    }

    if (data.user) {

        localStorage.setItem(
            "goride_user",
            JSON.stringify(data.user)
        );

    }

    return true;
}


/* =========================================================
   GET AUTH HEADERS
========================================================= */

function authHeaders() {

    const token =
        localStorage.getItem("goride_token");

    return {
        "Content-Type": "application/json",
        "Authorization": token
            ? "Bearer " + token
            : ""
    };
}


/* =========================================================
   GET CURRENT USER
========================================================= */

function getCurrentUser() {

    const user =
        localStorage.getItem("goride_user");

    if (!user) {
        return null;
    }

    try {

        return JSON.parse(user);

    } catch (error) {

        console.error(
            "Invalid saved user data"
        );

        localStorage.removeItem(
            "goride_user"
        );

        return null;
    }
}


/* =========================================================
   CHECK LOGIN
========================================================= */

function isLoggedIn() {

    return !!localStorage.getItem(
        "goride_token"
    );

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    localStorage.removeItem(
        "goride_token"
    );

    localStorage.removeItem(
        "goride_user"
    );

    window.location.href =
        "../index.html";
}


/* =========================================================
   PROTECT USER PAGES
========================================================= */

function requireLogin() {

    const token =
        localStorage.getItem("goride_token");

    if (!token) {

        window.location.href =
            "login.html";

        return false;
    }

    return true;
}
