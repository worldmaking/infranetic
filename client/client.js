
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let offscreen = new OffscreenCanvas(3840, 2160);

let sock = new Socket({
    reload_on_disconnect: true,
	onopen: function() {
		this.send(JSON.stringify({ type: "getdata", date: Date.now() }));
    },
	onmessage: function(msg) { 
        print("received", msg);
    }
});
