require.config({
	baseUrl: 'assets/js/',
    paths: {
    	'app' : 		'app',
    	'socket': 		"socket.io",
        'jquery': 		"jquery-2.0.3.min",
        'main': 		"pine/main",
        'chat' : 		'pine/chat',
        'map' : 		'pine/map',
        'tree' : 		'pine/tree',
        'character' : 	'pine/character',
        'sheetengine': 	"sheetengine-src-1.2.0",
        'gui' : 		'pine/gui'
    },
    shim: {
    	'sheetengine': {
			'exports': 'sheetengine'
		},
    }
});