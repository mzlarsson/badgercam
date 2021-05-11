
const email = require('./email');
const settings = require('./settings')();
const logger = require('./logging')('notifications');

const fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const thumbnailFolder = "public/thumbnails";

function sendSyncEmailIfEnabled(downloadsData, fullSyncLog){
    let emailEnabled = (settings.sync && settings.sync.email && settings.sync.email.length > 0);
    if (emailEnabled){
        generateDataTableFromDownloads(downloadsData).then(dataTable => {
            email.send(settings.sync.email, "Sync finished", `${dataTable.text}\n\n${fullSyncLog}`, dataTable.attachments);
        }).catch(err => {
            logger.error(`Failed to send notification email: ${err}`);
        });
    }
}

function generateDataTableFromDownloads(data){
    if (!fs.existsSync(thumbnailFolder)){
        fs.mkdirSync(thumbnailFolder);
    }

    let videoCounter = 0;
    let sectionGenerators = data.map(sync => createSyncSection(sync, videoCounter));
    return Promise.all(sectionGenerators).then(results => {
        let res = "<table>";
        res += results.map(r => r.text).join("\n");
        res += "</table>";
        return {text: res, attachments: results.map(r => r.attachments).flat()};
    });
}

function createSyncSection(sync, videoCounter){

    let rowGenerators = sync.downloads.map(d => createDownloadRow(d, videoCounter++));
    return Promise.all(rowGenerators).then(results => {
        let res = "";
        let host = sync.host;
        res += `<tr style='height:40px;background:#eeeeee;'><th colspan=5>${host}</th></tr>\n`;
        res += `<tr><th width=150 style='text-align:left;'>Filename</th><th width=100 style='text-align:left;'>File size</th><th style='text-align:left;'>Success</th><th style='text-align:left;'>Converted</th><th style='text-align:left;'>Preview</th></tr>\n`;
        res += results.map(r => r.text).join("\n");
        return {text: res, attachments: results.map(r => r.attachment).filter(x => x !== undefined)};
    });
}

function createDownloadRow(download, counter, result){
    return createPreview(download, counter).then(preview => {
        let filesize = (!download.success ? "-" : Math.round(fs.statSync(download.full_path).size / 1024) + " kB");
        let successStr = `<span style='color:${download.success ? "green;'>YES" : "red;'>NO"}</span>`;
        let convertedStr = (download.converted ? "YES" : "NO");
        let text = `<tr><td>${download.filename}</td><td>${filesize}</td><td style='text-align:center;'>${successStr}</td><td style='text-align:center;'>${convertedStr}</td><td>${preview.text}</td></tr>`;
        return {text: text, attachment: preview.attachment};
    });
}

function createPreview(download, counter){
    return new Promise((resolve, reject) => {
        if (!download.success || !download.converted){
            resolve({text: "-", attachment: undefined});
        } else {
            let useThumbnail = false;
            try {
                let timeStr = download.filename.substring(download.filename.length-10, download.filename.length-4);
                let time = parseInt(timeStr);
                useThumbnail = (time < 070000 || time >= 180000);
            } catch(e){
                console.log(`Unable to extract time from video filename: ${download.filename}`);
            }

            if (!useThumbnail){
                resolve({text: "Thumbnail skipped", attachment: undefined});
            }
            else {
                let outfile = `thumbnail_${counter}.png`;
                let outputPath = `${__dirname}/${thumbnailFolder}/${outfile}`;
                createThumbnail(download.full_path, outputPath).then(_ => {
                    let imgSrc = fs.readFileSync(outputPath, 'base64');
                    let cid = "" + (100 + counter);
                    let attachment = {
                        contentType: `image/png; name="${outfile}"`,
                        contentDisposition: `inline; filename="${outfile}"`,
                        encoding: 'base64',
                        headers: {
                            'Content-Location': outfile
                        },
                        cid: cid,
                        content: imgSrc
                    };
                    let res = `<img src="cid:${cid}" width=300 alt="Preview" title="Preview">`;
                    fs.unlinkSync(outputPath);
                    resolve({text: res, attachment: attachment});
                }).catch(err => {
                    resolve({text: "Unable to create thumbnail: \n" + err, attachment: undefined});
                });
            }
        }
    });
}

function createThumbnail(inputPath, outputPath){
    return new Promise(async (resolve, reject) => {

        return ffmpeg()
          .input(inputPath)
          .inputOptions([`-ss 00:00:01`])
          .outputOptions(['-vframes 1', '-q:v 2', '-vf scale=320:240'])
          .noAudio()
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
}


exports.sendSyncEmailIfEnabled = sendSyncEmailIfEnabled;