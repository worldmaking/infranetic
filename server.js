
const http = require('http');
const url = require('url');
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const performance = require('perf_hooks').performance;

const express = require('express');
const WebSocket = require('ws');
const PNG = require("pngjs").PNG;
const { vec2, vec3 } = require("gl-matrix");


const mmapfile = require('mmapfile');

const neataptic = require("./client/libs/neataptic.js");
const utils = require("./client/libs/utils.js");
const SpaceHash = require("./client/libs/spacehash.js");
const neato = require("./client/libs/neato.js");
const Agent = require("./client/libs/agent.js");

const project_path = process.cwd();
const server_path = __dirname;
const client_path = path.join(server_path, "client");
console.log("project_path", project_path);
console.log("server_path", server_path);
console.log("client_path", client_path);




// loads an image and turns it into a typedarray and offscreen canvas
class ArrayFromImg {
	constructor(filename) {
		console.log('reading', filename)
		let png = PNG.sync.read(fs.readFileSync(filename));
		this.width = png.width;
		this.height = png.height;
		this.length = this.width * this.height;
		let binary = new Uint8ClampedArray(png.data);
		let data = new Float32Array(this.length*4);
		for (let i=0; i<this.length; i++) {
			data[i*4+0] = (binary[i*4+0] / 255);
			data[i*4+1] = (binary[i*4+1] / 255);
			data[i*4+2] = (binary[i*4+2] / 255);
			data[i*4+3] = (binary[i*4+3] / 255);
		}

		this.data = data;
	}

	setA(x, y, a) {
		if (!this.data) return 0;

		let idx = 4*(Math.floor(x) + Math.floor(y) * this.width);
		this.data[idx+3] = a;
	}

	read(x, y) {
		if (!this.data) return 0;

		let idx = 4*(Math.floor(x) + Math.floor(y) * this.width);
		return this.data[idx+1];
	}

	readInto(x, y, v) {
		if (this.data) {
			let idx = 4*(Math.floor(x) + Math.floor(y) * this.width);
			v[0] = this.data[idx];
			v[1] = this.data[idx+1];
			v[2] = this.data[idx+2];
			v[3] = this.data[idx+3];
		}
		return v;
	}

	readDot(x, y, xyz) {
		if (!this.data) return 0;
		let idx = 4*(Math.floor(x) + Math.floor(y) * this.width);
		return this.data[idx] * xyz[0]
			 + this.data[idx+1] * xyz[1]
			 + this.data[idx+2] * xyz[2];
	}
};

////////////////////////

const NUM_AGENTS = 3000;
const MAX_NEIGHBOURS = 4;
const MAX_LINE_POINTS = NUM_AGENTS*MAX_NEIGHBOURS;

const world = {
	meters: [34976, 23376], // meters
	size: [3231, 2160], // pixels
	aspect: 34976/23376,
	meters_per_pixel: 23376 / 2160, // approximately 10m per pixel
	pixels_per_meter: 2160 / 23376, 
	norm: [1/3231, 1/2160],

	// coordinates of the ACC in this space
	acc: [2382, 1162],

	ways: new ArrayFromImg(path.join(client_path, "img", 'ways2.png')),
	areas: new ArrayFromImg(path.join(client_path, "img", 'areas.png')),
	data: new ArrayFromImg(path.join(client_path, "img", 'data.png')),

	
	agents_near: [],
	agents_meta: [],
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = Math.floor(world.size[1] * world.aspect);
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];

const floatBytes = 4;
const shortBytes = 2;
const agentsBuffer = new ArrayBuffer(
	NUM_AGENTS * floatBytes * 6 + MAX_LINE_POINTS * shortBytes
);
let agent_positions = new Float32Array(agentsBuffer, 0, NUM_AGENTS * 2);
let agent_colors = new Float32Array(agentsBuffer, agent_positions.byteLength, NUM_AGENTS * 4);
let agent_lines = new Uint16Array(agentsBuffer, agent_colors.byteOffset + agent_colors.byteLength, MAX_LINE_POINTS); 

console.log(agentsBuffer.byteLength);
console.log(agent_positions.byteOffset, agent_positions.byteLength);
console.log(agent_colors.byteOffset, agent_colors.byteLength);
console.log(agent_lines.byteOffset, agent_lines.byteLength);

let agents = [];
let space = new SpaceHash({
	width: world.size[0],
	height: world.size[1],
	cellSize: 32
});

world.agents = agents;

let fps = new utils.FPS();
let running = true;
let audioLoopSeconds = 2;
let audioChannels = 8;

// open a file for read/write & map to a Buffer
let buf = mmapfile.openSync("audio/audiostate.bin", audioChannels*NUM_AGENTS*floatBytes, "r+");	
let audiostate = new Float32Array(buf.buffer);
console.log("audiostate.byteLength", audiostate.byteLength); // 8
// console.log(buf.toString('ascii')); // "--------"
// // write to it:
// buf.fill('-');
// console.log(buf.toString('ascii')); // "--------"

