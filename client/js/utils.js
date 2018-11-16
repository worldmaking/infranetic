
// pick an element at random from an array
function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
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

// add a message to the overlay <div> element on the page:
function print(...args) {
    const el = document.createElement("pre");
    el.textContent = [...args].join(' ');
    console.log(el.textContent);
    document.body.appendChild(el);
}
