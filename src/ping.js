/* eslint-disable no-new */
'use strict';

const minecraftData = require('minecraft-data');

const Client = require('./BaseClient');
const Util = require('./Util/Util');
const Constants = require('./Util/Constants');
const TCP = require('./Client/TCP');

class Ping {

	constructor(options = {}) {
		if (!Util.isObject(options)) throw new TypeError('Ping constructur requires an object!');
		this.options = Util.mergeDefault(Constants.PING, options);

		const { version } = minecraftData(options.version);
		if (!version) throw new Error(`Unsupported Protocol Version: ${options.version}`);
		this.version = version;

		this.closeTimer = null;

		this.ping();
	}

	ping() {
		this.client = new Client(false, this.version.minecraftVersion);

		this.client.on('server_info', this.serverInfo);
		this.client.on('error', this.error);
		this.client.on('state', this.state);
		this.client.on('connect', this.connect);

		this.closeTimer = setTimeout(() => {
			this.client.end();
			console.error(`[Ping] Ping request timed out. Recieved no response in the last ${this.options.closeTimeout}ms.`);
		}, this.options.closeTimeout);

		// Proceed with connecting anyways...
		new TCP(this);
	}

	serverInfo(packet) {
		packet = JSON.parse(packet.response);
		const start = Date.now();

		this.timeout = setTimeout(() => {
			if (this.closeTimer) clearTimeout(this.closeTimer);
			this.client.end();
			return packet;
		}, this.options.noPongTimeout);

		this.client.once('ping', () => {
			packet.latency = Date.now() - start;
			if (this.closeTimer) clearTimeout(this.closeTimer);
			if (this.timeout) clearTimeout(this.timeout);
			this.client.end();
			return packet;
		});

		this.client.write('ping', { time: [0, 0] });
	}

	// eslint-disable-next-line consistent-return
	state(state) {
		if (state === Constants.STATES.STATUS) return this.client.write('ping_start', {});
	}

	error(error) {
		if (this.closeTimer) clearTimeout(this.closeTimer);
		return error;
	}

	connect() {
		this.client.write('set_protocol', {
			protocolVersion: this.options.protocolVersion,
			serverHost: this.options.host,
			serverPort: this.options.port,
			nextState: 1
		});
		return this.client.state === Constants.STATES.STATUS;
	}

}

module.exports = Ping;
