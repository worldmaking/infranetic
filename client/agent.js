

class Agent {

    constructor(id, world) {
        this.id = id;
        this.pos = vec2.fromValues(
            Math.random() * world.size[0],
            Math.random() * world.size[1]
        );
        this.fwd = vec2.create();
        vec2.random(this.fwd, 1);
        this.side = vec2.fromValues(this.fwd[1], -this.fwd[0]);
        

        this.size = 1;
        this.speed = 2 * world.pixels_per_meter; // pixels per frame
    }

    update(world) {     

        if (Math.random() < 0.00001) {
            this.pos = vec2.fromValues(
                Math.random() * world.size[0],
                Math.random() * world.size[1]
            );
            return;
        }

        let s1 = vec2.create();
        vec2.add(s1, this.pos, this.fwd);
        vec2.add(s1, s1, this.side);
        
        let s2 = vec2.create();
        vec2.add(s2, this.pos, this.fwd);
        vec2.sub(s2, s2, this.side);

        let g1 = world.grass.read(s1[0], s1[1])
        let g2 = world.grass.read(s2[0], s2[1])

        let g = world.grass.read(this.pos[0], this.pos[1])
        this.size = (g2 > 0 || g1 > 0) ? 3 : 1;
        //vec2.random(this.vel, this.speed);

        this.dir = Math.atan2(this.fwd[1], this.fwd[0]);

        let turn = g2-g1;
        if (Math.abs(turn) < 0.001) {
            turn = 0.5*(Math.random() - 0.5);
        }
        this.dir += turn * Math.random();

        vec2.set(this.fwd, Math.cos(this.dir), Math.sin(this.dir))
        vec2.set(this.side, this.fwd[1], -this.fwd[0]);
    }

    move(world) {
        this.pos[0] += this.speed * this.fwd[0];
        this.pos[1] += this.speed * this.fwd[1];

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
