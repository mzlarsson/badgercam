var log4js = require('log4js');
const fs = require('fs');
const path = require('path');

var logFile = "logs/badgercam.log";

function readLogPath(){
    try {
        let data = fs.readFileSync('settings.json');
        let settings = JSON.parse(data);
        if (settings.log_file){
            logFile = settings.log_file;
        }
    } catch (e) {
        console.log("Failed to read log path from settings.json: " + e);
    }
}

function init() {
    let dir = path.dirname(logFile);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, {recursive: true});
    }
    
    log4js.configure({
        appenders: {
            'console': { type: 'console' },
            'file': { type: 'fileSync', filename: logFile },
            'limitedConsole': { type: 'logLevelFilter', level: 'INFO', appender: 'console' },
        },
        categories: {
            default: { appenders: ['file', 'limitedConsole'], level: 'DEBUG' },
        }
    });
}

readLogPath();
init();

module.exports = log4js.getLogger;