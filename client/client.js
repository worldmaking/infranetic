
const world = {
	meters: [34976, 23376], // meters
	size: [3231, 2160], // pixels
	aspect: 34976/23376,
	meters_per_pixel: 23376 / 2160, // approximately 10m per pixel
	pixels_per_meter: 2160 / 23376, 
	norm: [1/3231, 1/2160],

	grass: new ArrayFromImg('img/highway.png'),
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = world.size[1] * world.aspect;
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];

const numagents = 10000;
let agents = [];

let fps = new FPS();
let running = true;

let canvas = document.getElementById("canvas");
canvas.width = world.size[0];
canvas.height = world.size[1]; 
let offscreen = new OffscreenCanvas(world.size[0], world.size[1]);
let glcanvas = document.createElement("canvas");
glcanvas.width = canvas.width;
glcanvas.height = canvas.height;
//new OffscreenCanvas(world.size[0], world.size[1]);
let gl = glcanvas.getContext("webgl2");
if (!gl) {
  console.error("unable to acquire webgl2 context");
}

function resize() {
	let window_aspect = window.innerWidth/window.innerHeight;
	let canvas_aspect = world.aspect/window_aspect;
	if (canvas_aspect > 1) {
		canvas.style.width = '100%';
		canvas.style.height = Math.floor(100 / canvas_aspect) + "%";
	} else {
		canvas.style.width = Math.floor(100 * canvas_aspect) + "%";
		canvas.style.height = '100%';
	}
}


let program_agents = makeProgramFromCode(gl,
`#version 300 es
in vec2 a_position;
uniform mat3 u_matrix;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position / vec2(3000, 2000), 1)).xy, 0, 1);
	gl_PointSize = 3.0;
}
`, 
`#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
	outColor = vec4(0.5, 0, 0.5, 1);
}
`);

let agentsVao = {
	id: gl.createVertexArray(),
	positions: new Float32Array(numagents * 2),
	positionBuffer: gl.createBuffer(),

	submit(data) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
		//gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.
		return this;
	},

	create(gl, program) {
		this.bind();

		this.submit(this.positions);

		// look up in the shader program where the vertex attributes need to go.
		let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
		// Turn on the attribute
		gl.enableVertexAttribArray(positionAttributeLocation);
		// Tell the attribute which buffer to use
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
		let size = 2;          // 2 components per iteration
		let type = gl.FLOAT;   // the data is 32bit floats
		let normalize = false; // don't normalize the data
		let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
		let offset = 0;        // start at the beginning of the buffer
		gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
		// done with buffer:
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		this.unbind();
		return this;
	},

	bind() {
		gl.bindVertexArray(this.id);
		return this;
	},
	
	unbind() {
		gl.bindVertexArray(this.id, null);
		return this;
	},

	//bind first
	draw() {
		// draw
		let primitiveType = gl.POINTS;
		let offset = 0;
		let count = this.positions.length/2;
		gl.drawArrays(primitiveType, offset, count);
		return this;
	},
}
	

let focus = [world.size[0]*1/3, world.size[1]*1/3];
let zoom = 1;

function update() {
	requestAnimationFrame(update);

	if (running) {
		for (let a of agents) {
			a.update(world);
		}
		let positions = agentsVao.positions;
		for (let i=0; i<agents.length; i++) {
			let a = agents[i];
			a.move(world);

			positions[i*2] = a.pos[0];
			positions[i*2+1] = a.pos[1];
		}
		//agentsVao
	}

	

	let gl = glcanvas.getContext("webgl2");
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  	gl.clearColor(1, 1, 1, 1); // background colour
	gl.clear(gl.COLOR_BUFFER_BIT);

	let viewmat = [
      2, 0, 0,
      0, 2, 0,
      -1, -1, 1
    ];
	gl.useProgram(program_agents);
	gl.uniformMatrix3fv(gl.getUniformLocation(program_agents, "u_matrix"), false, viewmat);
	agentsVao.bind().submit(agentsVao.positions).draw();

	let ctx = offscreen.getContext("2d");
	ctx.fillStyle = "hsl(0, 0%, 100%, 100%)"
	ctx.fillRect(0, 0, offscreen.width, offscreen.height);

	if (1) {
		ctx.lineWidth = 1;

		ctx.fillStyle = "purple"
		let size = 2;
		for ( let a of agents) {
			ctx.fillRect(a.pos[0]-1, a.pos[1]-1, size, size);
			ctx.fillRect(a.pos[0]+a.fwd[0]-1, a.pos[1]+a.fwd[1]-1, size, size);
		}
	}

	ctx = canvas.getContext("2d");
	ctx.save();
	{
		
		ctx.translate(focus[0], focus[1])

		//ctx.translate(-world.size[0]/2, -world.size[1]/2)
		ctx.scale(zoom, zoom);
		//ctx.translate(world.size[0]/2, world.size[1]/2)
		ctx.translate(-focus[0], -focus[1])
		
		//ctx.drawImage(world.grass.canvas, 0, 0);
		ctx.drawImage(gl.canvas, 0, 0);

		
	}
	ctx.restore();

	fps.tick();
	document.getElementById("fps").textContent = Math.floor(fps.fps);
}


window.addEventListener("resize", resize, false);

canvas.addEventListener("pointermove", function(event) {

}, false);

window.addEventListener("keyup", function(event) {
	//print(event.key);
	if (event.key == " ") {
		running = !running;
	} else if (event.key == "z") {
		focus = pick(agents).pos;
		
		zoom = (zoom == 1) ? 2 + Math.floor(Math.random() * 8) : 1;
	} else if (event.key == "s") {
		// `frame${frame.toString().padStart(5, '0')}.png`;
		saveCanvasToPNG(canvas, "result");
	}
}, false);

/////////////////////////////////////////////////////////////

agentsVao.create(gl, program_agents);

for (let i=0; i<numagents; i++) {
	agents.push(new Agent(i, world))
}

let sock = new Socket({
    reload_on_disconnect: true,
	onopen: function() {
		this.send(JSON.stringify({ type: "getdata", date: Date.now() }));
    },
	onmessage: function(msg) { 
        print("received", msg);
    }
});

resize();
update();