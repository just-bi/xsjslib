/**
 * @class Error
 * @static
 */	
(function(exports){
/*********************************************
* 
* 	Error handling
* 
********************************************/
	
	/**
	 * Create an error object and throw it. 
	 * Overrides toString() of built-in Error object to print out a stack trace
	 * 
	 * @method throwError
	 * @param func {string} name of the function from where this is called. 
	 * @param args {array} pass built-in arguments 
	 * @param message {string} User message
	 * @param error {Error} Parent Error object.
	 */
	function throwError(func, args, message, error){
		//args = null;
		var err = new Error(func + "(" + (args ? JSON.stringify(args) : "no args") + ")" + ": " + message);
		err.parent = error;
		err.toString = function(){
			var str = Error.prototype.toString.call(this);
			if (this.parent) {
				str += "\n" + this.parent.toString();
			}
			return str;
		}
		throw err;
	}
	
	exports.raise = throwError;
	
}(this));