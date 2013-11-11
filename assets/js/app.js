/**
 * App - Main controller
 * This file handles the control of all game dependencies
 * and acts as the coordinator between all files.
 * 
 * https://github.com/Open-RPG/open-rpg
 * 
 * License: GNU GENERAL PUBLIC LICENSE
 */
define(["jquery", "main", "chat", "map", "tree", "character", "socket"], function($, Main, Chat, Map, Tree, Character, io){
	
	var App = {
		lastTimestamp : 0,	// Used for measuring ping
		character : null,	// Main character reference
		players : []		// Tracked players
	};
	
	/**
	 * Start setting up the game
	 * @param {Object} DOM object where the game will live (A div element normally)
	 * @param {Object} Size of the container in {w:_,h:_} format 
	 */
	App.init = function(gameContainer, size){
		Main.container = gameContainer;
		Main.size = size;
		
		if(!Main.logged()){
			App.displayLogin();
		}else{
			Main.start();
		}
	};
	
	/**
	 * Displays a login box and handles its events. 
	 */
	App.displayLogin = function(){
		$(Main.container).append('<h2>Login:</h2><form action="/" method="post" id="loginForm">Usuario: <input type="text" name="user" id="username" /> Contraseña: <input type="password" name="pass" id="pass" /> <input type="submit" value="Login" /><p>Not a user? <a href="/register.html">Register!</a></p></form>');
		
		// Process the form
		$('#loginForm').submit(function(event){
			event.preventDefault();
			
			App.socketStart($('#username').val(), $('#pass').val());
		});
	};
	
	
	/**
	 * Create a new socket connection with the serve.
	 * The username and password are required for the handshake authorization.
	 * @param {String} User name
	 * @param {String} Password 
	 */
	App.socketStart = function(user, pass){
		console.log("Opening socket connection");
		console.time('Socket connected');
		Main.socket = io.connect(Main.socketHost, { query: "user="+user+"&pass="+pass });
		
		// Launch game
		Main.start();
		
		Main.socket.on('connect', function () {
			console.timeEnd("Socket connected");
			
			// Setup username
			Main.user.name = user;
			
			// Server notifications
			Main.socket.emit('subscribe', 'server');
			// Other users position
			Main.socket.emit('subscribe', 'position');
			
			// Setup map
		 	Map.init();
		 	
		 	// Draw tree
		 	Tree.newTree(-150,-120,0,80);
		 	
		 	Tree.newTree(80,40,0,60);
		 	
		 	Tree.newTree(20,500,0,120);
		 	
		 	Tree.newTree(-450,-90,0,110);
		 	
		 	Tree.newTree(-110,400,0,70);
		 	
		 	Tree.newTree(-30,-50,0,90);
			
			// Main character
			App.character = Character.newCharacter({
				position: {x:110,y:0,z:0},
				movable: true,
				name: Main.user.name
			});
		 	
		 	// Setup chat
		 	Chat.init($('#chatOut').get(0), $('#chatIn').get(0));
		});
		
		// Process ping messages
		Main.socket.on('ping', function (data) {
			// I divide by two to get one way only
			var ping = ((new Date()).getTime() - data.timestamp)/2;
			$('#server').html("Ping: "+ping+"ms");
		});
		
		// Process server messages
		Main.socket.on('message', function (data) {
			if(data.room !== 'server') return;
			
			if(data.type == 'connect'){
				// User connected
				// We will allow only one connection, so if the user
				// is the same, bye bye!
				if(Main.user.name.toLowerCase() == data.user.toLowerCase()){
					// They are the same, bye bye to one of them
					Chat.displayMessage(data.user+' logged in twice', 'server');
					Main.socket.disconnect();
					window.location = '/';
				}else{
					// Display message on chat:
					Chat.displayMessage(data.user+' joined', 'server');
				}
				
				// Notify of our position
				Main.socket.emit('send', { room: 'position', position : App.character.centerp });
			}
			
			if(data.type == 'disconnect'){
				// User disconnected
				// Display message on chat:
				Chat.displayMessage(data.user+' left', 'server');
				// Remove from sheetengine
				try{
					Map.densityMap.remove(App.players[data.user]);
					App.players[data.user].destroy();
				}catch(e){}
				// Remove from local cache
				delete App.players[data.user];
				// Remove from static queue
				if(data.user !== Main.user.name) Map.removeFromStaticQueue(data.user);
				
				Map.redraw();
			}
		});
		
		// Process other players movement
		Main.socket.on('update', function (data) {
			if(App.players[data.user]){
				// Player is being tracked
				App.players[data.user].moveTo(data.position);
			}else{
				// New player, create and add to array
				App.players[data.user] = Character.newCharacter({
					position : data.position,
					movable : false,
					name : data.user
				});
			}
		});
		
		var pingInterval = setInterval(function(){
			// Ping measure
			Main.socket.emit('ping', { timestamp: (new Date()).getTime() });
		},1000);
		
		// Process server messages
		Main.socket.on('usersOnline', function (data) {
			$('#usersOnline').html(data.count+' online');
		});
		
		Main.socket.on('error', function (err) {
			window.location = '/';
			console.error("Error de conextion: ",err);
		});
	};
	
	return App;
});