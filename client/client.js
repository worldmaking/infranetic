
const world = {
	meters: [34976, 23376], // meters
	size: [3231, 2160], // pixels
	aspect: 34976/23376,
	meters_per_pixel: 23376 / 2160, // approximately 10m per pixel
	pixels_per_meter: 2160 / 23376, 
	norm: [1/3231, 1/2160],

	// coordinates of the ACC in this space
	acc: [2382, 1162],

	ways: new ArrayFromImg('img/ways2.png'),
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = world.size[1] * world.aspect;
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];

const NUM_AGENTS = 5000;
const MAX_NUM_LINES = NUM_AGENTS*4;
let agents = [];
let space = new SpaceHash({
	width: world.size[0],
	height: world.size[1],
	cellSize: 25
});

let fps = new FPS();
let running = true;

let showmap = false;
let showgrid = false;

let canvas = document.getElementById("canvas");
canvas.width = world.size[0];
canvas.height = world.size[1]; 
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
in vec4 a_color;
out vec4 color;
uniform mat3 u_matrix;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position.xy, 1)).xy, 0, 1);
	//gl_Position = vec4(a_position.xy/vec2(2000, 2000), 0, 1);
	gl_PointSize = 2.0;
	color = a_color;
}
`, 
`#version 300 es
precision mediump float;
in vec4 color;
out vec4 outColor;
void main() {
	outColor = color; //vec4(0, 0.5, 1, 1);
}
`);

let agentsVao = {
	id: gl.createVertexArray(),
	positions: new Float32Array(NUM_AGENTS * 2),
	positionBuffer: gl.createBuffer(),

	colors: new Float32Array(NUM_AGENTS * 4),
	colorBuffer: gl.createBuffer(),

	submit() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.
		return this;
	},

	create(gl, program) {
		this.bind();

		for (let i=0; i<this.colors.length; i+=4) {
			this.colors[i+0] = 1;
			this.colors[i+1] = 0;
			this.colors[i+2] = 0;
			this.colors[i+3] = 1;
		}

		this.submit();

		{	
			let attr = gl.getAttribLocation(program, "a_position");
			console.log(attr)
			// Turn on the attribute
			gl.enableVertexAttribArray(attr);
			// Tell the attribute which buffer to use
			gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
			// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
			let size = 2;          // 2 components per iteration
			let type = gl.FLOAT;   // the data is 32bit floats
			let normalize = false; // don't normalize the data
			let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
			let offset = 0;        // start at the beginning of the buffer
			gl.vertexAttribPointer(attr, size, type, normalize, stride, offset);
			// done with buffer:
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}
		{	
			let attr = gl.getAttribLocation(program, "a_color");
			console.log(attr)
			// Turn on the attribute
			gl.enableVertexAttribArray(attr);
			// Tell the attribute which buffer to use
			gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
			// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
			let size = 4;          // 2 components per iteration
			let type = gl.FLOAT;   // the data is 32bit floats
			let normalize = false; // don't normalize the data
			let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
			let offset = 0;        // start at the beginning of the buffer
			gl.vertexAttribPointer(attr, size, type, normalize, stride, offset);
			// done with buffer:
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}
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


let linesVao = {
	id: gl.createVertexArray(),
	positionBuffer: agentsVao.positionBuffer,

	//positions: new Float32Array(NUM_AGENTS * 2),
	//positionBuffer: gl.createBuffer(),

	indices: new Uint16Array(MAX_NUM_LINES),
	indexBuffer: gl.createBuffer(),

	count: 0,


	submit() {
		// gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		// gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
		// gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // done.
		return this;
	},

	create(gl, program) {
		this.bind();
		this.submit();

		// look up in the shader program where the vertex attributes need to go.
		let attr = gl.getAttribLocation(program, "a_position");
		// Turn on the attribute
		gl.enableVertexAttribArray(attr);
		// Tell the attribute which buffer to use
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
		let size = 2;          // 2 components per iteration
		let type = gl.FLOAT;   // the data is 32bit floats
		let normalize = false; // don't normalize the data
		let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
		let offset = 0;        // start at the beginning of the buffer
		gl.vertexAttribPointer(attr, size, type, normalize, stride, offset);
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
		let primitiveType = gl.LINES;
		let offset = 0;

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.drawElements(gl.LINES, this.count, gl.UNSIGNED_SHORT, 0);
		return this;
	},
};
  
let program_lines = makeProgramFromCode(gl,
`#version 300 es
in vec2 a_position;
uniform mat3 u_matrix;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position.xy, 1)).xy, 0, 1);
	//gl_PointSize = 40.f;
}
`, 
`#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
	outColor = vec4(vec3(0.5), 1) * 0.01;
}
`);


// for (let i=0; i<linesVao.positions.length; i++) {
// 	linesVao.positions[i] = Math.random() * world.size[1];
// }
for (let i=0; i<linesVao.indices.length; i++) {
	linesVao.indices[i] = Math.floor(Math.random() * NUM_AGENTS);
}
linesVao.create(gl, program_lines);


let focus = [world.size[0]*1/3, world.size[1]*1/3];
let zoom = 1;
function refocus() {
	focus = pick(agents).pos;
	zoom = (zoom == 1) ? 2 + Math.floor(Math.random() * 8) : 1;
}

function update() {
	requestAnimationFrame(update);


	
	if (running) {
		let positions = agentsVao.positions;
		let colors = agentsVao.colors;
		let linecount = 0;

		for (let i=0; i<agents.length; i++) {
			let a = agents[i];
			a.move(world, fps.t);
			space.updatePoint(a);
			positions[i*2] = a.pos[0];
			positions[i*2+1] = a.pos[1];

			colors[i*4] = a.scent[0];
			colors[i*4+1] = a.scent[1];
			colors[i*4+2] = a.scent[2];
			colors[i*4+3] = 1;
		}

		for (let a of agents) {
			let search_radius = 25;
			a.near = space.searchUnique(a, search_radius, 8);
			for (let n of a.near) {
				linesVao.indices[linecount++] = a.id;
				linesVao.indices[linecount++] = n.id;
			}
			a.update(world);
		}
		linesVao.count = Math.min(MAX_NUM_LINES, linecount);
		

		fbo.begin();
		{
			
			gl.clearColor(0, 0, 0, 1); // background colour
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.lineWidth(0.1);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

			// feedback:

			//gl.activeTexture(gl.TEXTURE0 + 1);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.activeTexture(gl.TEXTURE0 + 0);
			gl.bindTexture(gl.TEXTURE_2D, fbo.front.id);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.useProgram(program_showtex);
			let a = 0.995;
			gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), a, a, a, a);
			glQuad.bind().draw();

			let viewmat = [
				2/gl.canvas.width, 0, 0,
				0, -2/gl.canvas.height, 0,
				-1, 1, 1
			];
			gl.useProgram(program_agents);
			gl.uniformMatrix3fv(gl.getUniformLocation(program_agents, "u_matrix"), false, viewmat);
			agentsVao.bind().submit(agentsVao.positions).draw();

			
			gl.useProgram(program_lines);
			gl.uniformMatrix3fv(gl.getUniformLocation(program_lines, "u_matrix"), false, viewmat);
			linesVao.bind().submit().draw();

			
		}
		fbo.end(); 
	}

	// now draw fbo to glcanvs, for use by ctx
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(1, 1, 1, 1); // background colour
  	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.front.id);
	gl.useProgram(program_showtex);
	gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 1);
	glQuad.bind().draw();
	
	// fbo.bind().readPixels(); // SLOW!!!

	
	let ctx = canvas.getContext("2d");
	ctx.fillColor = "black";
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.save();
	{
		ctx.translate(focus[0], focus[1])
		ctx.scale(zoom, zoom);
		ctx.translate(-focus[0], -focus[1])
		
		if (showmap) ctx.drawImage(world.ways.canvas, 0, 0);
		ctx.drawImage(gl.canvas, 0, 0);

		if (showgrid) {
			ctx.strokeStyle = "hsl(0,0%,100%,15%)"
			for (let y=0; y<canvas.height; y+=space.cellSize) {
				ctx.beginPath()
				ctx.moveTo(0, y)
				ctx.lineTo(canvas.width, y);
				ctx.stroke()
			}
			for (let x=0; x<canvas.width; x+=space.cellSize) {
				ctx.beginPath()
				ctx.moveTo(x, 0)
				ctx.lineTo(x, canvas.height);
				ctx.stroke()
			}
		}
		
	}
	ctx.restore();

	fps.tick();
	document.getElementById("fps").textContent = Math.floor(fps.fpsavg);
	//if (fps.t % 5 < fps.dt) refocus();
}


window.addEventListener("resize", resize, false);

canvas.addEventListener("mousedown", function(event) {
	//console.log(event);
	let world_coords = [world.size[0] * event.clientX / canvas.clientWidth, world.size[1] * event.clientY / canvas.clientHeight];
	console.log(world_coords);
}, false);


window.addEventListener("keyup", function(event) {
	//print(event.key);
	if (event.key == " ") {
		running = !running;
	} else if (event.key == "z") {
		refocus();
	} else if (event.key == "m") {
		showmap = !showmap;
	} else if (event.key == "g") {
		showgrid = !showgrid;
	} else if (event.key == "s") {
		// `frame${frame.toString().padStart(5, '0')}.png`;
		saveCanvasToPNG(canvas, "result");
	} else if (event.key == 'f') {
		if (screenfull.enabled) {
			screenfull.toggle(canvas);
		}
	}
}, false);

/////////////////////////////////////////////////////////////

agentsVao.create(gl, program_agents);

for (let i=0; i<NUM_AGENTS; i++) {
	agents.push(new Agent(i, world));
	space.insertPoint(agents[i]);
}

let sock
try {
	sock = new Socket({
		reload_on_disconnect: true,
		onopen: function() {
			this.send(JSON.stringify({ type: "getdata", date: Date.now() }));
		},
		onmessage: function(msg) { 
			print("received", msg);
		}
	});
} catch (e) {
	console.error(e);
}
resize();
update();