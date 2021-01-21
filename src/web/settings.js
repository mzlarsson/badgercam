const fs = require("fs");

var settings = undefined;

function loadSettings() {
    try {
        const homedir = require('os').homedir();
        const globalSettingsFile = `${homedir}/.badgercam/settings.json`;
        
        let settingsFile = fs.existsSync(globalSettingsFile) ? globalSettingsFile : "settings.json";

        // Note: Logging lib not loaded here. Write directly to console.
        console.log(`Reading settings from ${settingsFile}`);
        let data = fs.readFileSync(settingsFile);
        let settings = JSON.parse(data);

        if (!settings.devices){
            settings.devices = [];
        }

        return settings;
    } catch (e) {
        console.log("Could not load settings: " + e);
    }

    return {};
}

function getSettings() {
    if (settings === undefined){
        settings = loadSettings();
    }
    
    return settings;
}

module.exports = getSettings;