(function(){

	var HTTP = $.import('../xsjslib/http.xsjslib'); 
	
	function handlePost(){
		
	}
	
	function handleGet(params){

	}
	
	function main(){
		var params = { 
			test: {
				type: 'VARCHAR',
				method: 'GET'
			}
		};
		
		HTTP.handleRequest({ "POST": handlePost, "GET": handleGet }, params);
	}
	
	main();
	 
})();