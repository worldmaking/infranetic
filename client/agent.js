

class Agent {

    constructor(id, world) {
        this.id = id;
        this.pos = vec2.fromValues(
            Math.random() * world.size[0],
            Math.random() * world.size[1]
        );
        this.vel = vec2.create();

        this.size = 1;
    }

    update(world) {

        let g = world.grass.read(this.pos[0] * world.norm[0], this.pos[1] * world.norm[1])
        this.size = g > 0 ? 3 : 1;
        this.speed = 10; // meters per frame
        vec2.random(this.vel, this.speed);
    }

    move(world) {
        vec2.add(this.pos, this.pos, this.vel);

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
