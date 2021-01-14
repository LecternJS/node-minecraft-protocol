const { EventEmitter } = require('events');
const Client = require('./BaseClient');
const Constants = require('./Util/Util');
const net = require('net');
const { versions } = require('minecraft-data');

class BaseServer extends EventEmitter {

	constructor(version, customPackets, hideErrors = false) {
		super();

		this.version = version;
		this.socketServer = null;
		this.cipher = null;
		this.decipher = null;
		this.clients = {};
		this.customPackets = {};
		this.hideErrors = hideErrors;
	}

	close() {
		Object.keys(this.clients).forEach((id) => {
			const client = this.clients[id];
			client.end('ServerShutdown');
		});
		this.socketServer.close();
	}

}
