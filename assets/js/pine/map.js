/**
 * Drawing the Map
 * 
 * https://github.com/Open-RPG/open-rpg
 * 
 * License: GNU GENERAL PUBLIC LICENSE
 */

 define(["main", "sheetengine", "tree"],function(Main, sheetengine, Tree){

 	var Map = {
		// Config options
		initied : false,
		densityMap : null,
		drawFlag : true,
		redrawFlag : false,
		redrawInterval : null,
		boundary : {},
		currentCenter : {x:0,y:0},
		currentClusterBoundary : {},
		sheets : [],
		staticQueue : [],
		objects: [],
		requestSize: 4
	};
	
	/**
	 * Set up the map and main character 
	 */
	 Map.init = function(){		
		Map.listenSocket();
		
		Map.setCenter(Main.characterCoords);
		Map.currentClusterBoundary = {xmin:100000,xmax:1000000,ymin:100000,ymax:1000000};
		
		Map.loadAndRemoveSheets(Map.coordsGlobalToCluster(Main.characterCoords));
		
		Map.densityMap = new sheetengine.DensityMap(5);
		
		// Now we set up the interval for the redraw method
		// Read the description of the redraw method for more info
		Map.redrawInterval = setInterval(function(){
			if(!Map.redrawFlag) return;
			// Flag was set to true, redraw and reset flag
			Map.redrawFlag = false;
			
			sheetengine.calc.calculateChangedSheets();
			sheetengine.drawing.drawScene();
			
			// Execute the static queue
			Map.executeStaticQueue();

		}, 30);
	};

	
	/**
	 * Transform a pair of real coordinates (i.e. mouse coordinates)
	 * into the game system coordinates (relative to the map center)
	 * @param {Object} Real life coordinates {x:_,y:_}
	 * @returns {Object} An object with the coordinates {x:_,y:_}
	 */
	 Map.coordsRealToGame = function(coords){
	 	var pxy = sheetengine.transforms.inverseTransformPoint({u:coords.y+sheetengine.scene.center.u, v:coords.x+sheetengine.scene.center.v});
	 	pxy.x = (pxy.x - sheetengine.scene.center.x) / Map.zoomLevel + sheetengine.scene.center.x;
	 	pxy.y = (pxy.y - sheetengine.scene.center.y) / Map.zoomLevel + sheetengine.scene.center.y;
	 	return pxy;
	 };

	/**
	 * Transform a point in the game to a canvas point.
	 * @param {Object} A point in the game {x,y,z}
	 * @return {Object} A canvas coordinate object {u,v}
	 */
	 Map.coordsGameToCanvas = function(point){
	 	return sheetengine.drawing.getPointuv(point);
	 };

	
	 Map.coordsGlobalToCluster = function(point){
	 	var clusterCoords = {} ;
	 	clusterCoords.x = Math.round(point.x/200);
	 	clusterCoords.y = Math.round(point.y/200);
	 	return clusterCoords;
	 };

	/**
	 * sheetengine allows to draw directly on the canvas,
	 * but we have to redraw everything everytime sheetengine redraws.
	 * So to make it easier we use the staticQueue. It will be a list of functions
	 * that are executed everytime the canvas is redrawn.
	 * Each of those functions should draw something on the canvas.
	 * @param {Object} Array key, username for example
	 * @param {function} A function to be executed
	 */
	 Map.addToStaticQueue = function(id, fn){
	 	Map.staticQueue[id] = fn;
	 };

	/**
	 * Removes an element from the static queue
	 * @param {Object} Array key, username for example
	 */
	 Map.removeFromStaticQueue = function(id){
	 	delete Map.staticQueue[id];
	 };

	/**
	 * This executes the functions stored in the queue (if any)
	 * Should only be called from the draw functions. 
	 */
	 Map.executeStaticQueue = function(){
		// Using for..in because indixes might not be numbers
		for(var index in Map.staticQueue) {
			Map.staticQueue[index]();
		}
	};
	
	/**
	 * Redraw changed sheets
	 * Redrawing is a very expensive operation, so it will be done on a fixed time.
	 * If the redraw function is called, it will set the redraw flag to true.
	 * An interval will check for the flag every fixed time and redraw if necessary,
	 * this way when many people move it will only draw every fixed time, improving 
	 * performance.
	 */
	 Map.redraw = function(){
	 	Map.redrawFlag = true;
	 };

	/**
	 * Draw scene from scratch
	 */
	 Map.draw = function(){
		// Check flag, this way we ensure it is only drawn once.
		if(!Map.drawFlag) return false;
		Map.drawFlag = false;
		
		sheetengine.calc.calculateAllSheets();
		sheetengine.drawing.drawScene(true);
		
		console.log("Drawing the whole scene");
	};
	
	/**
	 * Add sheets to the density map for collision detection 
	 * @param {Object} Sheets to be added
	 */
	 Map.addToDensityMap = function(sheets){
	 	Map.densityMap.addSheets(sheets);
	 };
	 
	 /**
	 * Remove sheets from the density map for collision detection 
	 * @param {Object} Sheets to be added
	 */
	 Map.removeFromDensityMap = function(sheets){
	 	Map.densityMap.removeSheets(sheets);
	 };


	/**
	 * Set the center of the scene to the one given by parameter.
	 * 
	 * @param {Object} A point in the game {x,y,z}
	 */
	Map.setCenter = function(point){

	 	//The z position of the scene will allways be 0
	 	//so when the character jump the center of the scene
	 	//don't go up and down
	 	
	 	point.z = 0;
	 	sheetengine.scene.setCenter(point);
	 	Map.currentCenter = point;
	 };

	/**
	 * Set the area where the user can walk whithout having to
	 * load a new yard
	 * @param {object} the relative center of the actual yard {x,y,z}
	 */
	 Map.setBoundary = function(position) {
		// for boundary we use relative yard coordinates
		var radius = 0.75;
		Map.boundary = {
			xmin: (position.x - radius) * 200,
			ymin: (position.y - radius) * 200,
			xmax: (position.x + radius) * 200,
			ymax: (position.y + radius) * 200
		};
		//console.log("boundary x:"+position.x+" y:"+position.y);
	};


	/**
	 *Check if the position is out of the actual boundary
	 *
	 *@param {object} the position to check {x,y,z}
	 *@return boolean true if the user is out, false if is not
	 */
	 Map.checkBoundaries = function(position){
		//console.log("check x:"+position.x+" y:"+position.y);
		//console.log("boundary xmin:"+Map.boundary.xmin+" xmax:"+Map.boundary.xmax+" ymin:"+Map.boundary.ymin+" ymax"+Map.boundary.ymax);
		if (position.x >= Map.boundary.xmin &&
			position.y >= Map.boundary.ymin &&
			position.x <= Map.boundary.xmax &&
			position.y <= Map.boundary.ymax) 
			return false;
		return true;
	};

	function initBaseSheet(basesheets){
		var map = [];
		
		for(var i=0;i<basesheets.length;i++){

			map.push({

				centerp: basesheets[i].centerp,
				orientation: {alphaD: 90, betaD: 0, gammaD: 0},
				size: {w:200,h:200},
				color: basesheets[i].color,
				init: function() { 
					var basesheet = new sheetengine.BaseSheet(this.centerp, this.orientation, this.size);
					basesheet.color = this.color;
					return basesheet;
				}
			});
		}
		return map;
	}

	Map.loadAndRemoveSheets = function(centertile, dir) {
		
		console.log("Load and Remove for ",centertile);
		
		var coordinates = {x: centertile.x*200,y: centertile.y*200};
		
		// Request coordinates, based on dir
		switch(dir){
			case 0:
				coordinates.y += Map.requestSize*200;
				break;
			case 90:
				coordinates.x += Map.requestSize*200;
				break;
			case 180:
				coordinates.y -= Map.requestSize*200;
				break;
			case 270:
				coordinates.x -= Map.requestSize*200;
				break;
		}
				
		// Request new area
		Main.socket.emit('map', {coordinates: coordinates,size:{w:Map.requestSize*400,h:Map.requestSize*400} });
	};
	
	// Listen in the socket for new sheets
	Map.listenSocket = function(){
		// Parse received sheets
		Main.socket.on('map',function(data){
			
			/*var centertile = {
				x: data.coordinates.x/200,
				y: data.coordinates.y/200
			};*/
			
			var centertile = {
				x: Math.round(Map.currentCenter.x/200),
				y: Math.round(Map.currentCenter.y/200)
			};
			
			console.log("Current centertile:", centertile);
			
			console.log("Received new sheets");
			
			var map = initBaseSheet(data.basesheets);
			
			var halfSizeClusterSide = Map.requestSize,
			clusterBoundary = {
				xmin: (centertile.x - halfSizeClusterSide)*200 + 100,
				xmax: (centertile.x  + halfSizeClusterSide)*200 + 100,
				ymin: (centertile.y + halfSizeClusterSide)*200 + 100,
				ymax: (centertile.y - halfSizeClusterSide)*200 + 100
			};
			
			// remove sheets that are far
			for (var i=0;i<Map.sheets.length;i++) {
				var sheetinfo = Map.sheets[i].basesheet;
				//console.log("clusterBoundary: ",clusterBoundary," Sheetinfo: ", sheetinfo);
				if (sheetinfo.centerp.x < clusterBoundary.xmin || sheetinfo.centerp.x > clusterBoundary.xmax || sheetinfo.centerp.y < clusterBoundary.ymin || sheetinfo.centerp.y > clusterBoundary.ymax) {
					Map.sheets[i].basesheet.color = '#FF0000';
					//Map.sheets[i].basesheet.destroy();
				}
			}
			
			// remove objects that are far
			for (var i=0;i<Map.objects.length;i++) {
				var sheetinfo = Map.objects[i];
				//console.log("clusterBoundary: ",clusterBoundary," Sheetinfo: ", sheetinfo);
				if (sheetinfo.center.x < clusterBoundary.xmin || sheetinfo.center.x > clusterBoundary.xmax || sheetinfo.center.y < clusterBoundary.ymin || sheetinfo.center.y > clusterBoundary.ymax) {
					Map.objects[i].sheets[0].destroy();
					Map.objects[i].sheets[1].destroy();
					Map.removeFromDensityMap(Map.objects[i].sheets);
				}
			}
	
	        //console.log("currentBoundary{ xmin:"+currentBoundary.xmin+" xmax:"+currentBoundary.xmax+" ymin:"+currentBoundary.ymin+" ymax:"+currentBoundary.ymax);
	        
	        // Add new sheets
	        for (var i=0;i<map.length;i++) {
	        	var sheetinfo = map[i];
		         if(sheetinfo.centerp.x < Map.currentClusterBoundary.xmin ||
		         	sheetinfo.centerp.x > Map.currentClusterBoundary.xmax ||
		         	sheetinfo.centerp.y < Map.currentClusterBoundary.ymin || 
		         	sheetinfo.centerp.y > Map.currentClusterBoundary.ymax){
		         		
			         if(Map.checkIfLoaded(Map.coordsGlobalToCluster(sheetinfo.centerp))) continue;
			         // console.log("asking for: { x:"+sheetinfo.centerp.x+" ymax:"+sheetinfo.centerp.y);
			         var locationInfo = Map.coordsGlobalToCluster(sheetinfo.centerp);
			         Map.sheets.push(
			         {
			         	basesheet: sheetinfo.init(),
			         	center: locationInfo
			         });
		     	}
			 }
			 
			// Add resources
			for(var i=0;i<data.resources.length;i++){
				var elem = data.resources[i];
				var sheets = null;
				// Add only if outside the cluster
				switch(elem.type){
					case 'tree':
						if(Map.checkIfObjectExists(elem.coordinates)) continue;
						sheets = Tree.newTree(
							elem.coordinates.x,
							elem.coordinates.y,
							elem.coordinates.z,
							elem.properties.size
						);
						break;
				}
				
				Map.objects.push({
					center : elem.coordinates,
					sheets : sheets
				});
				
				Map.addToDensityMap(sheets);
			}
	
	        // translate background
	        /*sheetengine.scene.translateBackground(
	        	{x:Map.currentCenter.x,y:Map.currentCenter.y}, 
	        	{x:centertile.x*200,y:centertile.y*200}
	        );*/
	        Map.currentCenter = centertile;
	        Map.currentClusterBoundary = clusterBoundary;
	        
	        Map.drawFlag = true;
	        Map.draw();
		});
	};
	
	Map.checkIfObjectExists = function(center){
		for (var i=0;i<Map.objects.length;i++) {
			if(Map.objects[i].center == center){
				console.log('Object already loaded');
				return true;
			}
		}
		return false;
	};
	
	Map.checkIfLoaded = function(center){
		for (var i=0;i<Map.sheets.length;i++) {
			if(Map.sheets[i].center == center){
				console.log('Already loaded');
				return true;
			}
		}
		return false;
	};

	return Map;
});


