
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const syncPath = "public/synced_videos";
const videoFormat = '.mp4';

var settings = {};
var videos = [];
var markedVideos = [];


function load() {
    loadSettings();
    loadRuntimeInfo();

    let watcher = chokidar.watch(syncPath)
      .on('add', onFileAdded)
      .on('unlink', onFileRemoved)
      .on('addDir', path => console.log(`TODO: Directory ${path} has been added. New device?`));
}

function loadSettings() {
    try {
        let data = fs.readFileSync('settings.json');
        settings = JSON.parse(data);
    } catch (e) {
        console.log("Could not load settings: " + e);
    }
}

function loadRuntimeInfo() {
    try {
        let data = fs.readFileSync('runtime_info.json');
        let jsonData = JSON.parse(data);
        markedVideos = jsonData["marked_videos"];
    } catch (e) {
        console.log("Could not load runtime info: " + e);
    }
}


function storeRuntimeInfo() {
    try {
        let out = JSON.stringify({
            "marked_videos": markedVideos
        }, null, 4);
        fs.writeFileSync('runtime_info.json', out);
    } catch (e) {
        console.log("Could not write runtime info: " + e);
    }
}

function onFileAdded(path) {
    if (path.toLowerCase().endsWith(videoFormat)) {
        let fileData = getFileDataFromPath(path);
        if (fileData) {
            videos.push(fileData);
            // console.log("Added video with path " + path);
        }
    }
}

function onFileRemoved(path) {
    let fileData = getFileDataFromPath(path);
    let index = videos.findIndex(data => data.file === fileData.file);
    if (index >= 0) {
        videos.splice(index, 1);
        console.log("Removed video with path " + path);
    }
}

function removeVideoFromDisk(id) {
    let fileDatas = videos.filter(x => x.id === id);
    if (fileDatas.length == 0) {
        console.log("Warning! Tried to remove non-existant video.");
        return [false, "Unable to find given video"];
    }

    let fileData = fileDatas[0];
    let path = getFileFromLocalUrl(fileData.file);
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
        return [true, ""];
    } else {
        console.log("Critical error: Found video entry in list but not file on disk");
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

function getDeviceName(device) {
    if (settings.devices && device in settings.devices) {
        return settings.devices[device].name;
    }

    return device;  // No translation found
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









/* -------- EXPORT FUNCTIONS --------- */
exports.loadBackend = load;
exports.getVideos = getVideos;
exports.removeVideo = removeVideoFromDisk;
exports.setVideoMarked = setVideoMarked;