$(function () {
    $(window).on("hashchange", function () {
        loadPage(window.location.hash.replace("#", "") + ".html");
    });

    if (document.location.hash === "" || document.location.hash === "#") {
        document.location.hash = "main";
    } else {
        loadPage(document.location.hash.replace("#", "") + ".html");
    }

    setInterval(function () {
        getStatus(function (data) {
            updateStatus(data);
        });
    }, 5000);

    getStatus(function (data) {
        updateStatus(data);
    });
});

function injectCode(code, callback) {
    $.ajax({
        type: "POST",
        url: "/emit",
        data: {
            event: "run",
            data: {
                code: code
            }
        },
        success: callback
    });
}

function updateStatus(data) {
    let dataParsed = JSON.parse(data);
    if (dataParsed.spotifyConnection) {
        $(".status-badge").text("Connected");
        $(".status-badge").removeClass("red");
        $(".status-badge").addClass("green");
    } else {
        $(".status-badge").text("Disconnected");
        $(".status-badge").removeClass("green");
        $(".status-badge").addClass("red");
    }
}

function getStatus(callback) {
    $.get("/status", callback ? callback : function () {});
}

function loadPage(url) {
    $(".wrapper").fadeOut(function () {
        $.get(url, function (data) {
            $(".wrapper").html(data);
            $(".wrapper").fadeIn();
        });
    });
}