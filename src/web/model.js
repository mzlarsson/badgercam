
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {PythonShell} = require('python-shell');
const arped = require('arped');
const cron = require('node-cron');

const live = require('./live/live');
const logger = require('./logging')('model');
const settings = require('./settings')();

// Don't use trailing slash for syncPath
const syncPath = "public/synced_videos";
const videoFormat = '.mp4';

var videos = [];
var markedVideos = [];
var syncListeners = {
    onStart: [],
    onUpdate: []
};

var isRunningSync = false;


function load() {
    loadRuntimeInfo();

    setupSyncSchedule();

    let watcher = chokidar.watch(syncPath)
      .on('add', onFileAdded)
      .on('unlink', onFileRemoved)
      .on('addDir', path => logger.debug(`TODO: Directory ${path} has been added. New device?`));
}

function loadRuntimeInfo() {
    try {
        let data = fs.readFileSync('runtime_info.json');
        let jsonData = JSON.parse(data);
        markedVideos = jsonData["marked_videos"];
    } catch (e) {
        logger.error("Could not load runtime info: " + e);
    }
}

function storeRuntimeInfo() {
    try {
        let out = JSON.stringify({
            "marked_videos": markedVideos
        }, null, 4);
        fs.writeFileSync('runtime_info.json', out);
    } catch (e) {
        logger.fatal("Could not write runtime info: " + e);
    }
}

function setupSyncSchedule(){
    if (settings.sync && settings.sync.autosync){
        for (let cronEntry of settings.sync.autosync){
            try {
                cron.schedule(cronEntry, runSync);
            } catch(e) {
                logger.error(`Unable to use autosync entry '${cronEntry}', skipping...`);
            }
        }
    }
}

function registerSyncListener(onStart, onUpdate){
    if (onStart){
        syncListeners.onStart.push(onStart);
    }
    if (onUpdate){
        syncListeners.onUpdate.push(onUpdate);
    }
}

function onFileAdded(path) {
    if (path.toLowerCase().endsWith(videoFormat)) {
        let fileData = getFileDataFromPath(path);
        if (fileData) {
            videos.push(fileData);
        }
    }
}

function onFileRemoved(path) {
    let fileData = getFileDataFromPath(path);
    let index = videos.findIndex(data => data.file === fileData.file);
    if (index >= 0) {
        videos.splice(index, 1);
        logger.debug("Removed video with path " + path);
    }
}

function removeVideoFromDisk(id) {
    let fileDatas = videos.filter(x => x.id === id);
    if (fileDatas.length == 0) {
        logger.warn("Tried to remove non-existant video.");
        return [false, "Unable to find given video"];
    }

    let fileData = fileDatas[0];
    let path = getFileFromLocalUrl(fileData.file);
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
        return [true, ""];
    } else {
        logger.fatal("Found video entry in list but not file on disk");
        return [false, "Video entry found but file could not be found on disk"];
    }
}

function setVideoMarked(id, marked) {
    if (videos.filter(x => x.id === id).length == 0){
        return [false, "Video does not exist"];
    }

    if (marked) {
        if (!markedVideos.includes(id)) {
            markedVideos.push(id);
            storeRuntimeInfo();
            return [true, ""];
        } else {
            return [false, "Tried to mark an already marked video"];
        }
    } else {
        let index = markedVideos.indexOf(id);
        if (index >= 0) {
            markedVideos.splice(index, 1);
            storeRuntimeInfo();
            return [true, ""];
        } else {
            return [false, "Tried to unmark an already unmarked video"];
        }
    }
}

function getDevices() {
    let res = [];
    for (let dev of settings.devices) {
        res.push({
            'addr': dev.mac,
            'name': getDeviceName(dev.mac)
        });
    }

    return res;
}

