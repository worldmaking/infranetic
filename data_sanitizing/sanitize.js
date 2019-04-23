
const express = require('express');
const WebSocket = require('ws');

const http = require('http');
const url = require('url');
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

let name = "all";
let elements = JSON.parse(fs.readFileSync(path.join("data", name + ".raw.json"), "utf8")).elements;

// we want to convert the lon,lat coordinates into something approximating meters
// 

// The haversine formula determines the great-circle distance between two points on a sphere given their longitudes and latitudes.
// Explanation: https://en.wikipedia.org/wiki/Haversine_formula
function haversine(lon1, lat1, lon2, lat2){  
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000; // meters
}

function approximate_meters_from(lon2, lat2) {  
    return function(lon1, lat1) {
		let dlon = haversine(lon1, lat1, lon2, lat1);
		let dlat = haversine(lon1, lat1, lon1, lat2);
		if (lon1 < lon2) dlon = -dlon;
		if (lat1 > lat2) dlat = -dlat;
		return [dlon, dlat];
	}
}

// try like this:
let approximate_meters_from_centre = approximate_meters_from(126.8086948, 35.1767651);



let skipkeys = {
	'is_in:continent': true,
	'is_in:country': true,
	'is_in:country_code': true,
	is_in: true,
	name: true,
	'aerialway:heating': true,
	'aerialway:occupancy': true,
	"name:en": true,
	"name:ko": true,
	'name:ko-Latn': true,
	"name:ja": true,
	"name:zh": true,
	'name:de': true,
	'name:ko_rm': true,
	'name:es': true,
	'name:jam': true,
	'name:vi': true,
	'name:af': true,
	'name:ar': true,
	'name:bg': true,
	'name:bi': true,
	'name:ca': true,
	'name:cs': true,
	'name:da': true,
	'name:el': true,
	'name:eo': true,
	'name:et': true,
	'name:eu': true,
	'name:fa': true,
	'name:fi': true,
	'name:fr': true,
	'name:he': true,
	'name:ht': true,
	'name:id': true,
	'name:io': true,
	'name:it': true,
	'name:kl': true,
	'name:la': true,
	'name:lt': true,
	'name:mi': true,
	'name:mn': true,
	'name:mr': true,
	'name:ms': true,
	'name:nl': true,
	'name:no': true,
	'name:oc': true,
	'name:pl': true,
	'name:pt': true,
	'name:ro': true,
	'name:ru': true,
	'name:sr': true,
	'name:sv': true,
	'name:sw': true,
	'name:th': true,
	'name:tl': true,
	'name:tr': true,
	'name:uk': true,
	'name:vo': true,
	official_name: true,
	'official_name:zh': true,
	'official_name:ko': true,
	'official_name:ja': true,
	'official_name:en':  true,
	'old_name:en': true,
	alt_name: true,
	noname: true,
	name_1: true,
	start_date: true,
	'operator:en': true,
	'addr:street': true,
	'alt_name:ko': true,
	email: true,
	website: true,
	operator: true,
	phone: true,
	opening_hours: true,
	'addr:housenumber': true,
	'addr:city': true,
	'addr:postcode': true,
	'payment:credit_cards': true,
	'payment:cash': true,
	'payment:coins': true,
	'internet_access:fee': true,
	'addr:neighbourhood': true,
	iata: true,
	icao: true,
	local_ref: true,
	'addr:unit': true,
	max_age: true,
	min_age: true,
	population: true,
	'population:date': true,
	'source:name:oc': true,
	'source:population': true,
	'fuel:diesel': { yes: 5 },
	'fuel:gasoline': { yes: 5 },
	description: true,
	note: true,
	designation: true,
	colour: true,
	ref: true,
	noref: true,
	review: true,
	source: true,
	ncat: true,
	'ncat:bridge': true,
	'ncat:tunnel': true,
	wikipedia: true,
	'wikipedia:en': true,
	wikidata: true,
	bridge_name: true,
	'bridge:name': true,
	'bridge:name:en': true,
	'bridge:name:ko': true,
	'bridge:name:ko-Latn': true,
	'tunnel:name': true,
	'tunnel:name:en': true,
	'tunnel:name:ko-Latn': true,
	'naptan:Bearing': true,
	user_defined: true,
	'payment:bitcoin': true,
	unisex: true,
	fixme:true,
	fax: true,
	'contact:facebook': true,
	'contact:instagram': true,
	leaf_cycle: true,
	leaf_type: true,
	covered: true,
	maxheight: true,
	payment: true,
	brand: true,
	'brand:wikidata': true,
	'brand:wikipedia': true,
	capacity: true,
	clothes: true,
	'internet_access:ssid': true,
	'payment:현금_또는_카드': true,
	toll: true,
	frequency: true,
	gauge: true,
	voltage: true,
	tracktype: true,
	'railway:traffic_mode': true,
	'source:tunnel': true,
	segregated: true,
	cons: true,
	intermittent: true,
	cutting: true,
	horse: true,
	wheelchair: true,
	motorcycle: true,
	location: true,
	lit: true,
	sport: true,
	sac_scale: true,
	trail_visibility: true,
	vehicle: true,
	'maxspeed:type': true,
	step_count: true,
	gondola: true,
	motor_vehicle: true,
	// oneway: true,
	// maxspeed: true,
	// tracks: true,
	foot: true,
	sidewalk: true,
	'source:bridge': true,
	usage: true,
	embankment: true,
	access: true,
	incline: true,

	// areas:
	dispensing: true,
	internet_access: true,
	emergency: true,
  	smoking: true,
 
	denomination: true,
  	religion: true,
  
  	delivery: true,
	takeaway: true,
	drive_through: true,
	recycling_type: true,
	outdoor_seating: true,
	fee: true,
	inscription: true,
	hoops: true,
	fence_type: true,
	park_ride: true,
	supervised: true,
	bicycle: true,
	maxstay: true,
	diaper: true,
	'generator:method': true,
	'generator:output:electricity':true,
	'generator:source': true,
	'generator:type': true,
	golf: true,
	landuse_1: true,
	'social_facility:for': true,
	'operator:type': true,
	barrier: true,
	'roof:levels': true,
	atm: true,
	
};

