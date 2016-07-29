(function(exports){
	
	var Error = $.import("error.xsjslib");
	var Params = $.import('params.xsjslib');
	
	function getHandler(conf, method){
		var handler = conf[method];
		if (!handler) {
			$.response.status = $.net.http.METHOD_NOT_ALLOWED;
			Error.raise(
				"handleRequest",
				arguments,
				"No handler found for method " + method
			);
		}
		else
			return handler;		
	}
	
	/**
	*	Finds and executes the actual function that is to handle this request
	*
	*	@function handleRequest
	*	@private
	*	@param methods {object} An object that maps HTTP methods (keys) to functions (values)
	*	@return {scalar} the value returned by the handler
	*/
	function setHandlers(methods, paramDefinitions){
		try {
			var method = $.request.headers.get('~request_method').toUpperCase();
			var handler = getHandler(methods, method);
			
			var args; 
			if(typeof paramDefinitions === 'object'){
				Params.define(paramDefinitions);
				args = Params.validate(method);
			}
			
			return handler(args);
		}
		catch (e) {
			if ($.response.status == $.net.http.OK) {			
				$.response.status = $.net.http.BAD_REQUEST;
				$.response.contentType = "text/plain";
				$.response.setBody(e.toString() + e.stack);
			}
		}				
	}
	
	exports.setHandlers = setHandlers;
	
})(this);