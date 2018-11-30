let canvas = document.getElementById("canvas");
//let glcanvas = document.createElement("canvas");

let gl = canvas.getContext("webgl2", {
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

	//ways: new ArrayFromImg('img/ways2.png'),
	//areas: new ArrayFromImg('img/areas.png'),

	idx(pos) {
		return Math.floor(pos[1])*this.size[0] + Math.floor(pos[0]);
	},
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = Math.floor(world.size[1] * world.aspect);
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];

const screen = {
	width: 1920,
	height: 1080,
	//width: world.size[0], //1920, 
	//height: world.size[1] //1080
}

const NUM_AGENTS = 3000;
const MAX_NEIGHBOURS = 4;
const MAX_LINE_POINTS = NUM_AGENTS;
let agents = [];

let fps = new utils.FPS();
let running = true;

let showlines = true;
let showmap = false;
let sharpness = 0.8;
let gamma = 1.5;
let composite_mix = [1, 1, 0.25];

canvas.width = world.size[0];
canvas.height = world.size[1]; 
gl.canvas.width = world.size[0];
gl.canvas.height = world.size[1];
//canvas.style.width = screen.width + "px";
//canvas.style.height = screen.height + "px";

world.data = createPixelTexture(gl, world.size[0], world.size[1], true).load("img/data.png");
world.areas = createPixelTexture(gl, world.size[0], world.size[1], true).load("img/areas.png");
world.ways = createPixelTexture(gl, world.size[0], world.size[1], true).load("img/ways3.png");

world.bg = loadTexture(gl, "img/gwangju.png", true);
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
	console.log("window size", w, h);
	let window_aspect = w/h;
	let canvas_aspect = world.aspect/window_aspect;
}

let fbo = createFBO(gl, gl.canvas.width, gl.canvas.height, true);

let slab_blur = createSlab(gl, `#version 300 es
precision mediump float;
uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform float u_fade;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 outColor;
float normpdf(in float x, in float sigma){
	return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}
void main() {
	vec2 uv = v_texCoord;
	vec4 tex0 = texture(u_tex0, uv);
	vec4 tex1 = texture(u_tex1, uv);

	vec3 c = tex0.rgb;
	//declare stuff
	const int mSize = 11;
	const int kSize = (mSize-1)/2;
	float kernel[mSize];
	vec3 final_colour = vec3(0.0);
	
	//create the 1-D kernel
	float sigma = 7.0;
	float Z = 0.0;
	for (int j = 0; j <= kSize; ++j) {
		kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), sigma);
	}
	//get the normalization factor (as the gaussian has been clamped)
	for (int j = 0; j < mSize; ++j) {
		Z += kernel[j];
	}
	
	//read out the texels
	for (int i=-kSize; i <= kSize; ++i) {
		for (int j=-kSize; j <= kSize; ++j) {
			final_colour += kernel[kSize+j]*kernel[kSize+i]*texture(u_tex0, uv+(vec2(float(i),float(j))) / u_resolution.xy).rgb;
		}
	}

	c = final_colour/(Z*Z);

	outColor.rgb = c*u_fade + tex1.rgb;
	outColor.a = 1.;
}`,{
	u_tex0: [0],
	u_tex1: [1],
	u_fade: [0.7],
	u_resolution: [gl.canvas.width, gl.canvas.height],
});

let syncfbo = createFBO(gl, gl.canvas.width, gl.canvas.height, true);
let slab_sync = createSlab(gl, `#version 300 es
precision highp float;
uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform sampler2D u_tex4;
uniform float u_fade;
in vec2 v_texCoord;
out vec4 outColor;


vec4 blur(sampler2D img, vec2 uv) {
	float r = 2.;
	vec2 s = vec2(r/3231., r/2160.);
	vec4 p = vec4(s.x, s.y, -s.x, -s.y);
	float a = 0.25;
	float b = 0.5;
	return (
		texture(img, uv+(p.xy))
		+ texture(img, uv+(p.zw))
		+ texture(img, uv+(p.zy))
		+ texture(img, uv+(p.xw))
	) * 0.25;
}

void main() {
	vec4 data = texture(u_tex4, v_texCoord);
	float block = (1. - data.r);
	float fade =  mix(u_fade, 0.995, clamp((data.b+data.g)*3.-0.5, 0., 1.));

	//vec4 tex0 = texture(u_tex0, v_texCoord);
	vec4 tex1 = texture(u_tex1, v_texCoord);



	outColor.rgb = blur(u_tex0, v_texCoord).rgb * fade;

	outColor.rgb = max(outColor.rgb, tex1.rgb);

	// block by buildings:
	vec3 blocked = min(outColor.rgb, block);
	outColor.rgb = mix(outColor.rgb, blocked, 0.25);

	outColor.a = 1.;

}
`,{
	"u_tex0": [0],
	"u_tex1": [1],
	u_tex4: [4],
	"u_fade": [0.99],
});