function setLiveDevices(deviceIds, port) {
    let success = true;
    let errorMsg = "";

    if (deviceIds === undefined){
        try{
            logger.info("Stopping live stream");
            live.stopStream();
        }
        catch(e){
            logger.error(e);
            success = false;
            errorMsg = e;
        }
    }
    else {
        let streams = [];
        for (let device of settings.devices){
            if (deviceIds === "all" || deviceIds.includes(device.mac)){
                if ("rtsp" in device){
                    streams.push(`rtsp://${device.ip}:${device.rtsp.port}/${device.rtsp.path}`);
                }
            }
        }

        try{
            logger.info("Starting live stream with the following streams: " + streams);
            live.showLive(streams, port);
        }
        catch(e){
            logger.error(e);
            success = false;
            errorMsg = e;
        }
    }

    return [success, errorMsg];
}

function getVideos(grouping, sorting) {
    let sortAscending = (sorting !== "desc");
    if (grouping === "camera") {
        return getVideosByCamera(sortAscending);
    }
    else if (grouping === "date"){
        return getVideosByDate(sortAscending);
    }
    else {
        return getVideosByDate(sortAscending);
    }
}

function getVideosByDate(sortAscending) {
    return getVideosByProp(file => file.date, file => file.camera_name + " " + file.time, ['time'], sortAscendingGroups=sortAscending);
}

function getVideosByCamera(sortAscending) {
    return getVideosByProp(file => file.camera_name, file => file.date + " " + file.time, ['date', 'time'], sortAscendingGroups=sortAscending);
}

function getVideosByProp(keyFunc, displayFunc, sortPropsItems, sortAscendingGroups=true) {
    let result = groupBy(videos, keyFunc);
    for (let key in result) {
        // Calculate display text
        for (let i in result[key]) {
            result[key][i]['display'] = displayFunc(result[key][i]);
            result[key][i]["marked"] = markedVideos.includes(result[key][i]["id"]);
        }

        // Sort group items by given properties
        result[key].sort((file1, file2) => {
            for (let sortProp of sortPropsItems) {
                if (file1[sortProp] != file2[sortProp]) {
                    return (file1[sortProp] > file2[sortProp] ? 1 : -1);
                }
            }
            return -1;
        });
    }

    // Sort groups
    let keys = Object.keys(result);
    keys.sort((k1, k2) => (k1 < k2 ? (sortAscendingGroups ? -1 : 1) : (sortAscendingGroups ? 1 : -1)));
    let resultArr = [];
    for (let key of keys) {
        resultArr.push({
            "key": key,
            "files": result[key]
        });
    }

    return resultArr;
}

function getFileDataFromPath(file) {
    let parts = file.split(path.sep);
    if (parts.length < 4) {
        return undefined;
    }

    let publicUrl = getPublicUrl(file);
    let device = parts[parts.length-4].replace(/_/g, ":");
    let deviceName = getDeviceName(device);
    let dateSrc = parts[parts.length-3];
    let date = dateSrc.substring(0, 4) + "-" + dateSrc.substring(4, 6) + "-" + dateSrc.substring(6);
    let timeSrc = path.basename(parts[parts.length-1], videoFormat);
    let time = timeSrc.substring(0, 2) + ":" + timeSrc.substring(2, 4) + ":" + timeSrc.substring(4);
    let fileData = {
        "camera": device,
        "camera_name": deviceName,
        "date": date,
        "time": time,
        "file": publicUrl
    };
    fileData["id"] = generateId(fileData);
    return fileData;
}

function getPublicUrl(file) {
    // TODO: This is hacky. Fix.
    if (file.startsWith("public")) {
        file = file.substring(6);
    }

    if (!file.startsWith("/")) {
        file = "/" + file;
    }

    return file;
}

function getFileFromLocalUrl(url) {
    // TODO: This is hacky again. Security? Fix safe path.
    return "public" + (url.startsWith("/") ? "" : "/") + url;
}

function getDeviceName(mac) {
    let device = settings.devices.filter(dev => dev.mac === mac);
    if (device.length === 1) {
        return device[0].name;
    }

    return mac;  // No translation found
}

function groupBy(list, keyFunc) {
    return list.reduce((groups, item) => {
        const groupKey = keyFunc(item);
        const group = (groups[groupKey] || []);
        group.push(item);
        groups[groupKey] = group;
        return groups;
    }, {});
}

