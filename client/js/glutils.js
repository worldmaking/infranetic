
// utility to help turn shader code into a shader object:
function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.error("shader compile error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return undefined;
}
  
// utility to turn shader objects into a GPU-loaded shader program
// uses the most common case a program of 1 vertex and 1 fragment shader:
function createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    let success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    console.error("shader program error", gl.getProgramInfoLog(program));  
    gl.deleteProgram(program);
    return undefined;
}

// combine above functions to create a program from GLSL code:
function makeProgramFromCode(gl, vertexCode, fragmentCode) {
    // create GLSL shaders, upload the GLSL source, compile the shaders
    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexCode);
    let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentCode);
    // Link the two shaders into a program
    return createProgram(gl, vertexShader, fragmentShader);
}

function uniformsFromCode(gl, program, code) {
    let uniforms = {};
    let matches = code.match(/uniform\s+((\w+)\s+(\w+))/g);
    for (let e of matches) {
        let terms = e.split(/\s+/)
        let type = terms[1];
        let name = terms[2];
        let location = gl.getUniformLocation(program, name);
        let setter;
        switch (type) {
            case "float": setter = (f) => gl.uniform1f(location, f); break;
            case "vec2": setter = (x, y, z, w) => gl.uniform2f(location, x, y); break;
            case "vec3": setter = (x, y, z, w) => gl.uniform3f(location, x, y, z); break;
            case "vec4": setter = (x, y, z, w) => gl.uniform4f(location, x, y, z, w); break;
            case "ivec2": setter = (x, y, z, w) => gl.uniform2i(location, x, y); break;
            case "ivec3": setter = (x, y, z, w) => gl.uniform3i(location, x, y, z); break;
            case "ivec4": setter = (x, y, z, w) => gl.uniform4i(location, x, y, z, w); break;
            case "mat2": setter = (m, transpose=false) => gl.uniformMatrix2fv(location, transpose, m); break;
            case "mat3": setter = (m, transpose=false) => gl.uniformMatrix3fv(location, transpose, m); break;
            case "mat4": setter = (m, transpose=false) => gl.uniformMatrix4fv(location, transpose, m); break;
            default: setter = (i) => gl.uniform1i(location, i);
        }
        uniforms[name] = { 
            set: setter,
            name: name,
            type: type,
            location: location,
        };
    };
    return uniforms;
}


// create a GPU buffer to hold some vertex data:
function makeBuffer(gl, vertices) {
    let positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null); // done.
    return positionBuffer;
}

function createPixelTexture(gl, width, height, floatingpoint=false) {

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
        
        // bind() first
        submit() {
            let mipLevel = 0;
            let internalFormat = floatingpoint ? gl.RGBA32F : gl.RGBA;   // format we want in the texture
            let border = 0;                 // must be 0
            gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, this.width, this.height, border, this.format, this.dataType, this.data);
            //gl.generateMipmap(gl.TEXTURE_2D);
        },
        
        bind(unit = 0) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, this.id);
            return this;
        },
        unbind(unit = 0) {
            gl.activeTexture(gl.TEXTURE0 + unit);
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

function createFBO(gl, width, height, floatingpoint=false) {
    let id = gl.createFramebuffer();
    console.log("FBO floating?", floatingpoint);

    let fbo = {
        id: id,
        // what we currently read from:
        front: createPixelTexture(gl, width, height, floatingpoint),
        // what we currently draw to:
        back: createPixelTexture(gl, width, height, floatingpoint),
        
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



        // reads the GPU memory back into this.data
        // must bind() first!
        // warning: can be slow
        readPixels(attachment = gl.COLOR_ATTACHMENT0) {
            if (!this.front.data) this.front.allocate();
            gl.readBuffer(attachment);
            gl.readPixels(0, 0, this.front.width, this.front.height, this.front.format, this.front.dataType, this.front.data);
            return this;
        },
    };

    fbo.bind().swap().unbind();
    return fbo;
}

function createQuadVao(gl, program) {
    let self = {
        id: gl.createVertexArray(),
        init(program) {
            this.bind();
            {
                let positionBuffer = makeBuffer(gl, [
                    -1,  1,  -1, -1,   1, -1,
                    -1,  1,   1, -1,   1,  1
                ]);
                // look up in the shader program where the vertex attributes need to go.
                let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
                // Turn on the attribute
                gl.enableVertexAttribArray(positionAttributeLocation);
                // Tell the attribute which buffer to use
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
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
                let texcoordBuffer = makeBuffer(gl, [
                    0, 1,  0, 0,   1, 0,
                    0, 1,  1, 0,   1, 1
                ]);
                // look up in the shader program where the vertex attributes need to go.
                let positionAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
                // Turn on the attribute
                gl.enableVertexAttribArray(positionAttributeLocation);
                // Tell the attribute which buffer to use
                gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
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
        },

        bind() {
            gl.bindVertexArray(this.id);
            return this;
        },
        unbind() {
            gl.bindVertexArray(this.id, null);
            return this;
        },
        draw() {
            // draw
            let primitiveType = gl.TRIANGLES;
            let offset = 0;
            let count = 6;
            gl.drawArrays(primitiveType, offset, count);
            return this;
        }
    }
    if (program) self.init(program);

    return self;
}

function createSlab(gl, fragCode, uniforms) {
    let program = makeProgramFromCode(gl, `#version 300 es
in vec4 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
    gl_Position = a_position;
    v_texCoord = a_texCoord;
}`, fragCode);
    let self = {
        program: program,
        quad: createQuadVao(gl, program),
        uniforms: uniformsFromCode(gl, program, fragCode),

        uniform(name, ...args) {
            this.uniforms[name].set.apply(this, args);
            return this;
        },

        setuniforms(dict) {
            this.use();
            for (let k in dict) {
                console.log(k, dict[k])
                this.uniforms[k].set.apply(this, dict[k]);
            }
            return this;
        },

        use() {
            gl.useProgram(this.program);
            return this;
        },

        draw() {
            this.quad.bind().draw();
            return this;
        },
    };
    if (uniforms) self.setuniforms(uniforms);
    return self;
}