function mergekinds(tags, kinds) {
	for (let k in tags) {
		let v = tags[k];
		if (!kinds[k]) {
			kinds[k] = { 
				TOTAL: 1,
				PAIRS: {}
			};
		} else {
			kinds[k].TOTAL++;
		}
		if (!kinds[k][v]) {
			kinds[k][v] = 1;
		} else {
			kinds[k][v]++;
		}

		for (let j in tags) {
			if (j == k) continue;
			if (!kinds[k].PAIRS[j]) {
				kinds[k].PAIRS[j] = 1;
			} else {
				kinds[k].PAIRS[j]++;
			}
		}
	}
}

let ways = [];
let buildings = [];
let areas = [];
let nodes = {};

let waykinds = {};
let buildingkinds = {};
let areakinds = {};
let nodekinds = {};

let nodes_referenced = {};


let all_ids = {};

// get a list of all the node ids:
for (let e of elements) {
	if (e.type == "node") {
		all_ids[e.id] = "node";
	} else {
		all_ids[e.id] = "way";
	}
}

for (let e of elements) {

	let tags = e.tags;
	let kind;

	// delete all skippable keys:
	if (tags) {
		for (let k in skipkeys) {
			delete e.tags[k];
		}
	}

	if (e.type == "way") {
		let numnodes = e.nodes.length;
		let first = e.nodes[0];
		let last = e.nodes[numnodes-1];
		let isloop = first == last;

		// is this an area, rather than a way?
		if (tags && isloop 
			&& !tags.highway
			&& !(tags.leisure == "track")
			&& !(tags.aeroway == "taxiway")
			&& !(tags.railway == "rail")) {
			
			// skip some unusable entries:
			if (tags.leisure == "yes"
		 	|| tags.amenity == "parking_space"
			|| tags.amenity == "water_point"
			|| tags.barrier == "fence"
			) continue;

			// fix some bugs:
			if (tags.high) {
				tags.height = tags.high;
				delete tags.high;
			}
			if (tags['building:level']) {
				tags.height = tags['building:level'];
				delete tags['building:level'];
			}
			if (tags['building:levels']) {
				tags.height = tags['building:levels'];
				delete tags['building:levels'];
			}
			if (tags.service == "repair") {
				tags.shop = "repair";
				delete tags.service;
			}
			if (tags.attraction) {
				tags.tourism = tags.attraction;
				delete tags.attraction;
			}

			
			// if (tags.natural == "water") {
			// 	kind = "waterarea";
			// }

			// power buildings:
			if (tags.power) {
				kind = "power";
				tags.building = "power";
				delete tags.substation;
				delete tags.landuse;
				delete tags.building;
			}
			if (tags.industrial == "electrical") {
				kind = "power";
				tags.power = "industrial";
				delete tags.industrial;
			}


			if (tags.bridge) {
				tags.building = tags.bridge;
				delete tags.bridge;
			}
			if (tags.school) {
				tags.building = tags.school;
				delete tags.school;
			}

			//"amenity": "school", tags.office == "educational_institution"
			// "landuse": "commercial", "office": "educational_institution"

			
			if (tags.information == "office") {
				tags.office = "touristinformation";
				delete tags.information;
			}
			if (tags.office) {
				tags.building = "office";
				delete tags["building:levels"];
				delete tags.level;
				delete tags.area;
				delete tags.government;
				if (tags.office == "yes") delete tags.office;
			}

			if (tags["leisure"] == "stadium") {
				tags.building = "stadium";
			}
			if (!tags.building && tags.amenity) {
				tags.building = tags.amenity;
			}
			if (!tags.building && tags.railway) {
				tags.building = tags.railway;
			}
			if (!tags.building && tags.public_transport) {
				tags.building = tags.public_transport;
			}

			if (!tags.building && tags.man_made && tags.man_made != "bridge") {
				tags.building = tags.man_made;
			}

			if (tags.leisure == "ice_rink"
				|| tags.leisure == "fitness_centre"
				|| tags.leisure == "swimming_pool"
				|| tags.leisure == "sports_centre") {
				if (!tags.building) tags.building = "leisure";
			}
			if (!tags.building && tags.tourism == "museum") {
				tags.building = "museum";
			}
			if (!tags.building && tags.shop) {
				tags.building = "shop";
			}
			if (!tags.building && tags.parking) {
				tags.building = "parking";
			}

			if (tags.building == "yes") {
				if (tags.amenity) {
					tags.building = tags.amenity;
				} else if (tags.public_transport) {
					tags.building = "public_transport";
				} else if (tags.railway) {
					tags.building = "public_transport";
				} else if (tags.aerialway) {
					tags.building = "public_transport";
				} else if (tags.tourism) {
					tags.building = tags.tourism;
				} else if (tags.leisure) {
					tags.building = tags.leisure;
				} else if (tags.historic) {
					tags.building = tags.historic;
				} else if (tags.aeroway) {
					tags.building = "aeroway";
				} else if (tags.shop) {
					tags.building = "shop";
				} else if (tags.place) {
					tags.building = tags.place;
				} else if (tags.healthcare) {
					tags.building = "healthcare";
				} else if (tags.craft) {
					tags.building = "craft";
				} else if (tags.toilets) {
					tags.building = "toilets";
					delete tags.toilets;
				}
				// "man_made": "works"
				// man_made: wastewater_plant:
				// product: food
			}

			// mark all nodes used:
			let safenodes = [];
			for (let n of e.nodes) {
				if (all_ids[n]) {
					nodes_referenced[n] = true;
					safenodes.push(n);
					if (all_ids[n] != "node") {
						console.log('wrong id', n, all_ids[n])
					}
				} else {
					//console.log('missing id', n)
				}
			}

			if (tags.building) {

				if (tags.building == "apartments") {
					kind = "homes";

				} else if (tags.building == "works"
					|| tags.building == "office"
					|| tags.shop) {
					kind = "works";

						
				} else if (tags.leisure
					|| tags.tourism
					|| tags.building == "university"
					|| tags.building == "school"
					|| tags.building == "kindergarten") {
					kind = "culture";

				} else if (tags.building == "yes") {
					continue;
					
				} else {

					//console.log(tags);
					//break;
				}

				mergekinds(tags, buildingkinds);

				buildings.push({
					//kind: kind,
					tags: tags,
					//id: e.id,
					nodes: safenodes,
				});
			} else {

				if (tags.natural == "water"
				|| tags.natural == "wetland"
				|| tags.waterway) {
					kind = "water";
					delete tags.natural;


				} else if (tags.natural == "grassland" 
				|| tags.natural == "heath" 
				|| tags.natural == "fell" 
				|| tags.wetland == "marsh"
				|| tags.landuse == "grass"
				|| tags.landuse == "farmland"
				|| tags.landuse == "farmyard"
				|| tags.landuse == "allotments"
				|| tags.landuse == "greenfield"
				|| tags.place == "farm"
				|| tags.landuse == "meadow"
				|| tags.landuse == "cemetery"
				|| tags.leisure == "park"
				|| tags.leisure == "garden"
				|| tags.leisure == "pitch"
				|| tags.leisure == "golf_course"
				|| tags.leisure == "miniature_golf") {
					kind = "grass";

				} else if (tags.landuse == "forest"
				|| tags.landuse == "orchard"
				|| tags.natural == "wood") {
					kind = "trees";
					
				} else if (tags.natural == "sand"
				|| tags.leisure == "playground"
				|| tags.leisure == "fitness_station"
				|| tags.landuse == "military"
				|| tags.military
				|| tags.landuse == "construction"
				|| tags.landuse == "railway") {
					kind = "sand";

				} else if (tags.landuse == "industrial"
				|| tags.landuse == "commercial"
				|| tags.landuse == "greenhouse_horticulture"
				|| tags.landuse == "garages"
				|| tags.aeroway
				|| tags.landuse == "retail"
				|| tags.power) {
					kind = "works";

				} else if (tags.landuse == "residential") {
					kind = "homes";
					
				} else if (tags.historic
					|| tags.tourism
					|| tags.landuse == "religious") {
					kind = "culture";
					
					
				} else {

					//console.log(tags)
					continue;
				}

				mergekinds(tags, areakinds);

				areas.push({
					kind: kind,
					tags: tags,
					//id: e.id,
					nodes: safenodes,
				});
			}
			

		} else if (tags) {
			// skip ways that are not really ways
			if (tags.barrier
				|| tags.handrail
				|| tags.admin_level
				|| tags.construction
				|| tags['construction:railway']
				|| tags.building == "yes") {
				// skip these items
				continue;
			}
			if (tags.railway == "construction") continue;
			if (tags.highway == "construction") continue;
			if (tags.natural == "tree_row") continue;

			for (let k in tags) {
				if (tags[k] == "no") {
					delete tags[k];
				}
			}
			delete tags.bicycle;

			// way kinds:
			// pathway
			// highway
			// railway
			// waterway
			// powerway

			let kind = undefined;

			if (tags.railway) {
				kind = "railway";
				delete tags.tracks;
			} else if (tags.waterway) {
				kind = "waterway";
				delete tags.highway;
			} else if (tags.power) {
				delete tags.power;
				kind = "powerway";
				delete tags.cables;
				//delete tags.circuits;
				delete tags.line;
			} else if (tags.aeroway) {
				kind = "pathway";
				
			} else if (tags.highway) {

				delete tags.service;
				//delete tags.surface;
				// distinguish foot/cycle paths from car highways?
				if (tags.highway == "pedestrian"
					|| tags.highway == "footway"
					|| tags.highway == "bridleway"
					|| tags.highway == "cycleway"
					|| tags.highway == "steps"
					|| tags.highway == "path") {
					kind = "pathway";

				} else {
					kind = "highway";
				}
			} else if (tags.leisure == "track"
			|| tags.aerialway) {
				kind = "pathway";

			} else {
				// nothing gets here
				continue;
			}

			mergekinds(tags, waykinds);

			// mark all nodes used:
			let safenodes = [];
			for (let n of e.nodes) {
				if (all_ids[n]) {
					nodes_referenced[n] = true;
					safenodes.push(n);
					if (all_ids[n] != "node") {
						console.log('wrong id', n, all_ids[n])
					}
				} else {
					//console.log('missing id', n)
				}
			}
			if (safenodes.length > 1) {
				ways.push({
					kind: kind,
					tags: tags,
					id: e.id,
					nodes: safenodes,
				});
			}
		} else {
			//console.log("mysterious looped way with no tags");
			continue;
		}

	} else if (e.type == "node") {
		// even a single node can be a building:
		
		let tags = e.tags;
		if (!tags) continue;
		if (tags.amenity) {
			tags.building = tags.amenity;
		} else if (tags.station) {
			tags.building = "public_transport";
		}else if (tags.shop) {
			tags.building = "shop";
		}

		if (tags.building) {
			nodes_referenced[e.id] = true;
			buildings.push({
				//kind: kind,
				tags: tags,
				//id: e.id,
				nodes: [e.id],
			});
		}
	}
}

