
let canvas = document.getElementById("canvas");
canvas.width = 1920;
canvas.height = 1080; 

let glcanvas = document.createElement("canvas");
//document.getElementById("glcanvas");
//let glcanvas = document.createElement("canvas");

let gl = glcanvas.getContext("webgl2", {
	antialias: false,
	alpha: false
});
if (!gl) {
	alert("Browser error: unable to acquire webgl2 context");
}
const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
	alert("Browser error: need EXT_color_buffer_float");
}


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
	areas: new ArrayFromImg('img/areas.png'),

	idx(pos) {
		return Math.floor(pos[1])*this.size[0] + Math.floor(pos[0]);
	},
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = Math.floor(world.size[1] * world.aspect);
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];


const NUM_AGENTS = 3000;
const MAX_NEIGHBOURS = 4;
const MAX_LINE_POINTS = NUM_AGENTS;
let agents = [];


// 16:9, closest to 8:4 or 8:5
const grid = {
	cols: 11, 
	rows: 5,
	cellcount: 144,
	colsize: 170,
	rowsize: 205,

	cells: [],
};
grid.cellcount = grid.cols * grid.rows;
for (let i=0; i<grid.cellcount; i++) {
	grid.cells[i] = {
		id: Math.floor(Math.random() * NUM_AGENTS),
		zoom: Math.random(),
		pos: [0, 0],
	};
}

let fps = new utils.FPS();
let running = true;

let showlines = true;
let showmap = false;
let showgrid = false;

gl.canvas.width = world.size[0];
gl.canvas.height = world.size[1];


world.data = createPixelTexture(gl, world.size[0], world.size[1], true).load("img/data.png");

// let dataTex = createPixelTexture(gl, world.size[0], world.size[1]).allocate(); //loadTexture(gl, 'img/data.png', true);
// world.data = new ArrayFromImg('img/data.png', function() {
// 	// console.log(this);
// 	// console.log(this.imgdata.data.length, dataTex.data.length);
// 	// console.log(dataTex.data)
// 	let binary = new Uint8Array(this.imgdata.data.buffer);
// 	// copy (with flip):

// 	for (let y=0; y<this.height; y++) {
// 		let y1 = this.height - y - 1;
// 		for (let x=0; x<this.width; x++) {
// 			let x0 = (x + y*this.width)*4;
// 			let x1 = (x + y1*this.width)*4;
// 			for (let c=0; c<4; c++) {
// 				dataTex.data[x0+c] = binary[x1+c];
// 			}
// 		}
// 	}
// 	//console.log(dataTex.data)
// 	dataTex.bind().submit();

// 	world.dataTexData = dataTex.data;
// })