let trailfbo = createFBO(gl, gl.canvas.width, gl.canvas.height, true);
let slab_trail = createSlab(gl, `#version 300 es
precision highp float;
uniform sampler2D u_tex0;
uniform sampler2D u_tex1;
uniform sampler2D u_tex4;
uniform float u_fade;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
	vec3 tex0 = texture(u_tex0, v_texCoord).rgb;
	vec3 tex1 = texture(u_tex1, v_texCoord).rgb;
	vec4 data = texture(u_tex4, v_texCoord);
	float avg = length(tex0.r + tex0.g + tex0.b)/3.;
	vec3 col = mix(vec3(avg), tex0.rgb, u_fade);
	outColor.rgb = col*u_fade + tex1.rgb;
	outColor.a = 1.;
}
`,{
	"u_tex0": [0],
	"u_tex1": [1],
	u_tex4: [4],
	"u_fade": [0.99],
});


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
uniform sampler2D u_tex0;
uniform vec4 u_color;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
	vec4 tex0 = texture(u_tex0, v_texCoord).rgba;
	outColor = vec4(tex0.rgb, 1.);
	float avg = (outColor.r + outColor.g + outColor.b) * 0.333;
	outColor.rgb = mix(outColor.rgb, vec3(avg), 0.001);
	outColor.rgb *= u_color.a;
}
`)
gl.useProgram(program_showtex);
gl.uniform1i(gl.getUniformLocation(program_showtex, "u_tex0"), 0);
gl.uniform4f(gl.getUniformLocation(program_showtex, "u_color"), 1, 1, 1, 0.02);
let glQuad = createQuadVao(gl, program_showtex);

let slab_composite_invert = 0;
let slab_composite = createSlab(gl, `#version 300 es
precision highp float;

uniform sampler2D u_agents;
uniform sampler2D u_sync;
uniform sampler2D u_trails;
uniform sampler2D u_areas;
uniform sampler2D u_data;

uniform mat3 u_final;

// uniform sampler2D u_image;
// uniform sampler2D u_map;
uniform vec4 u_color;
uniform float u_invert;
uniform float u_showmap;
uniform float u_sharpness;
uniform float u_gamma;

uniform vec3 u_mix;
in vec2 v_texCoord;
out vec4 outColor;

vec4 blur(sampler2D img, vec2 uv) {
	float r = 1.;
	vec2 s = vec2(r/3231., r/2160.);
	vec4 p = vec4(s.x, s.y, -s.x, -s.y);
	float a = 0.25;
	float b = 0.5;
	vec4 bl = (
		texture(img, uv+(p.xy))
		+ texture(img, uv+(p.zw))
		+ texture(img, uv+(p.zy))
		+ texture(img, uv+(p.xw))
	) * 0.25;
	return mix(bl, texture(img, uv), u_sharpness);
}


vec4 blurred(sampler2D img, vec2 uv) {
	vec2 texSize = vec2(3231, 2160);
	vec2 onePixel = vec2(1.0, 1.0) / texSize;

	vec4 image0 = texture(img, uv);
	vec4 image1 = texture(img, uv+vec2(onePixel.x, 0.));
	vec4 image2 = texture(img, uv+vec2(0., onePixel.y));
	vec4 image3 = texture(img, uv+vec2(onePixel.x, onePixel.y));
	return mix((image0 + image1 + image2 + image3) / 4., image0, u_sharpness);
}

