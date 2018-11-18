
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

const numagents = 3000;
let agents = [];
let space = new SpaceHash({
	width: world.size[0],
	height: world.size[1],
	cellSize: 100
});

let fps = new FPS();
let running = true;

let canvas = document.getElementById("canvas");
canvas.width = world.size[0];
canvas.height = world.size[1]; 
let offscreen = new OffscreenCanvas(world.size[0], world.size[1]);
let glcanvas = document.createElement("canvas");
let gl = glcanvas.getContext("webgl2", {
	antialias: true,
	alpha: true
});
if (!gl) {
	alert("Browser error: unable to acquire webgl2 context");
}
const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
	alert("Browser error: need EXT_color_buffer_float");
}
gl.canvas.width = canvas.width;
gl.canvas.height = canvas.height;


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

let fbo = createFBO(gl, gl.canvas.width, gl.canvas.height, true);

let program_showtex = makeProgramFromCode(gl,
`#version 300 es
in vec4 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
	gl_Position = a_position;
	v_texCoord = a_texCoord;
}
`, 
`#version 300 es
precision mediump float;
uniform sampler2D u_image;
uniform vec4 u_color;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
	outColor = texture(u_image, v_texCoord).rgba * u_color;
}
`);
gl.useProgram(program_showtex);
gl.uniform1i(gl.getUniformLocation(program_showtex, "u_image"), 0);
gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 0.02);

let glQuad = createQuadVao(gl, program_showtex);

let program_agents = makeProgramFromCode(gl,
`#version 300 es
in vec2 a_position;
uniform mat3 u_matrix;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position.xy, 1)).xy, 0, 1);
	//gl_Position = vec4(a_position.xy/vec2(2000, 2000), 0, 1);
	gl_PointSize = 1.0;
}
`, 
`#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
	outColor = vec4(0, 0.5, 1, 1);
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
		gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.
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
function refocus() {
	focus = pick(agents).pos;
	zoom = (zoom == 1) ? 2 + Math.floor(Math.random() * 8) : 1;
}

function update() {
	requestAnimationFrame(update);

	if (running) {
		for (let a of agents) {
			let search_radius = 25;
			a.near = space.searchUnique(a.pos, search_radius, 4);
			a.update(world);
		}
		let positions = agentsVao.positions;
		for (let i=0; i<agents.length; i++) {
			let a = agents[i];
			a.move(world);
			space.updatePoint(a);
			positions[i*2] = a.pos[0];
			positions[i*2+1] = a.pos[1];
		}
		
		fbo.begin();
		{
			gl.clear(gl.COLOR_BUFFER_BIT);

			// feedback:

			//gl.activeTexture(gl.TEXTURE0 + 1);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.activeTexture(gl.TEXTURE0 + 0);
			gl.bindTexture(gl.TEXTURE_2D, fbo.front.id);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.useProgram(program_showtex);
			gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 0.999);
			glQuad.bind().draw();

			// new data:
			
			let viewmat = [
				2/gl.canvas.width, 0, 0,
				0, -2/gl.canvas.height, 0,
				-1, 1, 1
			];
			gl.useProgram(program_agents);
			gl.uniformMatrix3fv(gl.getUniformLocation(program_agents, "u_matrix"), false, viewmat);
			agentsVao.bind().submit(agentsVao.positions).draw();
		}
		fbo.end(); 
	}

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	//gl.clearColor(1, 1, 1, 1); // background colour
  	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.front.id);
	gl.useProgram(program_showtex);
	gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 1);
	glQuad.bind().draw();
	
	// fbo.bind().readPixels(); // SLOW!!!

	

	let ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.save();
	{
		ctx.translate(focus[0], focus[1])
		ctx.scale(zoom, zoom);
		ctx.translate(-focus[0], -focus[1])
		
		//ctx.drawImage(world.grass.canvas, 0, 0);
		ctx.drawImage(gl.canvas, 0, 0);
		
	}
	ctx.restore();

	fps.tick();
	document.getElementById("fps").textContent = Math.floor(fps.fpsavg);
	if (fps.t % 5 < fps.dt) refocus();
}


window.addEventListener("resize", resize, false);

canvas.addEventListener("pointermove", function(event) {

}, false);


window.addEventListener("keyup", function(event) {
	//print(event.key);
	if (event.key == " ") {
		running = !running;
	} else if (event.key == "z") {
		refocus();
	} else if (event.key == "s") {
		// `frame${frame.toString().padStart(5, '0')}.png`;
		saveCanvasToPNG(canvas, "result");
	}
}, false);

/////////////////////////////////////////////////////////////

agentsVao.create(gl, program_agents);

for (let i=0; i<numagents; i++) {
	agents.push(new Agent(i, world));
	space.insertPoint(agents[i]);
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