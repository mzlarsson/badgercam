var log4js = require('log4js');
const fs = require('fs');
const path = require('path');

const settings = require('./settings')();
var defaultLogFile = "logs/badgercam.log";

function init() {
    let logFile = (settings.log_file ? settings.log_file : defaultLogFile);
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