let meters_min = [0, 0];
let meters_max = [0, 0];

for (let e of elements) {
	if (e.type == "node") {
		if (!nodes_referenced[e.id]) continue;

		
		let meters = approximate_meters_from_centre(e.lon, e.lat);
		meters_min[0] = Math.min(meters_min[0], meters[0]);
		meters_max[0] = Math.max(meters_max[0], meters[0]);
		meters_min[1] = Math.min(meters_min[1], meters[1]);
		meters_max[1] = Math.max(meters_max[1], meters[1]);

		e.meters = meters;

	}
}

// expand it very slightly:
let meters_dim = [meters_max[0] - meters_min[0], meters_max[1] - meters_min[1]];
let meters_extend = [meters_dim[0] * 0.02, meters_dim[1] * 0.01];
meters_min[0] -= meters_extend[0];
meters_min[1] -= meters_extend[1];
meters_max[0] += meters_extend[0];
meters_max[1] += meters_extend[1];

for (let e of elements) {
	if (e.type == "node") {
		if (!nodes_referenced[e.id]) continue;

		if (e.tags) {
			mergekinds(e.tags, nodekinds);
		}
		
		// rebase the meters:
		e.meters[0] -= meters_min[0];
		e.meters[1] -= meters_min[1];

		//break;
		//nodes[e.id] = [e.lon, e.lat];
		nodes[e.id] = e.meters;
		
	}
}

