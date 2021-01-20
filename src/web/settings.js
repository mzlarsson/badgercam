const fs = require("fs");

function loadSettings() {
    try {
        let data = fs.readFileSync('settings.json');
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