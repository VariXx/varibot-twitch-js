const { bridgePut } = require('./bridgePut');

async function setLightState(bridgeIP, username, state, lightId) {
    let payload = {
        on: state
    };
    await bridgePut(bridgeIP, username, `lights/${lightId}/state`, payload);
}

module.exports.setLightState = setLightState;
