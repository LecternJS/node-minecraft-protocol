const net = require('net');
const dns = require('dns');

const debug = require('debug')('minecraft-protocol');

class TCP {

	constructor(client) {
		this.client = client;

		this.connect();
	}

	connect() {
		if (this.client.options.stream) {
			this.client.setSocket(this.client.options.stream);
			return this.client.emit('connect');
		}

		if (this.client.options.port === 25565 && net.isIP(this.client.options.host) === 0 && this.client.options.host !== 'localhost') {
			dns.resolveSrv(`_minecraft._tcp.${this.options.host}`, (err, hostnames) => {
				if (err) debug(err);

				if (hostnames && hostnames.length > 0) {
					this.options.host = hostnames[0].name;
					this.options.port = hostnames[0].port;
				}
			});
		}
		return this.client.setSocket(net.connect(this.client.options.port, this.client.options.host));
	}

}

module.exports = TCP;
