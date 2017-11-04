function __initSpotifySubstrate() {
    spotifySubstrate = new SpotifySubstrate();
    spotifySubstrate.injectDebug();
    spotifySubstrate.injectFiles([
        "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io.js"
    ], function () {
        spotifySubstrate.initializeWebSocket();
        spotifySubstrate.themeEngine.initialize();
    });

    $(document).on("keyup", function (event) {
        if (event.keyCode === 190) {
            spotifySubstrate.injectDebug();
        }
    });
}

class SpotifySubstrate {
    constructor() {
        this.themeEngine = new ThemeEngine(this);
        this.native = new Native(this);
        this.socket = null;
        this.modules = localStorage.substrateModules || [];
    }

    initializeWebSocket() {
        const _this = this;

        this.socket = io.connect("http://localhost:3000", {
            transports: ["websocket"]
        });

        this.socket.on("gettype", function () {
            _this.socket.emit("settype", {
                type: "spotify"
            });
        })

        this.socket.on("inject", function (result) {
            _this.injectCode(result.data.type, result.data.code, function (err) {
                _this.socket.emit(result.callbackId, {
                    error: err
                });
            })
        });

        this.socket.on("run", function (result) {
            let evalExec = new Function(result.data.code)();
            _this.socket.emit(result.callbackId, {
                result: evalExec
            });
        });
    }

    openInCurrentView(url) {
        this.getCurrentView().attr("src", url);
    }

    injectToCurrentView(script) {
        this.getCurrentView().contents().
        find("body").
        append(script)
    }

    getCurrentView() {
        return $("iframe.active");
    }

    injectDebug() {
        this.injectFile("https://getfirebug.com/firebug-lite.js#startOpened");
    }

    injectCode(type, code, callback) {
        if (type === "js") {
            let script = document.createElement("script");
            script.appendChild(document.createTextNode(code));
            document.getElementsByTagName("body")[0].appendChild(script);
            callback();
        } else if (type === "css") {
            let css = document.createElement("style");
            css.setAttribute("type", "text/css");
            css.appendChild(document.createTextNode(code));
            document.getElementsByTagName("head")[0].appendChild(css);
            callback();
        } else {
            callback("File type not handled!");
        }
    }

    injectFiles(fileArray, callback) {
        let counter = 0;
        for (let i = 0; i < fileArray.length; i++) {
            let currentFile = fileArray[i];
            if (currentFile.indexOf(".js") !== -1) {
                let script = document.createElement("script");
                script.setAttribute("src", currentFile);
                script.setAttribute("type", "text/javascript");
                script.onload = function () {
                    counter++;
                    if (counter === fileArray.length) {
                        callback();
                    }
                };
                document.getElementsByTagName("body")[0].appendChild(script);
            } else if (currentFile.indexOf(".css") !== -1) {
                let css = document.createElement("link");
                css.setAttribute("href", currentFile);
                css.setAttribute("type", "text/css");
                css.setAttribute("rel", "stylesheet");
                css.onload = function () {
                    counter++;
                    if (counter === fileArray.length) {
                        callback();
                    }
                };
                document.getElementsByTagName("head")[0].appendChild(css);
            } else {
                callback("File type not handled!");
            }
        }
    }

    injectFile(url, callback) {
        if (url.indexOf(".js") !== -1) {
            let script = document.createElement("script");
            script.setAttribute("src", url);
            script.setAttribute("type", "text/javascript");
            script.onload = callback;
            document.getElementsByTagName("body")[0].appendChild(script);
        } else if (url.indexOf(".css") !== -1) {
            let css = document.createElement("link");
            css.setAttribute("href", url);
            css.setAttribute("type", "text/css");
            css.setAttribute("rel", "stylesheet");
            css.onload = callback;
            document.getElementsByTagName("head")[0].appendChild(css);
        } else {
            callback("File type not handled!");
        }
    }
}

class Native {
    constructor(spotifySubstrate) {
        this.spotifySubstrate = spotifySubstrate;
        this.require = __native_require;
    }

    interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        }
    }

    request(method, url, callback) {
        var _spotifyCosmosApi = this.require("spotify-cosmos-api");
        var _spotifyCosmosApi2 = this.interopRequireDefault(_spotifyCosmosApi);
        var req = new _spotifyCosmosApi2.default.Request(method, url, {});
        _spotifyCosmosApi2.default.resolver.resolve(req, (err, res) => {
            callback(err, res);
        });
    }
}

class ThemeEngine {
    constructor(spotifySubstrate) {
        this.engineId = this.guid();
        this.spotifySubstrate = spotifySubstrate;
        this.viewContext = null;
        this.mainStyle = null;
        this.viewStyle = null;
    }

    resetTheme() {
        this.mainStyle.empty();
        this.viewStyle.empty();
    }

    setThemeFile(url, viewUrl) {
        let _this = this;

        this.resetTheme();
        if (url) {
            this.spotifySubstrate.native.request("GET", url, function (err, res) {
                if (!err) {
                    _this.setTheme(res._body);
                }
            });
        }
        if (viewUrl) {
            this.spotifySubstrate.native.request("GET", url, function (err, res) {
                if (!err) {
                    _this.setTheme("", res._body);
                }
            });
        }
    }

    setTheme(theme, viewTheme) {
        this.resetTheme();
        this.mainStyle.append(theme);
        this.viewStyle.append(theme || viewTheme);
    }

    themeElement(element, rules) {
        this.mainStyle.append(element + "{" + rules + "}");
        this.viewStyle.append(element + "{" + rules + "}");
        return element;
    }

    initialize() {
        $("html head").find("#" + this.engineId).remove();
        $("html head").append("<style id='" + this.engineId + "'></style>");
        $("html head", this.viewContext).find("#" + this.engineId).remove();
        $("html head", this.viewContext).append("<style id='" + this.engineId + "'></style>");
        this.mainStyle = $("html head").find("#" + this.engineId);
        this.viewStyle = $("html head", this.viewContext).find("#" + this.engineId);
        this.viewContext = this.spotifySubstrate.getCurrentView().contents();
    }

    guid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }
}

__initSpotifySubstrate();