function resize() {
	let w = window.innerWidth, h = window.innerHeight;
	console.log(w, h);
	let window_aspect = w/h;
	let canvas_aspect = world.aspect/window_aspect;
	//canvas.width = w;
	//canvas.height = h;
	//canvas.style.width = w + "px";
	//canvas.style.height = h + "px";
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
	outColor = texture(u_image, v_texCoord).rgba;
	float avg = (outColor.r + outColor.g + outColor.b) / 3.;
	outColor.rgb = mix(outColor.rgb, vec3(avg), 0.1);
	outColor *= u_color.a;
}
`)
gl.useProgram(program_showtex);
gl.uniform1i(gl.getUniformLocation(program_showtex, "u_image"), 0);
gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 0.02);

let slab_composite_invert = 1;
let slab_composite = createSlab(gl, `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_data;
uniform vec4 u_color;
uniform float u_invert;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
	vec2 uv = v_texCoord.xy;
	//uv = 0.5 + uv*0.1;
	vec2 uv1 = vec2(uv.x, 1.-uv.y);
	vec4 data = texture(u_data, uv1);
	float ways = data.r;
	float altitude = data.g;
	float areas = data.b;
	float marks = data.a;

	vec2 texSize = vec2(3231, 2160);
	vec2 onePixel = vec2(1.0, 1.0) / texSize;

	vec4 image = texture(u_image, uv);
	
	vec4 image1 = texture(u_image, uv+vec2(onePixel.x, 0.));
	vec4 image2 = texture(u_image, uv+vec2(0., onePixel.y));
	vec4 image3 = texture(u_image, uv+vec2(onePixel.x, onePixel.y));

	image = (image + image1 + image2 + image3) / 4.;

	outColor = image;// * u_color;
	//outColor.rgb += vec3(ways) * 0.15;
	//outColor.r += float(marks) * 0.5;

	//outColor.rgb = 1.-outColor.rgb;

	float gamma = 1.5;
    outColor.rgb = pow(outColor.rgb, vec3(1.0/gamma));

	outColor.rgb = mix(outColor.rgb, 1.-outColor.rgb, u_invert);

}
`,{
	"u_image": [0],
	"u_data": [1],
	"u_color": [1, 1, 1, 1],
	"u_invert": [slab_composite_invert],
})



let glQuad = createQuadVao(gl, program_showtex);


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

let program_agents = makeProgramFromCode(gl,
`#version 300 es
in vec2 a_position;
in vec4 a_color;
out vec4 color;
uniform mat3 u_matrix;
uniform float u_pointsize;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position.xy, 1)).xy, 0, 1);
	float a = 0.3 + a_color.a*0.7;
	gl_PointSize = u_pointsize * a;
	color = a_color;
}
`, 
`#version 300 es
precision mediump float;
in vec4 color;
out vec4 outColor;
void main() {
	outColor = color; //vec4(0, 0.5, 1, 1);
	outColor.rgb *= outColor.a;
	vec3 c = color.rgb;
	float a = 0.3 + color.a*color.a;
	outColor = vec4(c * a, 1);
}
`);
gl.useProgram(program_agents);
gl.uniform1f(gl.getUniformLocation(program_agents, "u_pointsize"), 2);

let linesVao = {
	id: gl.createVertexArray(),
	positionBuffer: agentsVao.positionBuffer,
	colorBuffer: agentsVao.colorBuffer,

	indices: new Uint16Array(MAX_LINE_POINTS),
	indexBuffer: gl.createBuffer(),
	count: MAX_LINE_POINTS,


	submit() {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // done.
		return this;
	},

	create(gl, program) {
		this.bind();
		this.submit();
		{
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
		}
		{	
			let attr = gl.getAttribLocation(program, "a_color");
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
in vec4 a_color;
uniform mat3 u_matrix;
out vec4 color;
void main() {
	gl_Position = vec4((u_matrix * vec3(a_position.xy, 1)).xy, 0, 1);
	color = a_color;
}
`, 
`#version 300 es
precision mediump float;
in vec4 color;
out vec4 outColor;
void main() {
	vec3 c = mix(color.rgb, vec3(1.), 0.05);
	outColor = vec4(c, color.a * 0.1);
}
`);
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

let dirty = false;

