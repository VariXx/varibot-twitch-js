const { bridgePut } = require('./bridgePut');

async function colorLoop(bridgeIP, username, lightId, toggle) {
    let payload; 
    if(toggle) {
        payload = {
            effect: "colorloop"
        }
    }
    else {
        payload = {
            effect: "none"
        }
    }
    await bridgePut(bridgeIP, username, `lights/${lightId}/state`, payload);
}

module.exports.colorLoop = colorLoop;
