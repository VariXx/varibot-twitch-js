const fs = require('fs');

async function getHueSettings(hueSettingsFile) {
    try {
        const settings = fs.readFileSync(hueSettingsFile);
        return JSON.parse(settings);
    }
    catch(error) {
        // console.log(error);
        return undefined;
    }
}

module.exports.getHueSettings = getHueSettings;