// rebase here too:
meters_max[0] -= meters_min[0];
meters_max[1] -= meters_min[1];
meters_max[0] = Math.floor(meters_max[0]);
meters_max[1] = Math.floor(meters_max[1]);

meters_dim = meters_max;

console.log(meters_dim);


nodes.bounds = meters_max;


let kinds = {
	ways: waykinds,
	areas: areakinds,
	nodes: nodekinds,
}

//console.log(buildingkinds);
//console.log(areakinds);
//console.log(waykinds);
//console.log(nodekinds);

// function count_list(dst, list) {
// 	for (let e of list) {
// 		let k = e.kind;
// 		if (!dst[k]) {
// 			dst[k] = e.nodes.length;
// 		} else {
// 			dst[k] += e.nodes.length;
// 		}
// 	}
// 	return dst;
// }
// let waycounts = count_list({}, ways);
// console.log(waycounts);


// fs.writeFileSync(path.join("data", name + ".ways.sanitized.min.json"), JSON.stringify(ways), "utf8")
// fs.writeFileSync(path.join("data", name + ".ways.sanitized.json"), JSON.stringify(ways, null, 2), "utf8")


// fs.writeFileSync(path.join("data", name + ".buildings.sanitized.min.json"), JSON.stringify(buildings), "utf8")
// fs.writeFileSync(path.join("data", name + ".buildings.sanitized.json"), JSON.stringify(buildings, null, 2), "utf8")


// fs.writeFileSync(path.join("data", name + ".areas.sanitized.min.json"), JSON.stringify(areas), "utf8")
// fs.writeFileSync(path.join("data", name + ".areas.sanitized.json"), JSON.stringify(areas, null, 2), "utf8")


// fs.writeFileSync(path.join("data", name + ".nodes.sanitized.min.json"), JSON.stringify(nodes), "utf8")
// fs.writeFileSync(path.join("data", name + ".nodes.sanitized.json"), JSON.stringify(nodes, null, 2), "utf8")


let everything = {
	bounds: nodes.bounds,
	nodes: nodes,
	ways: ways,
	areas: areas,
	buildings: buildings,
}
delete nodes.bounds;


fs.writeFileSync(path.join("data", name + ".everything.sanitized.min.json"), JSON.stringify(everything), "utf8")
fs.writeFileSync(path.join("data", name + ".everything.sanitized.json"), JSON.stringify(everything, null, 2), "utf8")