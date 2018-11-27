

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
            this.pos = [0, 0];
            this.labels = [];
        }

        update(world, fps) {
            this.zoom -= fps.dt * 0.01;
            if (this.zoom <= 0.05) {

                // switch attention
                let near = world.agents_near[this.agent];
                if (near.length > 0) {
                    this.agent = near[Math.floor(Math.random()*near.length)].id;
                } else {
                    this.agent = Math.floor(Math.random()*world.agents.length);
                }
                this.zoom = 2;
            } 

            let a = world.agents[this.agent];
            vec2.lerp(this.pos, this.pos, a.pos, 0.05);
            //cell.zoom += 0.002*(Math.pow(a.reward,4) - cell.zoom);
            this.reward = a.meta.reward;
            this.labels[0] = a.meta.birthdata;
            this.labels[1] = `${(this.pos[0]*world.tokm).toFixed(1)},${(this.pos[0]*world.tokm).toFixed(1)}km (${Math.floor(100*this.pos[0]/world.size[0])},${Math.floor(100*this.pos[0]/world.size[1])})`
            this.labels[2] = `${a.meta.reward.toFixed(3)}`;
        }
    };

    
	if (isCommonjs) {
		module.exports = Watcher;
	} else {
		window.Watcher = Watcher;
	}
})();