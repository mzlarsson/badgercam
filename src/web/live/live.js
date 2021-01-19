const vlmgen = require('./vlmgen');
const { spawn } = require('child_process');

const logger = require('../logging')('live');

var currentVLCProcess = undefined;
var vlmFilename = "live.vlm";

function showLive(streams, port){
    let s = vlmgen.createSetup({width: 1440, height: 810, outPort: port, outPath: "live"});
    for (let stream of streams) {
        vlmgen.addFeed(s, stream);
    }
    vlmgen.generateToFile(s, vlmFilename);

    startNewLive();
}

function stopOldLive(){
    if (currentVLCProcess){
        logger.info("Stopping VLC re-stream");
        currentVLCProcess.kill();
        currentVLCProcess = undefined;
    }
}

function startNewLive() {

    if (currentVLCProcess) {
        stopOldLive();

        // Hacky solution. Give the process some time to shut down
        setTimeout(startNewLive, 300);
        return;
    }

    let confFile = `${__dirname}/${vlmFilename}`;
    currentVLCProcess = spawn('vlc', ['-I', 'dummy', "--vlm-conf", confFile]);
    logger.debug(`Live re-stream spawned using ${confFile}`);
}

exports.showLive = showLive;
exports.stopStream = stopOldLive;


/* Simple test program. Run by issuing 'node live.js' */
if (require.main === module){
    let streams = ["rtsp://192.168.101.118:554/video1"];
    showLive(streams, 9675);
}