const fs = require('fs');

function createSetup(options){
    return {
        width: (options.width ? options.width : 1920),
        height: (options.height ? options.height : 1080),
        fps: (options.fps ? options.fps : 25),
        gridSize: (options.gridSize ? options.gridSize : undefined),
        outPort: (options.outPort ? options.outPort : 15666),
        outPath: (options.outPath !== undefined ? options.outPath : "stream.flv"),
        feeds: []
    };
}

function addFeed(setup, source){
    setup.feeds.push({source: source});
}

function generateToFile(setup, filename){
    let outFile = __dirname + "/" + filename;
    fs.writeFileSync(outFile, generate(setup));
    return outFile;
}

function generate(setup) {
    let nofFeeds = setup.feeds.length;
    setup.gridSize = (setup.gridSize && setup.gridSize !== "auto" ? setup.gridSize : Math.ceil(Math.sqrt(nofFeeds)));
    let feedWidth = Math.round(setup.width / setup.gridSize);
    let feedHeight = Math.round(setup.height / setup.gridSize);

    let result = "";
    result += "# Comment the following line if you don't want to reset your VLM configuration\n"
    result += "del all\n"
    result += "\n"
    result += "# Background options\n"
    result += generateBackground(setup)
    result += "\n"
    result += "# Input options\n"
    for (let i in setup.feeds){
        result += generateFeed(parseInt(i), setup.feeds[i], feedWidth, feedHeight, setup.fps);
    }
    result += "\n"
    result += "# Launch everything\n"
    result += "control bg play\n"
    for (let i in setup.feeds){
        result += "control " + (parseInt(i)+1) + " play\n"
    }
    result += "\n"
    return result;
}

function generateFeed(feedIndex, feedData, width, height, fps){
    let index = feedIndex+1;
    return `
new   ${index} broadcast enabled
setup ${index} input ${feedData.source}
setup ${index} option dshow-fps=${fps}
setup ${index} option dshow-size="${width}x${height}"
setup ${index} output #duplicate{dst=mosaic-bridge{id=${index},width=${width},height=${height}},select=video,dst=bridge-out{id=${feedIndex}}}
    `;
}

function generateBackground(setup) {
    let nofFeeds = setup.feeds.length;
    let orderArg = [...Array(nofFeeds).keys()].map(x => parseInt(x)+1).join(",");
    let backgroundFile = `file://${__dirname}/backgrounds/bg_mosaic_${setup.gridSize}x${setup.gridSize}.png`;
    return `
new   bg broadcast enabled
setup bg input ${backgroundFile}
setup bg option image-duration=-1
setup bg output #transcode{sfilter=mosaic{width=${setup.width},height=${setup.height},cols=${setup.gridSize},rows=${setup.gridSize},position=1,order="${orderArg}",keep-aspect-ratio=enabled,keep-picture=1},vcodec=MJPG,venc=ffmpeg{strict=1},fps=${setup.fps}}:std{access=http{mime=multipart/x-mixed-replace;boundary=--7b3cc56e5f51db803f790dad720ed50a},mux=mpjpeg,dst=:${setup.outPort}/${setup.outPath}}
    `;

    // #transcode{vcodec=MJPG,venc=ffmpeg{strict=1}}:standard{access=http{mime=multipart/x-mixed-replace;boundary=--7b3cc56e5f51db803f790dad720ed50a},mux=mpjpeg,dst=:8080/}
}


exports.createSetup = createSetup;
exports.addFeed = addFeed;
exports.generate = generate;
exports.generateToFile = generateToFile;



/* Simple test program. Run by issuing 'node vlmgen.js' */
if (require.main === module){
    let s = createSetup({width: 1440, height: 810, outPort: 8080, outPath: ""});
    addFeed(s, "rtsp://192.168.101.118:554/video1");
    // addFeed(s, "file:///home/matz/Documents/badgercam/src/web/public/synced_videos/1c_7e_51_a6_cd_3e/20210102/0/172329.mp4");
    console.log(generate(s));   
}