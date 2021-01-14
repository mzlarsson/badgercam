
function createSetup(bgFile, options){
    return {
        backgroundFile: bgFile,
        width: (options.width ? options.width : 1920),
        height: (options.height ? options.height : 1080),
        fps: (options.fps ? options.fps : 15),
        gridSize: (options.gridSize ? options.gridSize : undefined),
        outPort: (options.outPort ? options.outPort : 15666),
        outPath: (options.outPath ? options.outPath : "stream.flv"),
        feeds: []
    };
}

function addFeed(setup, source){
    setup.feeds.push({source: source});
}

function generate(setup) {
    let nofFeeds = setup.feeds.length;
    setup.gridSize = (setup.gridSize ? setup.gridSize : Math.ceil(Math.sqrt(nofFeeds)));
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
        result += generateFeed(parseInt(i), setup.feeds[i], feedWidth, feedHeight);
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

function generateFeed(feedIndex, feedData, width, height){
    let index = feedIndex+1;
    return `
new   ${index} broadcast enabled
setup ${index} input ${feedData.source}
setup ${index} option dshow-fps=15
setup ${index} option dshow-size="${width}x${height}"
setup ${index} output #duplicate{dst=mosaic-bridge{id=${index},width=${width},height=${height}},select=video,dst=bridge-out{id=${feedIndex}}}
    `;
}

function generateBackground(setup) {
    let nofFeeds = setup.feeds.length;
    let orderArg = [...Array(nofFeeds).keys()].map(x => parseInt(x)+1).join(",");
    return `
new   bg broadcast enabled
setup bg input ${setup.backgroundFile}
setup bg option image-duration=-1
setup bg output #transcode{sfilter=mosaic{width=${setup.width},height=${setup.height},cols=${setup.gridSize},rows=${setup.gridSize},position=1,order="${orderArg}",keep-aspect-ratio=enabled,keep-picture=1},vcodec=FLV1,VB=200,acodec=none,deinterlace,fps=${setup.fps}}:duplicate{dst=std{access=http{mime=video/x-flv},mux=ffmpeg{mux=flv},dst=:${setup.outPort}/${setup.outPath}},dst=display}
    `;
}


exports.createSetup = createSetup;
exports.addFeed = addFeed;
exports.generate = generate;



/* Test program for when run directly with 'node vlmgen.js' */
if (require.main === module){
    let s = createSetup("file:///home/matz/Documents/badgercam/src/bg_mosaic.png", {width: 1440, height: 810, outPort: 9675, outPath: "stream.flv"});
    addFeed(s, "rtsp://192.168.101.118:554/video1");
    // addFeed(s, "file:///home/matz/Documents/badgercam/src/web/public/synced_videos/1c_7e_51_a6_cd_3e/20210102/0/172329.mp4");
    console.log(generate(s));   
}