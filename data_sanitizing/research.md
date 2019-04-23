
## Street data

Gwangju: 35.1768202,126.7737603
ACC: 35.146,126.917

Openstreetmap.org has street map coverage of Gwangju.
It has an open API for read-only access to the data at https://wiki.openstreetmap.org/wiki/Overpass_API

The OSM data ontology has these kinds of objects:
- node (a single point, with ID and metadata)
- way (refer to lists of nodes; represent roads, and also boundary regions e.g. park edges)
- relation (inter-relations between certain nodes & ways)

Live query editor:
http://overpass-turbo.eu

API endpoint:
https://overpass-api.de/api/interpreter

Docs:
https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example

Also see http://osmlab.github.io/learnoverpass/en/docs/block-queries/union/

multiple statements (terminating with ";")
statements are node, way, rel, or out.
union of queries by "(...)"



```
/* whole city */
[out:json]; area[name = "광주"]->.a; (node(area.a);way(area.a);); out body;
```

https://www.overpass-api.de/api/interpreter?data=[out:json];area[name="광주"]->.a;(node(area.a);way(area.a););out;

https://www.overpass-api.de/api/interpreter?data=[out:json];area[name=%22%EA%B4%91%EC%A3%BC%22]-%3E.a;(node(area.a);way(area.a););out;

https://www.overpass-api.de/api/interpreter?data=[out:json];area[name="광주"];(node(area);way(area););out;

```
https://www.overpass-api.de/api/interpreter?data=[out:json];(node(35.1,126.78,35.25,126.94);way(35.1,126.78,35.25,126.94););out%20body;

```
// nodes & ways around ACC:
(node(35.14,126.91,35.16,126.93);way(35.14,126.91,35.16,126.93););out body;
```

https://www.overpass-api.de/api/interpreter?data=[out:json];(node(35.12,126.85,35.20,126.93);way(35.12,126.85,35.20,126.93););out%20body;

https://www.overpass-api.de/api/interpreter?data=[out:json];(node(35.14,126.91,35.16,126.93);way(35.14,126.91,35.16,126.93););out%20body;


( area[name="United Kingdom"]; )->.a;

[out:json]; area[name = "Gwangju"]; ( node(area);); out body;
