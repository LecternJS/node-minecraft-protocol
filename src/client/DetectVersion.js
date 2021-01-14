'use strict';

const Ping = require('../Util/Ping');
const { STATES } = require('../Util/Constants');

const minecraftData = require('minecraft-data');
const debug = require('debug')('minecraft-protocol');

class DetectVersion {

	constructor(client) {
		this.client = client;
	}

	run() {
		// We don't want setProtocol to proceed just yet.
		// We want to wait until connection is allowed for connecting
		this.client.waitConnect = true;
		debug('pinging', this.client.options.host);

        // TODO: use 0xfe ping instead for better compatibility/performance? https://github.com/deathcap/node-minecraft-ping

        
	}

}


module.exports = function (client, options) {
	client.wait_connect = true; // don't let src/client/setProtocol proceed on socket 'connect' until 'connect_allowed'
	debug('pinging', options.host);
	// TODO: use 0xfe ping instead for better compatibility/performance? https://github.com/deathcap/node-minecraft-ping
	ping(options, (err, response) => {
		if (err) { return client.emit('error', err); }
		debug('ping response', response);
		// TODO: could also use ping pre-connect to save description, type, max players, etc.
		const motd = response.description;
		debug('Server description:', motd); // TODO: save

		// Pass server-reported version to protocol handler
		// The version string is interpreted by https://github.com/PrismarineJS/node-minecraft-data
		const brandedMinecraftVersion = response.version.name; // 1.8.9, 1.7.10
		const protocolVersion = response.version.protocol;//    47,      5
		const guessFromName = [brandedMinecraftVersion]
			.concat(brandedMinecraftVersion.match(/((\d+\.)+\d+)/g) || [])
			.map((version) => minecraftData.versionsByMinecraftVersion.pc[version])
			.filter((info) => info)
			.sort((a, b) => b.version - a.version);
		const versions = (minecraftData.postNettyVersionsByProtocolVersion.pc[protocolVersion] || []).concat(guessFromName);
		if (versions.length === 0) {
			client.emit('error', new Error(`unsupported/unknown protocol version: ${protocolVersion}, update minecraft-data`));
		}
		const { minecraftVersion } = versions[0];

		debug(`Server version: ${minecraftVersion}, protocol: ${protocolVersion}`);

		options.version = minecraftVersion;
		options.protocolVersion = protocolVersion;

		// Reinitialize client object with new version TODO: move out of its constructor?
		client.version = minecraftVersion;
		client.state = states.HANDSHAKING;

		// Let other plugins such as Forge/FML (modinfo) respond to the ping response
		if (client.autoVersionHooks) {
			client.autoVersionHooks.forEach((hook) => {
				hook(response, client, options);
			});
		}

		// Finished configuring client object, let connection proceed
		client.emit('connect_allowed');
		client.wait_connect = false;
	});
	return client;
};
