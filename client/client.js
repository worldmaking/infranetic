
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
let glcanvas = new OffscreenCanvas(world.size[0], world.size[1]);
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

let focus = [world.size[0]*1/3, world.size[1]*1/3];
let zoom = 1;

function update() {
	requestAnimationFrame(update);

	if (running) {
		for (let a of agents) {
			a.update(world);
		}
		for (let a of agents) {
			a.move(world);
		}
	}

	// copy offscreen:
	let ctx = offscreen.getContext("2d");
	ctx.fillStyle = "hsl(0, 0%, 100%, 1%)"
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
		ctx.drawImage(offscreen, 0, 0);

		
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