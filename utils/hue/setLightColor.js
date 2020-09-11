const { bridgePut } = require('./bridgePut');

async function setLightColor(bridgeIP, username, color, lightId) {
    let newColor = [0.692,0.308]; // red for error 
    let payload = {
        xy: color
    };
    await bridgePut(bridgeIP, username, `lights/${lightId}/state`, payload);
}

module.exports.setLightColor = setLightColor;
