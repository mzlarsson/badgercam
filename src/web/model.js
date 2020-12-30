
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const syncPath = "public/synced_videos";
const videoFormat = '.mp4';

var settings = {};
var videos = [];


function load() {
    loadSettings();
    //videos = getFilesFromDir(syncPath, videoFormat).map(getFileDataFromPath).filter(Boolean);
    
    // TODO: Set up chokidar sync
    let watcher = chokidar.watch(syncPath)
      .on('add', addVideoByPath)
      .on('unlink', removeVideoByPath)
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

function addVideoByPath(path) {
    if (path.toLowerCase().endsWith(videoFormat)) {
        let fileData = getFileDataFromPath(path);
        if (fileData) {
            videos.push(fileData);
            // console.log("Added video with path " + path);
        }
    }
}

function removeVideoByPath(path) {
    let fileData = getFileDataFromPath(path);
    let index = videos.findIndex(data => data.file === fileData.file);
    if (index >= 0) {
        videos.splice(index, 1);
        // console.log("Removed video with path " + path);
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


/* ----------- HELPERS ------------ */
function getFilesFromDir(dir, format) {
    let result = [];
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            result.push(...getFilesFromDir(fullPath, format));
        } else if (format === undefined || path.extname(fullPath) === format) {
            result.push(fullPath);
        }  
    });
    return result;
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