function update() {
	requestAnimationFrame(update);

	if (!dirty) return;
	
	dirty = false;

	let t = fps.t;

	if (running) {

		fbo.begin().clear();
		{
			gl.lineWidth(0.1);
			gl.enable(gl.BLEND);
			//gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			// feedback:

			//gl.activeTexture(gl.TEXTURE0 + 1);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.activeTexture(gl.TEXTURE0 + 0);
			gl.bindTexture(gl.TEXTURE_2D, fbo.front.id);
			//gl.bindTexture(gl.TEXTURE_2D, chan1.id);
			gl.useProgram(program_showtex);
			let a = 0.9995; //0.995;
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

			if (showlines) {
				gl.useProgram(program_lines);
				gl.uniformMatrix3fv(gl.getUniformLocation(program_lines, "u_matrix"), false, viewmat);
				linesVao.bind().submit().draw();
			}
			
		}
		fbo.end(); 
	}

	// now draw fbo to glcanvs, for use by ctx
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 1); // background colour
  	gl.clear(gl.COLOR_BUFFER_BIT);



	fbo.front.bind(0);
	world.data.bind(1); //.submit();
	slab_composite.use();
	slab_composite.uniform("u_invert", slab_composite_invert);
	slab_composite.draw();

	// fbo.bind().readPixels(); // SLOW!!!

	let ctx = canvas.getContext("2d", { antialias: false, alpha: false});
	ctx.fillStyle = slab_composite_invert ? "black" : "white";
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	let smooth = true;
	ctx.mozImageSmoothingEnabled = smooth;
	ctx.webkitImageSmoothingEnabled = smooth;
	ctx.imageSmoothingQuality = "high";
	ctx.msImageSmoothingEnabled = smooth;
	ctx.imageSmoothingEnabled = smooth;

	let mapbox = Math.floor(grid.colsize*3/4);
	
	let fontsize = 12;
	ctx.font = fontsize + 'px monospace';
	ctx.textBaseline = "top"
	ctx.textAlign = "left"
	ctx.fillStyle = slab_composite_invert ? "#888" : "#444";
	let i=0;
	for (let y=0; y<grid.rows; y++) {
		for (let x=0; x<grid.cols; x++, i++) {
			let cell = grid.cells[i];

			cell.zoom -= fps.dt * 0.01;

			

			let id = cell.id;
			let a = agents[id];
			if (a) {

				if (a.reward < 0.15) continue;

				if (cell.zoom <= 0.1) {
					cell.id = Math.floor(Math.random()*NUM_AGENTS);
					cell.zoom = 2;
				} 

				

				vec2.lerp(cell.pos, cell.pos, [agentsVao.positions[id*2],agentsVao.positions[id*2+1]], 0.05);
				//cell.zoom += 0.002*(Math.pow(a.reward,4) - cell.zoom);

				let ax = cell.pos[0];
				let ay = cell.pos[1];

				let glw = mapbox*cell.zoom; //grid.zooms[i];
				let glw2 = glw*2;

				let px = grid.colsize*(x + 1/4);
				let py = grid.rowsize*(y + 1/4);

				ctx.fillStyle = slab_composite_invert ? "white" : "black";
				ctx.fillRect(px, py, mapbox, mapbox);
				ctx.drawImage(gl.canvas, 
					ax-glw, ay-glw, glw2, glw2,
					px, py, mapbox, mapbox);

			
				ctx.fillText(a.birthdata,  px, py+mapbox + fontsize*0);
				
				let stats = `${Math.floor(ax)} ${Math.floor(ay)} ${a.reward.toFixed(3)}`;
				ctx.fillText(stats, px, py+mapbox + fontsize*1);
			}

		}
	}

	fps.tick();
	//document.getElementById("fps").textContent = Math.floor(fps.fpsavg);
	//
	if (fps.t % 1 < fps.dt) {
		console.log("fps: ", Math.floor(fps.fpsavg))
		//refocus();
		//agents.sort((a, b) => b.reward - a.reward);

		
		
	}
	sock.send({"cmd":"getagents"});
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
		agents.sort((a, b) => b.reward - a.reward);
	} else if (event.key == "l") {
		showlines = !showlines;
	} else if (event.key == "i") {
		slab_composite_invert = (slab_composite_invert) ? 0 : 1;
	} else if (event.key == "s") {
		// `frame${frame.toString().padStart(5, '0')}.png`;
		saveCanvasToPNG(canvas, "result");
	} else if (event.key == 'f') {
		if (screenfull.enabled) {
			screenfull.toggle(document.body);
			resize();
		}
	}
}, false);

/////////////////////////////////////////////////////////////

agentsVao.create(gl, program_agents);

let sock
try {
	if (window.location.hostname == "localhost") {
		sock = new Socket({
			reload_on_disconnect: true,
			onopen: function() {
				
			},
			onmessage: function(msg) { 
				agents = msg;
				//console.log("received agents", agents.length)
				//console.log(agents[0])
			},
			onbuffer(data, byteLength) {
				//console.log("received arraybuffer of " + byteLength + " bytes");
				//console.log(agentsVao.positions.byteLength + agentsVao.colors.byteLength + linesVao.indices.byteLength);
				//console.log(data)
				// copy to agentsVao:
				//let fa = new Float32Array(data);
				//agentsVao.positions = fa.subarray(0, NUM_AGENTS*2);
				//agentsVao.positions.set(fa);

				agentsVao.positions = new Float32Array(data, 0, NUM_AGENTS*2);
				agentsVao.colors = new Float32Array(data, agentsVao.positions.byteLength, NUM_AGENTS*4);
				linesVao.indices = new Uint16Array(data, agentsVao.colors.byteLength + agentsVao.colors.byteOffset, MAX_LINE_POINTS);

				dirty = true;

				//console.log(utils.pick(linesVao.indices));
			},
		});
	}
} catch (e) {
	console.error(e);
}
resize();
update();