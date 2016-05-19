/* global require, $:false, console:false, confirm:false */
"use strict";

require.config({
	paths: {
		text: 'lib/text',
		cytoscape: 'lib/cytoscape.min'
	}
});

require(['cytoscape'], function(cytoscape){
	function coseLayout() {
		cy.layout({
			name: 'cose',
			/*nodeRepulsion: function (node) {
				return node.hasClass('ownednode') ? 4000000 : 400000;
			}*/
		});
	}

	function safe(name) {
	    return name.replace(/[^a-z0-9\-_\.]|^[^a-z]+/gi, "");
	}

	function displayName(name) {
		var original = name;
		
		// remove prefixes
		name = name.replace(/(\w+:)?(seed)?/,'');
		// remove suffixes
		name = name.replace(/seedItem$/,'');
		name = name.replace(/_seeds$/,'');

		// make certain characters into spaces
		name = name.replace(/_/g, ' ');
		
		// capitolize
		name = name.substring(0, 1).toUpperCase() + name.substring(1);

		if (name.length === 0) {
			return original;
		} else {
			return name;
		}
	}

	var removed;
	/**
	 * If a view target is currently active, undoes it. Does not layout after reshowing the elements.
	 * @see target
	 */
	function untarget() {
		if (removed) {
			removed.restore(removed);
			removed = undefined;
		}
	}

	/**
	 * Adjusts the view to show only the node with the given name, and all its parents.
	 * Undoes the previous target, if any.
	 * @param  {String} name The name of the crop as defined in the mutations file.
	 */
	function target(name) {
		untarget();

		var node = cy.$('#' + safe(name));
		var edgesTo = node.predecessors().add(node);

		removed = cy.elements().difference(edgesTo).nodes().remove();
		
		cy.layout({
			name: 'breadthfirst',
			roots: node,
			animate: true,
			animationDuration: 200
		});
	}

	/**
	 * Adds a crop with the given name, as long as it does not already exist.
	 * @param  {String} name The name of the crop as defined in the mutations file.
	 */
	function tryAddCrop(name) {
		var sn = safe(name);

		if (elementSet[name] === undefined) {
			var aopt = {
				data: {
					id: sn,
					name: displayName(name)
				}
			};

			elements.push(aopt);
			elementSet[name] = aopt;

			$('<li>').attr('id', 'choose_' + sn).text(aopt.data.name).appendTo('#list').click(function () {
				target(sn);
			});
		}
	}

	/**
	 * Registers a new breeding combination
	 * @param {String} a        Name of a
	 * @param {String} b        Name of b
	 * @param {String} combined What they combine to create
	 */
	function addBreed(a, b, combined) {
		tryAddCrop(a);
		tryAddCrop(b);
		tryAddCrop(combined);

		var edge1 = {
			data: {
				source: safe(a),
				target: safe(combined)
			}
		};
		elements.push(edge1);

		var edge2 = {
			data: {
				source: safe(b),
				target: safe(combined)
			}
		};
		elements.push(edge2);
	}

	var elements = [];
	var elementSet = {};

	/**
	 * Reads a txt mutations file
	 * @param  {String} text The contents of the text file
	 * @return {Node/Edge[]}      An array of nodes and edges.
	 */
	function readMutationsAsTxt(text) {
		var LINE_PATTERN = /([\w:]+)=([\w:]+)\+([\w:]+)/;

		var lines = text.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];

			// ignore lines that are comments
			if (line[0] == '#') {
				continue;
			} else if (line.length > 0) {
				var split = line.match(LINE_PATTERN);
				if (split.length == 3 + 1) {
					var combined = split[1];
					var a = split[2];
					var b = split[3];
					
					addBreed(a, b, combined);
				}
			}
		}
	}

	/**
	 * Reads a mutations JSON description.
	 * @param  {String} text 
	 */
	function readMutationsAsJSON(text) {
		var json = JSON.parse(text);
		for (var i = 0; i < json.length; i++) {
			addBreed(json[i].parent1, json[i].parent2, json[i].result);
		}
	}

	//////////////////////
	// Create the graph //
	//////////////////////
	var cy = cytoscape({
		container: document.getElementById('cy'), // container to render in

		elements: [],

		style: [ // the stylesheet for the graph
			{
				selector: 'node',
				style: {
					'background-color': '#666',
					'label': 'data(name)'
				}
			},
			{
				selector: 'edge',
				style: {
					'width': 5,
					'line-color': '#ccc',
					'target-arrow-size': '5',
					'target-arrow-color': '#ccc',
					'target-arrow-shape': 'triangle'
				}
			},
			{
				selector: '.parentnode',
				style: {
					'background-color': 'red'
				}
			},
			{
				selector: '.parentedge',
				style: {
					'line-color': 'red',
					'target-arrow-color': 'red',
				}
			},
			{
				selector: '.childnode',
				style: {
					'background-color': 'blue',
				}
			},

			{
				selector: '.childedge',
				style: {
					'line-color': 'blue',
					'target-arrow-color': 'blue'
				}
			},

			{
				selector: '.selectednode',
				style: {
					'background-color': 'white',
					'border-color': '#DEC417',
					'border-width': '5px'
				}
			},

			{
				selector: 'node.ownednode',
				style: {
					'background-color': '#EEE',
					'color': '#888',
					'shape': 'diamond'
				}
			},

			{
				selector: 'edge.ownededge',
				style: {
					'opacity': 0.5,
					'line-style': 'dashed'
				}
			}
		]
	});

	coseLayout();

	// style nodes without any predecessors as italics
	function markUnimportantNodes() {
		cy.nodes().forEach(function (node) {
			if (node.predecessors().size() === 0) {
				$('#choose_' + node.id()).addClass('unimportant');
			}
		});
	}

	/////////////////////////
	// Add event listeners //
	/////////////////////////
	cy.on('mouseover', 'node', function(e) {
		var node = e.cyTarget;
		node.addClass('selectednode');
		
		var to = node.outgoers();
		to.edges().addClass('childedge');
		to.nodes().addClass('childnode');

		var frome = node.incomers();
		frome.nodes().addClass('parentnode');
		frome.edges().addClass('parentedge');
	});

	function clearHighlights() {
		cy.nodes().removeClass('selectednode childnode parentnode');
		cy.edges().removeClass('childedge parentedge');
	}

	var owned = {};

	function setOwnedNode(node, isowned) {
		node.toggleClass('ownednode', isowned);
		if (isowned) {
			node.incomers().edges().addClass('ownededge');
		} else {
			node.incomers().edges().removeClass('ownededge');
		}

		if (owned[currentSet.name] === undefined) {
			owned[currentSet.name] = {};
		}

		if (isowned) {
			owned[currentSet.name][node.id()] = true;
		} else {
			delete owned[currentSet.name][node.id()];
		}

		if (localStorage) {
			localStorage.cropsowned = JSON.stringify(owned);
		}
	}

	function markOwnedNodes() {
		cy.nodes().forEach(function (node) {
			if (owned[currentSet.name] && owned[currentSet.name][node.id()] === true) {
				setOwnedNode(node, true);
			}
		});
	}



	var holding = false;
	cy.on('cxttapstart', 'node', function(e) {
		holding = true;

		var node = e.cyTarget;
		setOwnedNode(node, !node.hasClass('ownednode'));
	});

	cy.on('cxttapend', 'node', function() {
		holding = false;
	});

	cy.on('tap', 'node', function(e) {
		if (!holding) {
			clearHighlights(e);
			target(e.cyTarget.id());
		}
	});

	cy.on('mouseout', 'node', clearHighlights);

	$('#btnReset').click(function () {
		untarget();

		coseLayout();
	});

	var currentSet;
	var sets = {
		agrarianSkies2: {
			name: "AgriCraft 1.7.10 + Agrarian Skies 2",
			load: function (callback) {
				require(['text!mutations/Mutations_AS2.txt'], function (Mutations_TXT) {
					readMutationsAsTxt(Mutations_TXT);
					callback();
				});
			}
		},

		v_1_7_10: {
			name: "AgriCraft 1.7.10",
			load: function (callback) {
				require(['text!mutations/Mutations_v1.7.10.txt'], function (Mutations_TXT) {
					readMutationsAsTxt(Mutations_TXT);
					callback();
				});
			}
		},

		v1_8_9: {
			name: 'AgriCraft 1.8.9 (Alpha)',
			load: function (callback) {
				require(['text!mutations/mutations_v1.8.9.json'], function (Mutations_JSON) {
					readMutationsAsJSON(Mutations_JSON);
					callback();
				});
			}
		}
	};

	function loadSet(set) {
		currentSet = set;

		if (localStorage && localStorage.cropsowned !== undefined) {
			owned = JSON.parse(localStorage.cropsowned);
		}

		$('#packTitle').text(set.name);
		$('#list').empty();

		cy.remove('*');
		removed = undefined;
		elements = [];
		elementSet = {};

		set.load(function () {
			cy.add(elements);

			markUnimportantNodes();
			markOwnedNodes();

			coseLayout();
		});
	}

	for (var key in sets) {
		if (sets.hasOwnProperty(key)) {
			$('<option>').text(sets[key].name).attr('value', key).appendTo('#selectMode');
		}
	}

	loadSet(sets.agrarianSkies2);

	$('#selectMode').change(function () {
		console.log("Loading set", $(this).val());
		loadSet(sets[$(this).val()]);
	});

	$('#btnClearOwned').click(function () {
		if (confirm("Are you sure you want to reset all crops marked as owned?")) {
			var set = cy.nodes();
			if (removed) {
				set = set.union(removed);
			}
			set.forEach(function (node) {
				setOwnedNode(node, false);
			});

			localStorage.cropsowned = '{}';
		}
	});
});
