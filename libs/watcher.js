

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

    class Watcher {
        constructor(i, grid, world) {
            this.id = i;
            this.col = i % grid.cols;
            this.row = Math.floor(i / grid.cols);
            this.agent = Math.floor(Math.random()*world.agents.length);
            this.zoom = Math.random();
            this.reward = Math.random();
            this.difference = Math.random();
            this.pos = [0, 0];
            this.labels = [];
        }

        update(world, fps) {
            this.zoom -= fps.dt * 0.01;

            // switch attention
            if (this.zoom <= 0.04) {
                this.agent = Math.floor(Math.random()*world.agents.length);
                this.zoom = 1;
            } else {
                let near = world.agents_near[this.agent];
                let self = world.agents[this.agent];
                if (near.length > 0) {
                    let n = near[Math.floor(Math.random()*near.length)];
                    // CHOOSE A MORE INTERESTING NEIGHBOUR TO FOLLOW?
                    let difference = vec3.angle(self.scent, n.scent);

                    // difference as a measure of discovery
                    this.diff = difference;

                    if (Math.random() < (this.zoom * difference * (n.active - self.active))) {
                        this.agent = n.id;
                    }
                }
            }

            let a = world.agents[this.agent];
            vec2.lerp(this.pos, a.pos, this.pos, 1-0.1*(1-this.zoom));
            
            this.reward = a.meta.reward;

            let kmx = (this.pos[0]*world.tokm);
            let kmy = (this.pos[1]*world.tokm);
            let nx = Math.floor(100*this.pos[0]/world.size[0]);
            let ny = Math.floor(100*this.pos[1]/world.size[1]);
            let zz = ((this.zoom * 127.5) * world.meters_per_pixel); 

            this.labels[0] = a.meta.birthdata;
            this.labels[1] = `${kmx.toFixed(1)},${kmy.toFixed(1)}km (${nx},${ny})`
            this.labels[2] = `${a.meta.reward.toFixed(3)} ${this.difference.toFixed(3)} ±${Math.floor(zz)}m`;
        }
    };

    
	if (isCommonjs) {
		module.exports = Watcher;
	} else {
		window.Watcher = Watcher;
	}
})();