const fs = require('fs');
const { getHueSettings } = require('./getHueSettings');

async function setHueSettings(hueSettingsFile, setting, newValue) {

    let newSettings = {}; 
    if(fs.existsSync(hueSettingsFile)) {
        let foundSetting = false;
        const oldSettings = await getHueSettings(hueSettingsFile);
        console.log(oldSettings);
        for(let key in oldSettings) {
            if(key == setting) { 
                newSettings[key] = newValue;
                foundSetting = true;
            }
            else {
                newSettings[key] = oldSettings[key];
            }
        }
        if(!foundSetting) {
            newSettings[setting] = newValue;
        }
        console.log(newSettings);
    }
    else {
        newSettings[setting] = newValue;
    }
    try {
        fs.writeFileSync(hueSettingsFile,JSON.stringify(newSettings));
        return true;
    }
    catch(error) {
        console.log(error);
        return false;
        // return undefined;
    }
}

module.exports.setHueSettings = setHueSettings;