function generateId(fileData) {
    let source = fileData.camera + " " + fileData.date + " " + fileData.time;
    return crypto.createHash("md5").update(source).digest("hex");
}



function runSync() {

    if (isRunningSync) {
        logger.warn("Another sync is already running. Skipping...");
        return;
    }

    let announceStart = () => {
        for (let onStartListener of syncListeners.onStart){
            onStartListener();
        }
    };

    let announceUpdate = (update) => {
        for (let onUpdateListener of syncListeners.onUpdate){
            onUpdateListener(update);
        }
    };

    isRunningSync = true;
    announceStart();

    let arpTable = arped.parse(arped.table());
    let deviceArgs = [];
    for (const device of settings.devices) {
        args = []

        let addArgIfExist = (arg, propPath) => {
            let tmp = device;
            let error = false;
            propPath = Array.isArray(propPath) ? propPath : [propPath];

            for (let prop of propPath) {
                if (prop in tmp) {
                    tmp = tmp[prop];
                } else {
                    error = true;
                    break;
                }
            }

            if (!error){
                args.push(arg);
                args.push(tmp);
            }
        };

        let ip = device.ip;
        if (ip === undefined) {
            announceUpdate("Auto-detecting IP address for device " + device.mac + "...");
            let interface = ("interface" in device ? device.interface : "wlan0");
            if (interface in arpTable.Devices) {
                ip = arpTable.Devices[interface].MACs[device.mac];
            }

            if (ip === undefined) {
                let name = ("name" in device ? device.name : "Unnamed device");
                announceUpdate("Could not find IP address for device with MAC address " + device.mac + " (" + name + "). Skipping it...");
                continue;
            } else {
                announceUpdate("IP address found! Using " + ip);
            }
        }

        let deviceFolder = device.mac.replace(/:/g, "_");
        args.push(ip);
        addArgIfExist("--telnet-user", ["telnet", "user"]);
        addArgIfExist("--telnet-pass", ["telnet", "password"]);
        addArgIfExist("--interface", "interface");
        addArgIfExist("--remote-folder", "remote_folder");
        addArgIfExist("--sync-limit", ["sync", "limit"]);
        addArgIfExist("--sync-cooldown", ["sync", "cooldown"]);
        args.push("--sync-folder");
        args.push(`${syncPath}/${deviceFolder}`);

        deviceArgs.push(args);
    }

    announceUpdate("");    // Just trigger newline. Little but hacky, but meh xD
    announceUpdate("Running update of " + deviceArgs.length + " device" + (deviceArgs.length != 1 ? "s" : ""));

    let syncNextDevice = () => {
        if (deviceArgs.length > 0) {
            let args = deviceArgs.shift();
            runSyncOfDevice(args, announceUpdate, syncNextDevice);
        } else {
            isRunningSync = false;
            announceUpdate("All devices updated");
            announceUpdate("");
        }
    };
    syncNextDevice();
}

function runSyncOfDevice(args, onNewUpdate, onDone) {

    let options = {
        mode: 'text',
        pythonOptions: ['-u'], // get print results in real-time
        scriptPath: '../sync/',
        args: args
    };

    let pyshell = new PythonShell('sync.py', options);
    pyshell.on('message', onNewUpdate);

    // end the input stream and allow the process to exit
    pyshell.end(function (err,code,signal) {
        logger.info("Sync of device ended, result:")
        if (err) {
            logger.error(err);
            onNewUpdate("Critical error: " + err);
        }
        logger.info('Exit code: ' + code + "\tExit signal: " + signal);

        onNewUpdate("Sync of device finished");
        onDone();
    });
}








/* -------- EXPORT FUNCTIONS --------- */
exports.loadBackend = load;
exports.getVideos = getVideos;
exports.getDevices = getDevices;
exports.removeVideo = removeVideoFromDisk;
exports.setVideoMarked = setVideoMarked;
exports.runManualSync = runSync;
exports.registerSyncListener = registerSyncListener;
exports.setLiveDevices = setLiveDevices;