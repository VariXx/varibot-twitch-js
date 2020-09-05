const { bridgeGet } = require('./bridgeGet');

async function getLight(bridgeIP, username, lightId) {
    let result = await bridgeGet(bridgeIP, username, `lights/${lightId}`);
    return result;
}

module.exports.getLight = getLight;
