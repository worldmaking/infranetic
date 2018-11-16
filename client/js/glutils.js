
// create a GPU buffer to hold some vertex data:
function makeBuffer(vertices) {
    let positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.
    return positionBuffer;
}

function createPixelTexture(width, height, floatingpoint=false) {

    floatingpoint =  floatingpoint && (!!gl.getExtension("EXT_color_buffer_float"));
    console.log("texture floating?", floatingpoint);
    const channels = 4; // RGBA

    let tex = {
        id: gl.createTexture(),
        data: null,
        width: width,
        height: height,
        channels: channels,
        format: gl.RGBA,
        dataType: floatingpoint ? gl.FLOAT : gl.UNSIGNED_BYTE,  // type of data we are supplying,
        
        // allocate local data
        allocate() {
            if (!this.data) {
                let elements = width * height * channels;
                if (floatingpoint) {
                    this.data = new Float32Array(elements);
                } else {
                    this.data = new Uint8Array(elements);
                }
            }
            return this;
        },

        readPixelsFromAttachment(attachment = gl.COLOR_ATTACHMENT0) {
            gl.readBuffer(attachment);
            gl.readPixels(0, 0, this.width, this.height, this.format, this.dataType, this.data);
            //log(glEnumToString(gl, attachment), data);
        },
        
        // bind() first
        submit() {
            let mipLevel = 0;
            let internalFormat = floatingpoint ? gl.RGBA32F : gl.RGBA;   // format we want in the texture
            let border = 0;                 // must be 0
            gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, this.width, this.height, border, this.format, this.dataType, this.data);
        },
        
        bind() {
            gl.bindTexture(gl.TEXTURE_2D, this.id);
            return this;
        },
        unbind() {
            gl.bindTexture(gl.TEXTURE_2D, null);
            return this;
        },
    };

    tex.bind().submit();

    // unless we get `OES_texture_float_linear` we can not filter floating point
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return tex.unbind();
}

function createFBO(width, height, floatingpoint=false) {
    let id = gl.createFramebuffer();
    console.log("FBO floating?", floatingpoint);

    let fbo = {
        id: id,
        // what we currently read from:
        front: createPixelTexture(width, height, floatingpoint),
        // what we currently draw to:
        back: createPixelTexture(width, height, floatingpoint),
        
        bind() { 
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.id); 
            return this; 
        },
        unbind() { 
            gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
            return this; 
        },
        swap() {
            [this.back, this.front] = [this.front, this.back];
            return this;
        },
        begin() {
            // make this the framebuffer we are rendering to.
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
            let attachmentPoint = gl.COLOR_ATTACHMENT0;
            let mipLevel = 0;               // the largest mip
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.back.id, mipLevel);
            gl.viewport(0, 0, width, height);
        },
        
        end() {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this.swap();
            gl.viewport(0, 0, canvas.width, canvas.height);
        },
    };

    fbo.bind().swap().unbind();
    return fbo;
}

// Create a vertex array object (holds attribute state)
let vaoQuod = {
    id: gl.createVertexArray(),
    
    create(program) {
        this.bind();
        {
            this.positionBuffer = makeBuffer([
                -1,  1,  -1, -1,   1, -1,
                -1,  1,   1, -1,   1,  1
            ]);
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
        }
        {
            this.texcoordBuffer = makeBuffer([
                0, 1,  0, 0,   1, 0,
                0, 1,  1, 0,   1, 1
            ]);
            // look up in the shader program where the vertex attributes need to go.
            let positionAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
            // Turn on the attribute
            gl.enableVertexAttribArray(positionAttributeLocation);
            // Tell the attribute which buffer to use
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer);
            // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
            let size = 2;          // 2 components per iteration
            let type = gl.FLOAT;   // the data is 32bit floats
            let normalize = false; // don't normalize the data
            let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
            let offset = 0;        // start at the beginning of the buffer
            gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
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
        let primitiveType = gl.TRIANGLES;
        let offset = 0;
        let count = 6;
        gl.drawArrays(primitiveType, offset, count);
        return this;
    },
}