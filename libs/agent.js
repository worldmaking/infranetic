

(function() {
	const isCommonjs = typeof module !== 'undefined' && module.exports;
	const neataptic = isCommonjs ? require("./neataptic.js") : window.neataptic;
	const neataptic_methods = neataptic.methods;
	const Network = neataptic.Network;
	const neataptic_architect = neataptic.architect;
    neataptic.config.warnings = false;
    const neato = isCommonjs ? require("./neato.js") : window.neato;
    const utils = isCommonjs ? require("./utils.js") : window.utils;
    
    const { vec2, vec3 } = isCommonjs ? require("gl-matrix") : window;

    let which = 0;

    class Agent {

        constructor(id, world) {
            this.id = id;
            this.pos = vec2.create();
            this.fwd = vec2.create();
            this.side = vec2.create();
            this.scent = vec3.create();

            this.meta = {
                reward: 0
            };

            this.reset(world);
        }

        reset(world) {
            vec2.set(this.pos, Math.random() * world.size[0], Math.random() * world.size[1]);
            vec2.random(this.fwd, 1);
            vec3.set(this.scent, 0.5, 0.5, 0.5 );

            
            this.rate = 1/2;
            this.size = 1;
            this.speed = 4 * world.pixels_per_meter; // pixels per frame

            this.reset_generic(world);
            this.network = neato.createNetwork();
        }

        reset_copy(other, world) {
            vec2.copy(this.pos, other.pos);
            vec2.copy(this.fwd, other.fwd);
            vec3.copy(this.scent, other.scent);

            this.dphase = 0;
            this.rate = other.rate;
            this.size = other.size;
            this.speed = other.speed; // pixels per frame  

            this.reset_generic(world);  
            this.network = neato.copyNetwork(other.network);
        }

        reset_generic(world) {
            vec2.set(this.side, this.fwd[1], -this.fwd[0]);
            this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

            this.dphase = 0;
            this.phase = Math.random();
            this.active = Math.random();
            this.meta.reward = 0.5;

            let color = [0, 0, 0, 0];
            let name = ""
            world.areas.readInto(this.pos[0], this.pos[1], color);
            if (color[1] > 0.1) name += "N";
            if (color[0] > 0.1) name += "B";
            if (color[2] > 0.1) name += "I";
            world.data.readInto(this.pos[0], this.pos[1], color);
            if (color[1] > 0.1) name += "M";
            world.ways.readInto(this.pos[0], this.pos[1], color);
            if (color[1] > 0.1) name += "W";
            if (name.length == 0) name = "Z";

            let d = new Date();
            this.meta.birthdata = `${(d.getMonth()+1)}${(d.getDate().toString().padStart(2, '0'))}_${(d.getHours()).toString().padStart(2, '0')}:${(d.getMinutes()).toString().padStart(2, '0')}_${name}`;

        }

        update(world, agents) {    
            
            
            let widx = Math.floor(this.pos[1])*world.size[0] + Math.floor(this.pos[0]);


            // sensing:
            let s1 = vec2.create();
            vec2.add(s1, this.pos, this.fwd);
            vec2.add(s1, s1, this.side);
            
            let s2 = vec2.create();
            vec2.add(s2, this.pos, this.fwd);
            vec2.sub(s2, s2, this.side);

            let g1 = world.ways.readDot(s1[0], s1[1], this.scent)
            let g2 = world.ways.readDot(s2[0], s2[1], this.scent)

            let data = [0, 0, 0, 0]
            let g0 = world.data.readInto(this.pos[0], this.pos[1], data);
            
            let wayfound = g0[0];
            let areafound = g0[2];
            let altitude = g0[1];
            let marked = g0[3];

           

            // mark our passage:
            //world.data.data[widx*4 + 3] = 0;


            // simple meta.reward for staying on the roads for now:
            this.meta.reward = Math.max(this.meta.reward * 0.99, wayfound * marked);

            if (this.meta.reward < 0.1) {
                //this.reset_copy(utils.pick(agents), world);
                this.reset(world);
                return;
            }
            

            let outputs = this.network.activate([g2-g1, g2+g1]);

            let color = [0, 0, 0, 0];
            world.ways.readInto(s1[0], s1[1], color);

            if (Math.random() >= color[3]) {
                this.reset(world);
                return;
            }

            if ((which++) % 5000 == this.id) {

                //console.log(g1, g2);
            }

            let dev = vec3.random(vec3.create(), 0.05)
            vec3.add(this.scent, this.scent, dev);
            this.scent[0] = (this.scent[0] > 1) ? 1 : (this.scent[0] < 0) ? 0 : this.scent[0];
            this.scent[1] = (this.scent[1] > 1) ? 1 : (this.scent[1] < 0) ? 0 : this.scent[1];
            this.scent[2] = (this.scent[2] > 1) ? 1 : (this.scent[2] < 0) ? 0 : this.scent[2];
            
            this.size = (g2 > 0 || g1 > 0) ? 3 : 1;
            this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

            let turn = (g2-g1);
            if (Math.abs(turn) < 0.01) {
                turn = 0.25*(Math.random() - 0.5);
            }
            this.dir += turn * Math.random();

            vec2.set(this.fwd, Math.cos(this.dir), Math.sin(this.dir))

            if (0) {
                this.scent[0] = this.meta.reward;
                this.scent[1] = 0.5; //outputs[0];
                this.scent[2] = 1 - this.scent[0]; //outputs[1];
            }

            let entrainment = 0.5;
            let deviation = 0.0000;
            let bias = 0.001;

            /*
                concept: want to align phase with neighbours

                    on every frame, decrement activation by a small amount (constant for all, or per agent, or 'adapted'?)
                    when activation reaches zero, fire back up to 1

                    when active > 0.5, don't listen to neighbours

                    when active < 0.5, compare with neighbors
                    ignore neighbours whose activation phases are far from ours
                        but if similar, adjust ours toward the average

            */
            
            let dp = 0;
            let near = world.agents_near[this.id];
            if (near.length > 1) {
                let pdavg = 0;
                let adavg = 0;
                let aavg = 0;
                for (let n of near) {
                    if (n == this) continue;

                    if (Math.random() < 0.1*(n.meta.reward - this.meta.reward)) {
                        // copy the network:
                        this.network = neato.copyNetwork(n.network)
                        if (Math.random() < 0.01) neato.mutateOnce(this.network);
                        this.meta.reward = n.meta.reward;
                    }

                    // get activation difference:
                    let ad = n.active - this.active;
                    let sad = (ad - Math.floor(ad + 0.5)); // wrapped into +/- 0.5;
                    let aad = Math.abs(sad);

                    

                    // listening threshold:
                    if (n.active > 0.5) {
                        
                        aavg += sad;
                        // similarity threshold:
                        if (sad < 0.5) {
                            dp += sad;
                        }
                    }

                    adavg += ad;
                    // only listen to louder voices:
                    if (ad > 0) {
                        vec3.lerp(this.scent, this.scent, n.scent, 0.1);
                        
                    }
                    
                    // get phase difference:
                    let pd = (n.phase - this.phase);
                    pdavg += (pd - Math.floor(pd + 0.5));// + bias; // wrapped into -0.5..0.5

                    if (0) {
                        // just a dumb exmaple proof of concept:
                        // bounce away from each other
                        let rel = vec2.create();
                        vec2.sub(rel, this.pos, n.pos);
                        let d2 = vec2.dot(rel, rel);

                        let amt = 1/10;///(1+d2);
                        vec2.normalize(rel, rel);
                        vec2.lerp(this.fwd, this.fwd, rel, amt);
                        vec2.set(this.side, this.fwd[1], -this.fwd[0]);
                    }
                }
                pdavg /= near.length;
                adavg /= near.length;

                //this.dphase = entrainment*pdavg;
                //this.dphase = entrainment*adavg;
                //this.dphase = entrainment * shift;

                aavg /= near.length;
                this.dphase = -entrainment * (aavg);
                this.rate += 0.1 * this.dphase;

            // this.dphase = dp * entrainment / near.length;
            } else {
                this.dphase = deviation*Math.random();
            }

            vec2.set(this.side, this.fwd[1], -this.fwd[0]);
        }

        move(world, dt) {

            //let p = this.active - (dt*this.rate + this.dphase);
            //this.active = (p+1 - ~~p); // wraps in 0 < p <= 1

            this.active -= (dt*this.rate + this.dphase);
            if (this.active < 0) {
                 this.active += 1;
            } else if (this.active >= 1) {
                 this.active -= 1;
            }

            // doesn't really save anything:
            //if (this.active < 0.5) return;

            let speed = Math.pow(this.active, 4) * 4;
            this.pos[0] += (this.speed * speed) * this.fwd[0];
            this.pos[1] += (this.speed * speed) * this.fwd[1];
            this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

            this.wrap(world);

            if (isNaN(this.pos[0]) || isNaN(this.pos[1])) {
                this.reset(world);
            }
        }

        clamp(world) {
            if (this.pos[0] > world.size[0]) {
                this.pos[0] = world.size[0];
            } else if (this.pos[0] < 0) {
                this.pos[0] = 0;
            }
            if (this.pos[1] > world.size[1]) {
                this.pos[1] = world.size[1];
            } else if (this.pos[1] < 0) {
                this.pos[1] = 0;
            }
        }

        wrap(world) {
            if (this.pos[0] > world.size[0]) {
                this.pos[0] -= world.size[0];
            } else if (this.pos[0] < 0) {
                this.pos[0] += world.size[0];
            }
            if (this.pos[1] > world.size[1]) {
                this.pos[1] -= world.size[1];
            } else if (this.pos[1] < 0) {
                this.pos[1] += world.size[1];
            }
        }
    };

	if (isCommonjs) {
		module.exports = Agent;
	} else {
		window.Agent = Agent;
	}
})();
