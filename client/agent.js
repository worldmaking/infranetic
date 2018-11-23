

class Agent {

    constructor(id, world) {
        this.id = id;
        this.network = neato.createNetwork();
        this.reset();
    }

    reset() {
        this.pos = vec2.fromValues(
            Math.random() * world.size[0],
            Math.random() * world.size[1]
        );
        this.fwd = vec2.create();
        vec2.random(this.fwd, 1);
        this.side = vec2.fromValues(this.fwd[1], -this.fwd[0]);
        this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

        this.scent = vec3.fromValues( 0.5, 0.5, 0.5 );
        this.phase = Math.random();
        this.active = 0;

        this.size = 1;
        this.speed = 2 * world.pixels_per_meter; // pixels per frame

        this.near = [];
    }

    update(world) {     

        // sensing:
        let s1 = vec2.create();
        vec2.add(s1, this.pos, this.fwd);
        vec2.add(s1, s1, this.side);
        
        let s2 = vec2.create();
        vec2.add(s2, this.pos, this.fwd);
        vec2.sub(s2, s2, this.side);

        let g1 = world.ways.readDot(s1[0], s1[1], this.scent)
        let g2 = world.ways.readDot(s2[0], s2[1], this.scent)

        let color = [0, 0, 0, 0];
        world.ways.readInto(s1[0], s1[1], color);
        if (color[3] == 0) {
            this.reset();
            return;
        }

        let dev = vec3.random(vec3.create(), 0.05)
        vec2.add(this.scent, this.scent, dev);
        this.scent[0] = (this.scent[0] > 1) ? 1 : (this.scent[0] < 0) ? 0 : this.scent[0];
        this.scent[1] = (this.scent[1] > 1) ? 1 : (this.scent[1] < 0) ? 0 : this.scent[1];
        this.scent[2] = (this.scent[2] > 1) ? 1 : (this.scent[2] < 0) ? 0 : this.scent[2];
        for (let n of this.near) {
            vec3.lerp(this.scent, this.scent, n.scent, 0.1);
        }
        
        this.size = (g2 > 0 || g1 > 0) ? 3 : 1;
        this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

        let turn = (g2-g1);
        if (Math.abs(turn) < 0.01) {
            turn = 0.25*(Math.random() - 0.5);
        }
        this.dir += turn * Math.random();

        vec2.set(this.fwd, Math.cos(this.dir), Math.sin(this.dir))

        let entrainment = 0.1;
        let deviation = 0.0;
        let bias = 0.00;
        
        if (this.near.length > 1) {
            let pdavg = 0;
            for (let n of this.near) {
                if (n == this) continue;

                // get phase difference:
                let pd = (n.phase - this.phase);
                pdavg += (pd - Math.floor(pd + 0.5)); // wrapped into -0.5..0.5

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
            pdavg /= this.near.length;

            let p1 = this.phase + entrainment*pdavg + deviation*(Math.random()-0.5) + bias;
            if (p1 >= 1) {
                p1 -= 1;
            } else if (p1 < 0) {
                p1 += 1;
            }
            this.phase = p1;
        } else {
            let p1 = this.phase + 0.000*Math.random();
            if (p1 >= 1) {
                p1 -= 1;
            } else if (p1 < 0) {
                p1 += 1;
            }
            this.phase = p1;
        }

        vec2.set(this.side, this.fwd[1], -this.fwd[0]);

        let outputs = this.network.activate([g1, g2]);
    }

    move(world, t) {
        let r = 1000 - vec2.distance(this.pos, world.acc) * 0.002;

        let phase = (this.phase + t*0.5);

        // cosine curve
        //let p = 1 + Math.cos(Math.PI * phase);
        // pulse
        let p = 1-(phase - ~~phase);
        this.active = p;

        let speed = Math.pow(p, 3) * 3;

        this.pos[0] += (this.speed * speed) * this.fwd[0];
        this.pos[1] += (this.speed * speed) * this.fwd[1];

        this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

        this.wrap(world);
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