void main() {

	vec2 uv = (u_final * vec3(v_texCoord.xy, 1)).xy;
	vec2 uv1 = vec2(uv.x, 1.-uv.y);

	// vec4 data = texture(u_data, uv1);
	// float ways = data.r;
	// float altitude = data.g;
	// float areas = data.b;
	// float marks = data.a;

	vec4 areacolors = texture(u_areas, uv1);

	vec4 agents = texture(u_agents, uv);
	vec4 sync = blur(u_sync, uv); //texture(u_sync, uv);
	vec4 trails = blur(u_trails, uv);

	vec4 data = texture(u_data, uv);

	float trailsgamma = 1.2;
	trails.rgb = pow(trails.rgb, vec3(1.0/trailsgamma)) * u_mix.z;

	float aaa = max(agents.r, max(agents.b, agents.g));
	outColor.rgb = max(sync.rgb + trails.rgb, aaa); 
	outColor.rgb *= areacolors.a;
	outColor.rgb = mix(outColor.rgb, 1.-outColor.rgb, u_invert);
	outColor.a = 1.;
	outColor.rgb = pow(outColor.rgb, vec3(1.0/u_gamma));


	//outColor = sync;
}
`,{
	"u_agents": [0],
	"u_sync": [1],
	"u_trails": [2],
	u_mix: composite_mix,

	"u_areas": [3],
	u_data: [4],
	

	"u_color": [1, 1, 1, 1],
	"u_invert": [slab_composite_invert],
	u_gamma: [1],
	//"u_showmap": [showmap ? 1 : 0],
	"u_sharpness": [0.5],
})




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
	float a = 0.3 + a_color.a*a_color.a*0.7;
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
	float a = 0.4 + color.a*color.a;
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
	count: 0,


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
	float a = (color.r+color.g+color.b)*0.3;
	vec3 c = mix(vec3(a), color.rgb, color.a);
	//outColor = vec4(c, color.a * 0.5);
	//outColor = vec4(color.a * 0.5);
	outColor = vec4(c, color.a);
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
let capture = 0;
function update() {
	requestAnimationFrame(update);

	if (!dirty) return;
	
	dirty = false;

	let t = fps.t;

	// takes 0..1 uvs and maps them to screen space
	let finalmat = mat3.create();
	let finalsize = 0.97;
	let fx = (world.size[0] / screen.width[0]);
	let ratio = (screen.width/screen.height)/(world.size[0]/world.size[1]);
	mat3.translate(finalmat, finalmat, vec2.fromValues(0.5*ratio, 0.5))
	mat3.scale(finalmat, finalmat, vec2.fromValues(1/finalsize, 1/finalsize));
	mat3.scale(finalmat, finalmat, vec2.fromValues(ratio, 1));
	mat3.translate(finalmat, finalmat, vec2.fromValues(-0.5*ratio, -0.5))
	
	let invfinalmat = mat3.invert(mat3.create(), finalmat);
	
	let viewmat = [
		2/world.size[0], 0, 0,
		0, -2/world.size[1], 0,
		-1, 1, 1
	];

	viewmat = mat3.create();
	mat3.translate(viewmat, viewmat, vec2.fromValues(-1, 1));
	mat3.scale(viewmat, viewmat, vec2.fromValues(2/world.size[0], -2/world.size[1]));

	
	let viewmat2 = mat3.create();
	let tt = .034;
	mat3.scale(viewmat2, viewmat2, vec2.fromValues(1/ratio, 1));//, viewmat)
	mat3.translate(viewmat2, viewmat2, vec2.fromValues(tt*ratio, 0));
	mat3.scale(viewmat2, viewmat2, vec2.fromValues(finalsize, finalsize));

	// turn world coordinates into NDC:
	mat3.translate(viewmat2, viewmat2, vec2.fromValues(-1, 1));
	mat3.scale(viewmat2, viewmat2, vec2.fromValues(2/world.size[0], -2/world.size[1]));

	// capture new particles & lines
	fbo.begin().clear();
	{
		gl.lineWidth(0.1);
		gl.enable(gl.BLEND);
		//gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.useProgram(program_agents);
		gl.uniformMatrix3fv(gl.getUniformLocation(program_agents, "u_matrix"), false, viewmat);
		agentsVao.bind().submit(agentsVao.positions).draw();

	}
	fbo.end();

	// feed into trails:
	trailfbo.begin().clear();
	{
		fbo.front.bind(1);
		trailfbo.front.bind(0);
		world.data.bind(4);
		slab_trail.use();
		slab_trail.uniform("u_fade", 0.998);
		slab_trail.draw();
	}
	trailfbo.end();

	// feed into sync lighting:
	syncfbo.begin().clear();
	{
		syncfbo.front.bind(0);
		fbo.front.bind(1);
		world.data.bind(4);
		slab_sync.use().uniform("u_fade", 0.96);
		slab_sync.draw();

		
	}
	syncfbo.end(); 

	// now draw fbo to glcanvs, for use by ctx
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 1); // background colour
  	gl.clear(gl.COLOR_BUFFER_BIT);


	composite_mix[2] = 0.17+0.03*Math.sin(fps.t * 0.5);

	fbo.front.bind(0);
	syncfbo.front.bind(1)
	trailfbo.front.bind(2)
	world.areas.bind(3);
	world.data.bind(4);
	//world.bg.bind(2);
	//world.data.bind(1); //.submit();
	slab_composite.use();
	slab_composite.uniform("u_mix", composite_mix[0], composite_mix[1], composite_mix[2]);
	slab_composite.uniform("u_invert", slab_composite_invert);
	slab_composite.uniform("u_showmap", showmap ? 0.25 : 0);
	slab_composite.uniform("u_sharpness", sharpness);
	slab_composite.uniform("u_gamma", gamma);
	gl.uniformMatrix3fv(gl.getUniformLocation(slab_composite.program, "u_final"), false, finalmat);		
	slab_composite.draw();

	
	if (showlines) {
		gl.useProgram(program_lines);
		gl.uniformMatrix3fv(gl.getUniformLocation(program_lines, "u_matrix"), false, viewmat2);
		
		linesVao.count = MAX_LINE_POINTS;
		linesVao.bind().submit().draw();
	}

	// fbo.bind().readPixels(); // SLOW!!!

	
	if (0) {
		let ctx = canvas.getContext("2d", { antialias: true, alpha: false });
		let rr = (gl.canvas.width/gl.canvas.height) / (canvas.width/canvas.height);
		if (rr > 1) {
			let h = Math.floor(canvas.height / rr);
			ctx.drawImage(gl.canvas, 
				0, 0, gl.canvas.width, gl.canvas.height,
				0, (canvas.height-h)/2, canvas.width, h);
		} else {
			let w = Math.floor(canvas.width * rr);
			ctx.drawImage(gl.canvas, 
				0, 0, gl.canvas.width, gl.canvas.height,
				Math.floor((canvas.width-w)/2), 0, w, canvas.height);
		}
	} 

	fps.tick();
	//
	if (fps.t % 5 < fps.dt) {
		console.log("fps: ", Math.floor(fps.fpsavg))
		//refocus();
		//agents.sort((a, b) => b.reward - a.reward);
	}

	// if (fps.t % 1 < fps.dt) {
	// 	webutils.saveCanvasToPNG(gl.canvas, "capture"+ (capture++));
	// }
}

window.addEventListener("resize", resize, false);

canvas.addEventListener("mousedown", function(event) {
	//console.log(event);
	let world_coords = [world.size[0] * event.clientX / canvas.clientWidth, world.size[1] * event.clientY / canvas.clientHeight];
	console.log(world_coords);
}, false);


window.addEventListener("keyup", function(event) {
	//print(event.key);
	if (event.key == "z") {
		
	} else if (event.key == " ") {
		running = !running;
	} else if (event.key == "r") {
		sock.send({cmd: "reset"});
	// } else if (event.key == "m") {
	// 	showmap = !showmap; //agents.sort((a, b) => b.reward - a.reward);
	// } else if (event.key == "l") {
	// 	showlines = !showlines;
	// } else if (event.key == "i") {
	// 	slab_composite_invert = (slab_composite_invert) ? 0 : 1;
	// } else if (event.key == "s") {
	// 	// `frame${frame.toString().padStart(5, '0')}.png`;
	// 	saveCanvasToPNG(canvas, "result");
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
				//this.send({ cmd: "getdata", date: Date.now() });
			},
			onmessage: function(msg) { 
				print("received", msg);
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