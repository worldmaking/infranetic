class SpaceHash {
	constructor(opt) {
		this.cellSize = opt.cellSize || 10;
		this.rCellSize = 1 / this.cellSize;
		// round up range to whole number of cells:
		this.numCellsH = Math.ceil((opt.width || 100) / this.cellSize);
		this.numCellsV = Math.ceil((opt.height || 100) / this.cellSize);
		this.width = this.numCellsH * this.cellSize;
		this.height = this.numCellsV * this.cellSize;
		this.numCells = this.numCellsH * this.numCellsV;
		this.clear();
	}
  
	clear() {
		this.cells = [];
		for (let i = 0; i < this.numCells; i++) this.cells[i] = [];
		return this;
	}
  
	insertPoint(item) {
		const px = item.pos[0], py = item.pos[1];
		const rCellSize = 1 / this.cellSize;
		var h = Math.max(Math.min(~~(px * rCellSize), this.numCellsH - 1), 0);
		var v = Math.max(Math.min(~~(py * rCellSize), this.numCellsV - 1), 0);
		item.__b = { cellH: h, cellV: v };
		this.cells[v * this.numCellsH + h].push(item);
		return this;
	}
  
	removePoint(item) {
		if (!item.__b) return;
		var v = item.__b.cellV, h = item.__b.cellH;
		var idx = v * this.numCellsH + h;
		var cell = this.cells[idx];
		var k = cell.indexOf(item);
		if (k !== -1) cell.splice(k, 1);
		return this;
	}
  
	updatePoint(item) {
		// old location
		var ov = item.__b.cellV, oh = item.__b.cellH;
		var oidx = ov * this.numCellsH + oh;
		// new location
		var nx = item.pos[0], ny = item.pos[1];
		var rCellSize = 1/this.cellSize;
		var nh = Math.max(Math.min(~~(nx * rCellSize), this.numCellsH - 1), 0);
		var nv = Math.max(Math.min(~~(ny * rCellSize), this.numCellsV - 1), 0);
		var idx = nv * this.numCellsH + nh;

		if (idx === oidx) return; // no need ot update, we're in the same cell
		// remove from old:
		var cell = this.cells[oidx];
		var k = cell.indexOf(item);
		if (k !== -1) cell.splice(k, 1);
		// update item:
		item.__b.cellH = nh;
		item.__b.cellV = nv;
		// add to new
		this.cells[idx].push(item);
		return this;
	}
  
	insert(item) {
		const bl = item.pos[0] - item.size;
		const br = item.pos[0] + item.size;
		const bt = item.pos[1] - item.size;
		const bb = item.pos[1] + item.size;
		const rCellSize = 1 / this.cellSize;
		// AABB bounding cells of this item:
		var cellH = Math.max(Math.min(~~(bl * rCellSize), this.numCellsH - 1), 0);
		var cellV = Math.max(Math.min(~~(bt * rCellSize), this.numCellsH - 1), 0);
		var cellH2 = Math.max(Math.min(~~(br * rCellSize), this.numCellsH - 1), 0);
		var cellV2 = Math.max(Math.min(~~(bb * rCellSize), this.numCellsH - 1), 0);
		item.__b = {
			cellH: cellH, cellV: cellV,
			cellV2: cellV2, cellH2: cellH2
		};
		var v, h, idx;
		for (v = cellV; v <= cellV2; v++) {
			for (h = cellH; h <= cellH2; h++) {
				this.cells[v * this.numCellsH + h].push(item);
			}
		}
		return this;
	}
  
	remove(item) {
		if (!item.__b) return;
		var cellH = item.__b.cellH;
		var cellH2 = item.__b.cellH2;
		var cellV = item.__b.cellV;
		var cellV2 = item.__b.cellV2;
		var v, h, k, idx;
		for (v = cellV; v <= cellV2; v++) {
			for (h = cellH; h <= cellH2; h++) {
				idx = v * this.numCellsH + h;
				k = this.cells[idx].indexOf(item);
				if (k !== -1) this.cells[idx].splice(k, 1);
			}
		}
		return this;
	}
  
	search(o, dist) {
		const pos = o.pos;
		const dist2 = dist * dist;
		// ideal search bounds:
		const bl = pos[0] - dist;
		const br = pos[0] + dist;
		const bt = pos[1] - dist;
		const bb = pos[1] + dist;
		// limited cell search bounds:
		const rCellSize = 1 / this.cellSize;
		const cellH = Math.max(~~(bl * rCellSize), 0);
		const cellH2 = Math.min(~~(br * rCellSize), this.numCellsH - 1);
		const cellV = Math.max(~~(bt * rCellSize), 0);
		const cellV2 = Math.min(~~(bb * rCellSize), this.numCellsV - 1);
		// apparently faster to name variables outside the loops
		let v, h, cell, l, n, npos, relx, rely, d2;
		let res = [];
		// might be able to speed this up by caching the set of cell offests to search for a given radius
		// (which, if arranged as a spiral, could also do a pseudo distance sort for free)
		for (v = cellV; v <= cellV2; v++) {
			for (h = cellH; h <= cellH2; h++) {
				cell = this.cells[v * this.numCellsH + h];
				l = cell.length;
				for (n = 0; n < l; n++) {
					npos = cell[n].pos;
					(relx = npos[0] - pos[0]), (rely = npos[1] - pos[1]);
					d2 = relx * relx + rely * rely;
					if (d2 <= dist2) {
						res.push(cell[n]);
					}
				}
			}
		}
		return res;
	}
}