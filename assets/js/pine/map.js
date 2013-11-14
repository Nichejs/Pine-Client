/**
 * Drawing the Map
 * 
 * https://github.com/Open-RPG/open-rpg
 * 
 * License: GNU GENERAL PUBLIC LICENSE
 */

define(["main", "sheetengine"],function(Main, sheetengine){

	var Map = {
		// Config options
		initied : false,
		densityMap : null,
		drawFlag : true,
		redrawFlag : false,
		redrawInterval : null,
		boundary : {},
		currentMap : [],
		currentCenter : {x:0,y:0},
		currentClusterBoundary : {},
		basesheetloaded : [],
		staticQueue : [],
	};
	
	/**
	 * Set up the map and main character 
	 */
	Map.init = function(){
		// Now we set up the interval for the redraw method
		// Read the description of the redraw method for more info
		Map.currentMap = generateMap(Map.coordsGlobalToCluster(Main.characterCoords));
		Map.setCenter(Main.characterCoords);
		Map.currentClusterBoundary = {xmin:100000,xmax:1000000,ymin:100000,ymax:1000000};
		Map.loadAndRemoveSheets(Map.coordsGlobalToCluster(Main.characterCoords));
		Map.densityMap = new sheetengine.DensityMap(5);
		Map.draw();
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
	}

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
		//console.log("drawing the whole scene");
	};
	
	/**
	 * Add sheets to the density map for collision detection 
	 * @param {Object} Sheets to be added
	 */
	Map.addToDensityMap = function(sheets){
		Map.densityMap.addSheets(sheets);
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
	};

	/**
	 *Set the area where the user can walk whithout having to
	 *load a new yard
	 *@param {object} the relative center of the actual yard {relyardx,relyardy,relyardz}
	 */
	Map.setBoundary = function(position) {
				// for boundary we use relative yard coordinates
		var radius = 0.5;
		Map.boundary = {
			xmin: (position.x - radius) * 200,
			ymin: (position.y - radius) * 200,
			xmax: (position.x + radius) * 200,
			ymax: (position.y + radius) * 200
		};
		console.log("boundary x:"+position.x+" y:"+position.y);
	};


	/**
	 *Check if the position is out of the actual boundary
	 *
	 *@param {object} the position to check {x,y,z}
	 *@return boolean true if the user is out, false if is not
	 */
	Map.checkBoundaries = function(position){
		console.log("check x:"+position.x+" y:"+position.y);
		console.log("boundary xmin:"+Map.boundary.xmin+" xmax:"+Map.boundary.xmax+" ymin:"+Map.boundary.ymin+" ymax"+Map.boundary.ymax);
			if (position.x >= Map.boundary.xmin &&
				position.y >= Map.boundary.ymin &&
				position.x <= Map.boundary.xmax &&
				position.y <= Map.boundary.ymax) 
				return false;
			return true;
	};

	function initBaseSheet(centerfile,color){
				var centerp = { x: centerfile.x * 200, y: centerfile.y * 200, z: 0 };
                var orientation = {alphaD: 90, betaD: 0, gammaD: 0};
                var size = {w: 200,h: 200};
                var basesheet = new sheetengine.BaseSheet(centerp, orientation, size);
                basesheet.color = color;
                return basesheet;
                
                
	}

	function generateMap(centerfile){
        
        var x = centerfile.x;
        var y = centerfile.y;
        var halfSizeClusterSide = 4;

        var map = [];

        for(var i=x-halfSizeClusterSide;i<=x+halfSizeClusterSide;i++){
          for(var j=y-halfSizeClusterSide;j<=y+halfSizeClusterSide;j++){
            //console.log("generateMap Loop i:"+i+" j:"+j);
            map.push({
              
              centerp: { x: i * 200, y: j * 200, z: 0 },
              orientation: {alphaD: 90, betaD: 0, gammaD: 0},
              size: {w:200,h:200},
              init: function() { 
                var basesheet = new sheetengine.BaseSheet(this.centerp, this.orientation, this.size);
                basesheet.color = '#5D7E36';
                return basesheet;
              }
            });
          }
        }
        return map;
      }

	Map.loadAndRemoveSheets = function(centertile) {

        var halfSizeClusterSide = 4;

        var clusterBoundary = { xmin: (centertile.x - halfSizeClusterSide)*200,
         xmax: (centertile.x  + halfSizeClusterSide)*200,
         ymin: (centertile.y - halfSizeClusterSide)*200,
         ymax: (centertile.y + halfSizeClusterSide)*200 };


        var map = generateMap(centertile);
        // remove sheets that are far
        //console.log("Boundary{ xmin:"+boundary.xmin+" xmax:"+boundary.xmax+" ymin:"+boundary.ymin+" ymax:"+boundary.ymax);
        
        for (var i=0;i<Map.currentMap.length;i++) {
          var sheetinfo = Map.currentMap[i];
          //console.log("currentMap: { x:"+sheetinfo.centerp.x+" ymax:"+sheetinfo.centerp.y);
          if (sheetinfo.centerp.x < clusterBoundary.xmin || sheetinfo.centerp.x > clusterBoundary.xmax || sheetinfo.centerp.y < clusterBoundary.ymin || sheetinfo.centerp.y > clusterBoundary.ymax) {
             //console.log("removing: { x:"+sheetinfo.centerp.x+" ymax:"+sheetinfo.centerp.y);
            var locationInfo = Map.coordsGlobalToCluster(sheetinfo.centerp);
            
            for(var j=0;j<Map.basesheetloaded.length;j++){
              
              if(Map.basesheetloaded[j].center.x == locationInfo.x && Map.basesheetloaded[j].center.y == locationInfo.y){
                Map.basesheetloaded[j].basesheet.color = '#FFFFFF';
                //Map.basesheetloaded[j].basesheet.destroy();

              }
            }
          }
        }
        
        //console.log("currentBoundary{ xmin:"+currentBoundary.xmin+" xmax:"+currentBoundary.xmax+" ymin:"+currentBoundary.ymin+" ymax:"+currentBoundary.ymax);
        // add new sheets
        for (var i=0;i<map.length;i++) {
          var sheetinfo = map[i];
         // console.log("Map: { x:"+sheetinfo.centerp.x+" ymax:"+sheetinfo.centerp.y);
          if (sheetinfo.centerp.x < Map.currentClusterBoundary.xmin ||
           sheetinfo.centerp.x > Map.currentClusterBoundary.xmax ||
           sheetinfo.centerp.y < Map.currentClusterBoundary.ymin || 
           sheetinfo.centerp.y > Map.currentClusterBoundary.ymax){
            
              //console.log("asking for: { x:"+sheetinfo.centerp.x+" ymax:"+sheetinfo.centerp.y);

          	var locationInfo = Map.coordsGlobalToCluster(sheetinfo.centerp);
            Map.basesheetloaded.push(
              {
                basesheet: sheetinfo.init(),
                center: locationInfo
              });
             

            }
          
        }
       

        // translate background
        sheetengine.scene.translateBackground(
          {x:Map.currentCenter.x*200,y:Map.currentCenter.y*200}, 
          {x:centertile.x*200,y:centertile.y*200}
        );
        Map.currentCenter = centertile;
        Map.currentMap = map;
        Map.currentClusterBoundary = clusterBoundary;
        // This should be change in order to 
		// only move the map when the character
		// reach an edge.
		sheetengine.calc.calculateAllSheets();
        sheetengine.drawing.drawScene(true);
        
      }


   
	return Map;
});


