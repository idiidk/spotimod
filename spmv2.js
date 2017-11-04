#!/usr/bin/env node

const fs = require("fs-extra");
const argv = require("minimist")(process.argv.slice(2));
const path = require("path");
const replace = require("replace-in-file");
const uzip = require("extract-zip");
const zip = require("zip-folder");
const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

let cfg = readConfig();


if (!cfg.isSetup) {
    cfg.spotifyPath = "";
    writeConfig(JSON.stringify(cfg));
    cfg = readConfig();
} else {
    cfg = readConfig();
}

if (argv.setup) {
    setup(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Setup complete");
        }
    });
}

if (argv.server) {
    runServer(function () {
        console.log("Substrate server running on port 3000")
    });
}

if (argv.extract) {
    packSpa(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Done");
        }
    });
}

if (argv.clean) {
    clean(function (err) {
        console.log(err || "Done")
    });
}

function runServer(callback) {
    let spotifySocket = null;
    let status = {};
    status.spotifyConnection = false;

    app.get("/status", function (req, res) {
        res.send(JSON.stringify(status));
        res.end();
    });

    app.post("/emit", function (req, res) {
        let active = false;
        if (spotifySocket) {
            if (!active) {
                active = true;
                emitWithCallback(spotifySocket, req.body.event, req.body.data, function (data) {
                    res.send(JSON.stringify(data));
                    res.end();
                    active = false;
                });
            } else {
                res.send(JSON.stringify({
                    error: "Request already pending!"
                }));
            }
        } else {
            res.send(JSON.stringify({
                error: "No connection to spotify!"
            }));
            res.end();
        }
    });

    io.on("connection", function (socket) {
        socket.on("settype", function (data) {
            if (data.type === "spotify") {
                spotifySocket = socket;

                spotifySocket.on("disconnect", function () {
                    spotifySocket = null;
                    status.spotifyConnection = false;
                });

                status.spotifyConnection = true;
            }
        });

        socket.emit("gettype");
    });

    http.listen(3000, function () {
        if (typeof callback === "function") {
            callback();
        }
    });
}

function emitWithCallback(socket, event, data, callback) {
    let callbackId = event + "cb" + Math.round(Math.random() * 100);
    socket.emit(event, {
        callbackId: callbackId,
        data: data
    });
    socket.on(callbackId, callback);
}

function setup(callback) {
    if (fs.existsSync(argv.setup) && fs.existsSync(path.join(argv.setup, "/Apps"))) {
        cfg.spotifyPath = argv.setup;
        if (!cfg.isSetup) {
            editInternalViewFile("appendFileSync", "zlink", "index.html", "<script src='substrate.js'></script>", function (err) {
                editInternalViewFile("writeFileSync", "zlink", "substrate.js", fs.readFileSync(path.join("substrate", "substrate.js")), function (err) {
                    replaceInternViewFile("zlink", "bundle.js", "exports.albumRequest = exports.albumRequestAttempt = exports.albumRequestFailure = exports.albumRequestSuccess = exports.ALBUM_REQUEST_FAILURE = exports.ALBUM_REQUEST_SUCCESS = exports.ALBUM_REQUEST_ATTEMPT = undefined;", "exports.albumRequest = exports.albumRequestAttempt = exports.albumRequestFailure = exports.albumRequestSuccess = exports.ALBUM_REQUEST_FAILURE = exports.ALBUM_REQUEST_SUCCESS = exports.ALBUM_REQUEST_ATTEMPT = undefined; \n window.__native_require = require;", function (err) {
                        cfg.isSetup = true;
                        writeConfig(JSON.stringify(cfg));
                        callback(err);
                    });
                });
            });
        } else {
            editInternalViewFile("writeFileSync", "zlink", "substrate.js", fs.readFileSync(path.join("substrate", "substrate.js")), function (err) {
                cfg.isSetup = true;
                writeConfig(JSON.stringify(cfg));
                callback(err);
            });
        }
    } else {
        callback("Path incorrect");
    }
}

function clean(callback) {
    fs.remove(path.join(cfg.spotifyPath, "/Apps/zlink"), callback);
}

function replaceInternViewFile(viewname, filename, from, to, callback) {
    let folderPath = path.join(cfg.spotifyPath + "/Apps/", viewname);
    let filePath = path.join(folderPath, filename);

    extractSpaFile(folderPath + ".spa", folderPath, function (err) {
        if (err) {
            callback(err);
        } else {

            const changes = replace.sync({
                files: filePath,
                from: from,
                to: to,
            });

            zip(folderPath, folderPath + ".spa", function (err) {
                fs.remove(folderPath, function (err) {
                    callback(err);
                });
            });
        }
    });
}

function editInternalViewFile(mode, viewname, filename, data, callback) {
    let folderPath = path.join(cfg.spotifyPath + "/Apps/", viewname);
    let filePath = path.join(folderPath, filename);

    extractSpaFile(folderPath + ".spa", folderPath, function (err) {
        if (err) {
            callback(err);
        } else {
            fs[mode](filePath, data);

            zip(folderPath, folderPath + ".spa", function (err) {
                fs.remove(folderPath, function (err) {
                    callback(err);
                });
            });
        }
    });
}

function extractSpaFile(path, unzipPath, callback) {
    uzip(path, {
        dir: unzipPath,
        defaultDirMode: 511,
        defaultFileMode: 511
    }, function (err) {
        callback(err);
    });
}

function packSpa(callback) {
    if (isSetup) {
        const spotifyAppsPath = path.join(cfg.spotifyPath, "/Apps");
        const modulesPath = path.join(spotifyAppsPath, "/modules");
        getDirsInDir(modulesPath, function (toInstallModules) {
            let forEachCounter = 0;
            toInstallModules.forEach(function (module) {
                let modulePath = path.join(spotifyAppsPath, "/" + module);
                forEachCounter++;

                extractSpaFile(modulePath + ".spa", modulePath, function () {
                    fs.copySync(path.join(modulesPath, module), modulePath);
                    zip(modulePath, modulePath + ".spa", function (err) {
                        if (err) {
                            callback(err);
                        } else {
                            fs.removeSync(modulePath);
                            if (forEachCounter === toInstallModules.length) {
                                callback(null);
                            }
                        }
                    });
                });
            });
        });
    } else {
        callback("Not setup yet!");
    }
}

function isSetup() {
    return cfg.isSetup;
}

function readConfig() {
    return JSON.parse(fs.readFileSync("config.json"));
}

function writeConfig(data) {
    return fs.writeFileSync("config.json", data);
}

function getDirsInDir(rootDir, cb) {
    fs.readdir(rootDir, function (err, files) {
        var dirs = [];
        for (var index = 0; index < files.length; ++index) {
            var file = files[index];
            if (file[0] !== '.') {
                var filePath = rootDir + '/' + file;
                fs.stat(filePath, function (err, stat) {
                    if (stat.isDirectory()) {
                        dirs.push(this.file);
                    }
                    if (files.length === (this.index + 1)) {
                        return cb(dirs);
                    }
                }.bind({
                    index: index,
                    file: file
                }));
            }
        }
    });
}