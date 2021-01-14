const { ProtoDef } = require('protodef');
const debug = require('debug')('minecraft-protocol');
const minecraftData = require('minecraft-data');

const Minecraft = require('../Util/DataTypes/Minecraft');

class PluginChannels {

	constructor(client) {
		this.client = client;
		this.channels = [];
		this.proto = new ProtoDef();

		const MinecraftData = minecraftData(this.client.options.version);

		this.proto.addTypes(MinecraftData.protocol.types);
		this.proto.addTypes(Minecraft);
		this.proto.addTypes([readDumbArr, writeDumbArr, sizeOfDumbArr]);

		this.client.registerChannel = this.registerChannel;
		this.client.unregisterChannel = this.unregisterChannel;
		this.client.writeChannel = this.writeChannel;

		// 1.13-pre3 (385) added Added Login Plugin Message (https://wiki.vg/Protocol_History#1.13-pre3)
		if (this.options.protocolVersion >= 385) {
			this.client.on('login_plugin_request', this.loginPluginRequest);
		}
	}

	registerChannel(name, parser, custom) {
		if (custom) this.client.writeChannel('REGISTER', name);
		if (parser) this.proto.addType(name, parser);
		this.channels.push(name);
		if (this.channels.length === 1) this.channels.on('custom_payload', this.customPayload);
	}

	unregisterChannel(channel, custom) {
		if (custom) this.client.writeChannel('UNREGISTER', channel);
		const index = this.channels.find((name) => name === channel);
		if (!index) return;
		this.proto.types[channel] = undefined;
		this.channels.splice(index, 1);
		if (this.channels.length === 0) this.client.removeListener('custom_payload', this.customPayload);
	}

	customPayload(packet) {
		const channel = this.channels.find((chnl) => chnl === packet.channel);
		if (!channel) return;
		if (this.proto.types[channel]) packet.data = this.proto.parsePacketBuffer(channel, packet.data);
		debug(`read custom payload ${channel} ${packet.data}`);
		this.client.emit('channel', packet.data);
	}

	loginPluginRequest(packet) {
		// write that login plugin request is not understood, just like the Notchian client
		this.client.write('login_plugin_response', { messageId: packet.messageId });
	}

	writeChannel(channel, params) {
		debug(`write custom payload ${channel} ${params}`);
		this.client.write('custom_payload', { channel, data: this.proto.createPacketBuffer(channel, params) });
	}

}

module.exports = PluginChannels;


function readDumbArr(buf, offset) {
	const ret = {
		value: [],
		size: 0
	};
	let results;
	while (offset < buf.length) {
		if (buf.indexOf(0x0, offset) === -1) {
			results = this.read(buf, offset, 'restBuffer', {});
		} else {
			results = this.read(buf, offset, 'cstring', {});
		}
		ret.size += results.size;
		ret.value.push(results.value.toString());
		offset += results.size;
	}
	return ret;
}

function writeDumbArr(value, buf, offset) {
	// eslint-disable-next-line no-warning-comments
	// TODO: Remove trailing \0 (also fix this todo)
	// eslint-disable-next-line no-return-assign
	value.forEach((val) => offset += this.write(val, buf, offset, 'cstring', {}));
	return offset;
}

function sizeOfDumbArr(value) {
	return value.reduce((acc, val) => acc + this.sizeOf(val, 'cstring', {}), 0);
}
