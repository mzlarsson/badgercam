const fs = require("fs");

function loadSettings() {
    try {
        const homedir = require('os').homedir();
        const globalSettingsFile = `${homedir}/.badgercam/settings.json`;
        
        let settingsFile = fs.existsSync(globalSettingsFile) ? globalSettingsFile : "settings.json";

        // Note: Logging lib not loaded here. Write directly to console.
        console.log(`Reading settings from ${settingsFile}`);
        let data = fs.readFileSync(settingsFile);
        let settings = JSON.parse(data);

        // Make devices indexed by mac addr
        let devices = {};
        if (settings.devices){
            for (let dev in settings.devices){
                devices[dev.mac] = dev;
            }
        }
        settings.devices = devices;

        return settings;
    } catch (e) {
        logger.fatal("Could not load settings: " + e);
    }

    return {};
}

module.exports = loadSettings;