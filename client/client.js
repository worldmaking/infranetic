
let world_size = vec2.fromValues(34976, 23376); // meters
let world_aspect = world_size[0]/world_size[1];



let canvas = document.getElementById("canvas");
const offscreen_height = 2160; // pixels
let offscreen = new OffscreenCanvas(offscreen_height * world_aspect, offscreen_height);


// let it always fill the page:
function resize() {
	let window_aspect = window.innerWidth/window.innerHeight;
	canvas.width = offscreen.width; 
	canvas.height = offscreen.height; 

	let canvas_aspect = world_aspect/window_aspect;
	if (canvas_aspect > 1) {
		canvas.style.width = '100%';
		canvas.style.height = Math.floor(100 / canvas_aspect) + "%";
	} else {
		canvas.style.width = Math.floor(100 * canvas_aspect) + "%";
		canvas.style.height = '100%';
	}
	draw(offscreen);
}
resize();
window.addEventListener("resize", resize, false);

function draw(canvas) {
	let ctx = canvas.getContext("2d");

	ctx.fillStyle = "red";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
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

draw(offscreen);

// render:
let running = true;
function update() {

	// schedule next frame
	requestAnimationFrame(update);

	if (running) {

		// copy offscreen:
		let ctx = canvas.getContext("2d");
		ctx.drawImage(offscreen, 0, 0);
	}
}
update();

// handle some common UI events:
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