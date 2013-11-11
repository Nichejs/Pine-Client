
function addYard(yard,position, callback) {
    var newsheets = [];
    var newobjects = [];
    position = {x:position.x, y:position.y, z:0};
    
    if (yard) {
        var basesheet = new sheetengine.BaseSheet(position, {alphaD:-90, betaD:0, gammaD:0}, {w:scene.tilewidth, h:scene.tilewidth});
        basesheet.color = yard.baserectcolor;
        var sheets;
        if (yard.sheets) {
          sheets = createSheets(yard.sheets, position);
          newsheets = newsheets.concat(sheets);
        } else {
          sheets = [];
        }
        
        var objects = yard.objects;
        var yardObjects = [];
        if (objects) {
          for (var j=0;j<objects.length;j++) {
            var objdata = objects[j];
            var createdObj = objhelpers.defineObject(objdata.name);
            if (!createdObj)
              continue;
            createdObj.id = 'x'+position.x+'y'+position.y+'i'+j;
            yardObjects.push(createdObj);
            newobjects.push(createdObj);
            //Now it's wrong because to obtain the position of object i have to 
            //substract the position of the yard, but in a future all sheets are gonna
            //be define respect a center (0,0)
            createdObj.setPosition(geometry.addPoint(objdata.centerp, offset));
            createdObj.oldcenterp = clonePoint(createdObj.centerp);  // set oldcenterp to centerp as this is the initial position
            createdObj.setOrientation(objdata.rot);
            newsheets = newsheets.concat(createdObj.sheets);
          }
        }
        
        var newyard = {sheets: sheets, basesheet: basesheet, x:yard.x, y:yard.y, objects: yardObjects};
        var key = 'x'+yard.x+'y'+yard.y;
        loadedyards[key] = newyard;
      }
    }
    
    startsheets = newsheets;
    if (newsheets.length == 0) {
      callback([], []);
      return;
    }
    
    // draw images on canvases
    sheetengine.imgCount = 0;
    for (var i=0;i<newsheets.length;i++) {
      var img = new Image();
      var context = newsheets[i].canvas.getContext('2d');
      img.onload = imageOnload(newsheets[i], context, img, newsheets.length, function() { callback(newsheets, newobjects); });
      img.src = newsheets[i].canvasdata;
      newsheets[i].canvasdata = null;
    }
  };
function readYardInfo(urlYard){
    requestUrl(url, function(yardsAndObjects) {
      if (yardsAndObjects) {
        objhelpers.defineAppObjects(yardsAndObjects.appobjects);
        sheetengine.objects = [];
        return yardsAndObjects.yards;
      }
}
function getYards(url, characterPosition, levelsize, appid, callback) {
    scene.yardcenterstart = {yardx:getYardFromPos(characterPosition).yardx,
     yardy:getYardFromPos(characterPosition).yardy};
   requestUrl(url, function(yardsAndObjects) {
      if (yardsAndObjects) {
        if (yardsAndObjects.center) {
          scene.yardcenterstart = {yardx:yardsAndObjects.center.x, yardy:yardsAndObjects.center.y};
          scene.yardcenter = {yardx:yardsAndObjects.center.x, yardy:yardsAndObjects.center.y};
          scene.level = yardsAndObjects.level;
        }
        objhelpers.defineAppObjects(yardsAndObjects.appobjects);
        sheetengine.objects = [];
        addYards(yardsAndObjects.yards, function(newsheets, newobjects) {
          callback();
        });
      } else {
        callback();
      }
    });
  };
  function getNewYards(urlBase, center, levelsize, appid, callback) {
    // gather yards to be removed and loaded
    var oldcenter = scene.yardcenter;
    scene.yardcenter = {yardx:center.yardx, yardy:center.yardy};
    var newcenter = scene.yardcenter;
  
    var oldc = {x1:oldcenter.yardx-levelsize,x2:oldcenter.yardx+levelsize,y1:oldcenter.yardy-levelsize,y2:oldcenter.yardy+levelsize};
    var newc = {x1:newcenter.yardx-levelsize,x2:newcenter.yardx+levelsize,y1:newcenter.yardy-levelsize,y2:newcenter.yardy+levelsize};
    
    // yards to remove
    var yardsToRemove = [];
    for (var x=oldc.x1;x<=oldc.x2;x++) {
      for (var y=oldc.y1;y<=oldc.y2;y++) {
        if (x < newc.x1 || x > newc.x2 ||
          y < newc.y1 || y > newc.y2)
          yardsToRemove.push({x:x,y:y});
      }
    }
    
    // yards to add
    var yardsToAdd = [];
    for (var x=newc.x1;x<=newc.x2;x++) {
      for (var y=newc.y1;y<=newc.y2;y++) {
        if (x < oldc.x1 || x > oldc.x2 ||
          y < oldc.y1 || y > oldc.y2)
          yardsToAdd.push({x:x,y:y});
      }
    }
    
  
    var yardsStr = '';
    for (var i=0;i<yardsToAdd.length;i++) {
      yardsStr += yardsToAdd[i].x+','+yardsToAdd[i].y;
      if (i < yardsToAdd.length-1)
        yardsStr += ';';
    }
    var url = urlBase + '/yard?x='+scene.yardcenterstart.yardx+'&y='+scene.yardcenterstart.yardy+'&yards='+yardsStr+'&appid='+appid+'&appobjects=0';
    requestUrl(url, function(yardsAndObjects) {
      var oldcenter2 = {x:oldcenter.yardx*scene.tilewidth, y:oldcenter.yardy*scene.tilewidth, z:0};
      var newcenter2 = {x:newcenter.yardx*scene.tilewidth, y:newcenter.yardy*scene.tilewidth, z:0};
      scene.translateBackground(oldcenter2, newcenter2);
  
      if (yardsAndObjects) {
        addYards(yardsAndObjects.yards, function(newsheets, newobjects) {
          var removedsheets = {sheets:[]};
          var removedobjects = {objects:[]};
          newYardsAdded(newsheets, removedsheets, removedobjects, yardsToRemove);
          callback(newsheets, newobjects, removedsheets.sheets, removedobjects.objects);
        });
      } else {
        var removedsheets = {sheets:[]};
        var removedobjects = {objects:[]};
        newYardsAdded(null, removedsheets, removedobjects, yardsToRemove);
        callback([], [], removedsheets.sheets, removedobjects.objects);
      }
    });
  };
  