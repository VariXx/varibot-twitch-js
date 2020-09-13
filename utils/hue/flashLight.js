const { sleep } = require('../sleep');
const { setLightState } = require('./setLightState');

async function flashLight(bridgeIP, bridgeUsername, lightId, flashes) {
    for(let x = 0; x < flashes; x++) {
        await setLightState(bridgeIP, bridgeUsername, false, lightId);
        await sleep(800);
        await setLightState(bridgeIP, bridgeUsername, true, lightId);
        await sleep(800);        
    }
};

module.exports.flashLight = flashLight;
