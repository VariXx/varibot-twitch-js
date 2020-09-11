const { bridgePut } = require('./bridgePut');

async function setLightColor(bridgeIP, username, color, lightId) {
    let newColor = [0.692,0.308]; // red for error 
    for(let key in colors) { 
        if(key.toLowerCase() == color) {
            newColor = colors[key];
            break;
        }
    }
    let payload = {
        xy: newColor
    };
    await bridgePut(bridgeIP, username, `lights/${lightId}/state`, payload);
}

module.exports.setLightColor = setLightColor;
