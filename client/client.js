
const world = {
	meters: [34976, 23376], // meters
	size: [3231, 2160], // pixels
	aspect: 34976/23376,
	meters_per_pixel: 23376 / 2160,
	pixels_per_meter: 2160 / 23376, 
	norm: [1/3231, 1/2160],

	grass: new ArrayFromImg('img/grass.png'),
};
world.aspect = world.meters[0]/world.meters[1];
world.size[0] = world.size[1] * world.aspect;
world.meters_per_pixel = world.meters[1] / world.size[1];
world.pixels_per_meter = 1/world.meters_per_pixel;
world.norm = [1/world.size[0], 1/world.size[1]];

const numagents = 20000;
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

function draw(canvas) {
	let ctx = canvas.getContext("2d");

	ctx.fillStyle = "red";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}


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
	let ctx = canvas.getContext("2d");
	ctx.drawImage(offscreen, 0, 0);

	// draw as 2d:
	{
		ctx.lineWidth = 1;

		ctx.fillStyle = "purple"
		let size = 3;
		for ( let a of agents) {
			ctx.fillRect(a.pos[0], a.pos[1], size * a.size, size * a.size);
		}
	}

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
	} else if (event.key == "s") {
		// `frame${frame.toString().padStart(5, '0')}.png`;
		saveCanvasToPNG(canvas, "result");
	}
}, false);

/////////////////////////////////////////////////////////////

resize();
draw(offscreen);
update();
img2canvas('img/grass.png', offscreen);



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