function update() {

	let t = fps.t / audioLoopSeconds;

	// if (0) {
	// 	let d = world.data.data;
	// 	if (d) {
	// 		for (let i=3; i<d.length; i+=4) {
	// 			d[i] += 0.03 * (1.-d[i]);
	// 		}
	// 	}
	// }

	if (running) {
		let positions = agent_positions;
		let colors = agent_colors;
		let lines = agent_lines;
		let linecount = 0;

		for (let i=0; i<agents.length; i++) {
			let a = agents[i];
			a.move(world, fps.dt);
			space.updatePoint(a);

			let id = a.id;
			positions[id*2] = a.pos[0];
			positions[id*2+1] = a.pos[1];
			colors[id*4] = a.scent[0];
			colors[id*4+1] = a.scent[1];
			colors[id*4+2] = a.scent[2];
			colors[id*4+3] = a.active;
		}

		for (let i=0; i<agents.length; i++) {
			let a = agents[i];
			let search_radius = 25;
			let near = world.agents_near[a.id];
			space.searchUnique(a, search_radius, MAX_NEIGHBOURS, near);
			if (linecount < MAX_LINE_POINTS) {
				for (let n of near) {
					lines[linecount++] = a.id;
					lines[linecount++] = n.id;
				}
			}
			a.update(world, agents);

			let sidx = a.id * audioChannels;
			audiostate[sidx+0] = a.pos[0] / world.size[0];
			audiostate[sidx+1] = a.pos[1] / world.size[1];
			audiostate[sidx+2] = a.active;
			audiostate[sidx+3] = a.reward;
			audiostate[sidx+4] = a.scent[0];
			audiostate[sidx+5] = a.scent[1];
			audiostate[sidx+6] = a.scent[2];
			audiostate[sidx+7] = a.rate;
		}
		//linesVao.count = Math.min(MAX_LINE_POINTS, linecount);
	}

	fps.tick();
	if (fps.t % 5 < fps.dt) {
		console.log("fps: ", Math.floor(fps.fpsavg))
		//refocus();
		agents.sort((a, b) => b.reward - a.reward);
	}


	//console.log(agentsBuffer.byteLength, utils.pick(agent_lines));
	send_all_clients(agentsBuffer);

	setTimeout(update, 1000/60);
}

for (let i=0; i<NUM_AGENTS; i++) {
	let a = new Agent(i, world);
	world.agents_near[i] = [];
	world.agents_meta[i] = a.meta;
	agents.push(a);
	space.insertPoint(a);
}

////////////////////////

const app = express();
app.use(express.static(client_path))
app.get('/', function(req, res) {
	res.sendFile(path.join(client_path, 'index.html'));
});
//app.get('*', function(req, res) { console.log(req); });
const server = http.createServer(app);
// add a websocket service to the http server:
const wss = new WebSocket.Server({ server });

// send a (string) message to all connected clients:
function send_all_clients(msg) {
	wss.clients.forEach(function each(client) {
		try {
			client.send(msg);
		} catch (e) {
			console.error(e);
		};
	});
}

let sessionId = 0;
let sessions = [];

// whenever a client connects to this websocket:
wss.on('connection', function(ws, req) {

    //console.log("ws", ws)
    //console.log("req", req)

	console.log("server received a connection");
	console.log("server has "+wss.clients.size+" connected clients");
	
	const location = url.parse(req.url, true);
	// You might use location.query.access_token to authenticate or share sessions
	// or req.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
	
	ws.on('error', function (e) {
		if (e.message === "read ECONNRESET") {
			// ignore this, client will still emit close event
		} else {
			console.error("websocket error: ", e.message);
		}
	});

	// what to do if client disconnects?
	ws.on('close', function(connection) {
		console.log("connection closed");
        console.log("server has "+wss.clients.size+" connected clients");
	});
	
	// respond to any messages from the client:
	ws.on('message', function(e) {
		if (e instanceof Buffer) {
			// get an arraybuffer from the message:
			const ab = e.buffer.slice(e.byteOffset,e.byteOffset+e.byteLength);
			console.log("received arraybuffer", ab);
			// as float32s:
			//console.log(new Float32Array(ab));
		} else {
			try {
				handlemessage(JSON.parse(e), ws);
			} catch (e) {
				console.log('bad JSON: ', e);
			}
		}
    });
    
	// // Example sending some greetings:
	// ws.send(JSON.stringify({
	// 	type: "greeting",
	// 	value: "hello",
	// 	date: Date.now()
	// }));
	// // Example sending binary:
	// const array = new Float32Array(5);
	// for (var i = 0; i < array.length; ++i) {
	// 	array[i] = i / 2;
	// }
    // ws.send(array);
    
    //send_all_clients("hi")
});


function handlemessage(msg, session) {
	switch (msg.cmd) {
		case "getagents": {
			try {
				let data = JSON.stringify(world.agents_meta);
				//console.log(data)
				session.send(data)
			} catch (e) {
				console.error(e);
			}
		} break;
		default: console.log("received JSON", msg, typeof msg);
	}
}

server.listen(8080, function() {
	console.log(`server listening`);
	console.log(`main view on http://localhost:${server.address().port}/main.html`);
	console.log(`grid view on http://localhost:${server.address().port}/grid.html`);
});

update();