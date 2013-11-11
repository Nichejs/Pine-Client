/**
 * Pine Game
 * Here we handle most common things, user login, character data...
 * 
 * https://github.com/Open-RPG/open-rpg
 * 
 * License: GNU GENERAL PUBLIC LICENSE
 */

define(["jquery", "socket"], function($, io){
	
	var Main = {
		character : null,
		map : null,
		size : null,
		container : null,
		characterCoords : {x:0,y:0,z:0},
		socketHost : 'http://server.pinegame.com:9002',
		socket : null,
		debug : false,
		canvas : {canvasElement:null,size:null},
		user : {
			id : null,
			name : null
		}
	};
	
	/**
	 * Launches Game, it requires the user to be logged in. 
	 */
	Main.start = function(){
		$(container).html('<canvas id="game" width="900" height="500"></canvas><div id="chatOut"></div><input type="text" id="chatIn" placeholder="Chat..."><div id="usersOnline"></div><div id="server"></div>');
	 	
	 	// Canvas reference
		Main.canvas.canvasElement=$("#game").get(0);
		Main.canvas.canvasElement.height = Main.size.h;
		Main.canvas.canvasElement.width = Main.size.w;
		Main.canvas.size=Main.size;
	};
	
	/**
	 * Check if current user is logged in
	 * @return boolean 
	 */
	Main.logged = function(){
		if(Main.user.id !== null && Main.user.id > 0) return true;
		return false;
	};

	return Main;
});

