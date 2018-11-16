
// pick an element at random from an array
function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// add a message to the overlay <div> element on the page:
function print(...args) {
    const el = document.createElement("pre");
    el.textContent = [...args].join(' ');
    console.log(el.textContent);
    document.body.appendChild(el);
}
  
// save the contents of a <canvas> to a PNG file
function saveCanvasToPNG(canvas, filename="canvas_image") {
	function dataURLtoBlob(dataurl) {
		let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
			bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
		while(n--) u8arr[n] = bstr.charCodeAt(n);
		return new Blob([u8arr], {type:mime});
	}
	let link = document.createElement("a");
	let imgData = canvas.toDataURL({ format:'png', multiplier:4});
	let strDataURI = imgData.substr(22, imgData.length);
	let blob = dataURLtoBlob(imgData);
	let objurl = URL.createObjectURL(blob);
	link.download = filename + ".png";
	link.href = objurl;
	link.target = '_blank';
	link.click();
} 

// load an img and draw it into a canvas
function img2canvas(path, canvas) {
	let img = new Image();   // Create new img element
	img.onload = function() {
		let ctx = canvas.getContext("2d");
		ctx.drawImage(this, 0, 0);
		let imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
		let binary = new Uint8ClampedArray(imgdata.data.buffer);
	}
	img.src = path; // Set source path
}

class FPS {
	constructor() {
		this.t = performance.now();
		this.fps = 60;
		this.dt = 1000/this.fps;
	}

	tick() {
		let t1 = performance.now();
		this.dt = t1-this.t;
		this.fps += 0.1*((1000/this.dt) - this.fps);
		this.t = t1;
	}
};

// loads an image and turns it into a typedarray and offscreen canvas
class ArrayFromImg {
	constructor(path) {
		let self = this;
		let img = new Image();   // Create new img element
		this.canvas = new OffscreenCanvas(64, 64);
		img.onload = function() {
			self.width = this.width;
			self.height = this.height;
			self.canvas.width = self.width;
			self.canvas.height = self.height;
			let length = this.width * this.height;
			let ctx = self.canvas.getContext("2d");
			ctx.drawImage(this, 0, 0);
			let imgdata = ctx.getImageData(0, 0, this.width, this.height);
			let binary = new Uint8ClampedArray(imgdata.data.buffer);
			let data = new Float32Array(length);
			for (let i=0; i<length; i++) {
				data[i] = 1. - (binary[i*4+2] / 255);
			}
			self.data = data;
		}
		img.src = path; // Set source path
	}

	
	read(x, y) {
		if (!this.data) return 0;

		let idx = Math.floor(x) + Math.floor(y) * this.width;
		return this.data[idx];
	}
};
