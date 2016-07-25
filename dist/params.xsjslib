(function(exports){

	var err = $.import("error.xsjslib");
    /** 
    * Defines the properties of a url query string parameter expected by the service.
    * 
    * Note that you cannot instantiate this object. Rather, just create an object literal with  properties.
    * 
	* @class ParameterDef 
	* @static
	* 
	* The values mapped to the keys are parameterDef objects.
	*/
	
	/**
	* Database data type. Used to validate the type of the value
	* 
	* @property type {string}
	*/
	
	/**
	* Maximum string length
	* 
	* @property maxlength {int?}
	*/
	
	
	/**
	* Minimum allowed value
	* 
	* @property minvalue
	*/

	/**
	* Maximum allowed value
	* 
	* @property maxvalue
	*/

	/**
    * the HTTP method(s) to which this parameter applies. If not specified, the parameter applies to all methods. 
    * If specified, it can be either a string (comma separated list of HTTP methods), or an array (containing each method as a string element)
    * 
	* @property method (optional): 
	*/
	var parameterDefs = {};
			
/**
 * Provides definition and validation of web request parameters (passed as name/value in the query part of the url)
 * 
*  Internal parameter names are always UPPER CASE;
*  Parameter names in te url query string are always lower case.
* 
 * @class Params
 * @static
 */
	
	/** 
	* Defines the url query string parameters expected by the service.
	* 
	* Define one or more parameters. 
	* You can either pass one object that defines all parameters, or you can pass a variable-length argument list of name/parameterDef pairs.
	* 
	* The keys in this object are the internal parameter names.
	* These correspond to the "name" part of the name/value parts 
	* that make up the "query" part of the url.
	* 
	* Internal parameter names are always UPPER CASE;
	* Parameter names in te url query string are always lower case.
	* 
	* The values mapped to the keys are parameterDef objects.
	* ParameterDef objects have these properties:
	* - type: database data type. Used to validate the value
	* - maxlength (optional): maximum string length
	* - minvalue (optional): minimum allowed value
	* - maxvalue (optional): maximum allowed value
	* - method (optional): the HTTP method(s) to which this parameter applies. If not specified, the parameter applies to all methods. If specified, it can be either a string (comma separated list of HTTP methods), or an array (containing each method as a string element)
	*
	* @method define
	* @param name {string}	The name of the parameter. The lowercase version of this name will be expected to be passed in the query part of the url.
	* @param {ParameterDef} The defintion of this parameter. Used to normalize and validate the parameter value corresponding to the name.
	*/
	function defineParameter(name, parameterDef){
		var n;
		switch (arguments.length) {
			case 1:
				if (typeof name !== "object") {
					err.raise("defineParameter", arguments, "Single argument version of defineParameter accepts only an object with parameter names as keys and parameter definitions as values.");
				}
				var defs = arguments[0], v;
				for (n in defs){
					v = defs[n];
					defineParameter(n, v);
				}
				break;
			case 2: 
				parameterDefs[name] = parameterDef;
				break;
			default:
				if (arguments.length % 2) {
					err.raise("defineParameter", arguments, "Multi-argument version of define Parameter accepts only name/parameterDef pairs");
				}
				var i;
				n = arguments.length;
				for (i = 0; i < n; i++) {
					defineParameter(arguments[i], arguments[++i]);
				}
		}
	}
	
	/**
	*	This is a helper for validateParameters(). 
	* 
	*   This checks whether the parameter with the specified name applies to the specified HTTP method.
	*   @function isParameterApplicableForMethod
	*   @private
	*   @param parameterName {string} Name of the parameter definition to examine
	*   @param method {string} HTTP method to search for
	*/
	function isParameterApplicableForMethod(parameterName, method){
		
		var parameterDef = parameterDefs[parameterName];
		var parameterDefMethod = parameterDef.methods;
		
		
		if (parameterDefMethod === undefined) {
			//parameterDef does not specify any particular method;
			//this means it applies to all methods
			return true;
		}

		var parameterDefMethodType = typeof parameterDefMethod;
		//extract all methods
		var parameterDefMethods;
		if (parameterDefMethodType === "string") {
			parameterDefMethods = parameterDefMethod.split(",");
		}
		else
		if (parameterDefMethod.constructor === Array) {
			parameterDefMethods = parameterDefMethod;
		}
		else {
			err.raise(
				"isParameterApplicableForMethod", 
				arguments,
				"Method property of parameter definition " + parameterName + " must be either a string or an array of strings."
			);
		}
		
		//check each method
		var i, n = parameterDefMethods.length;
		for (i = 0; i < n; i++) {
			parameterDefMethod = parameterDefMethods[i];
			
			if (typeof parameterDefMethod !== "string") {
				err.raise(
					"isParameterApplicableForMethod", 
					arguments,
					"Method property of parameter definition " + parameterName + " must be either a string or an array of strings."
				);
			}
			parameterDefMethod = parameterDefMethod.trim();
			if (method === parameterDefMethod) {
				return true;
			}
		}
		
		//no matching method.
		return false;
	}
	/**
	*	This is a helper for validateParamters(). 
	* 
	*	Validates a parameter from the query part of the url  
	*	against its corresponding parameter definition
	*
	*	If the parameter is found to be invalid, and error is thrown.
	*	If the paramter is found to be valid, its (typed) value will be returned.
	*
	*   @private
	*	@function validateParameter
	*	@param parameterName {string} The name of the parameter to validate
	*	@return {scalar} Returns the (typed) value for this parameter.
	*/
	function validateParameter(parameterName){
		var parameterDef = parameterDefs[parameterName];
		var parameterValue = $.request.parameters.get(parameterName.toLowerCase());
		if (parameterDef.mandatory !== false && parameterValue === undefined) {
			err.raise(
				"validateParameter",
				arguments,
				"Parameter " + parameterName + " is mandatory."
			);
		}
		switch (parameterDef.type) {
			case "VARCHAR":
			case "NVARCHAR":
				break;
			case "INTEGER":
				if (/\d+/g.test(parameterValue)=== true) {
					parameterValue = parseInt(parameterValue, 10);
				}
				else {
					err.raise(
						"validateParameter",
						arguments,
						"Parameter " + parameterName + " should be an integer."
					);
				}
				break;
			default:
		}
		if (parameterDef.minvalue !== undefined && parameterValue < parameterDef.minvalue) {
			err.raise(
				"validateParameter",
				arguments,
			    "Value " + parameterValue + " of parameter " + parameterName + 
				" is smaller than the minimum value " + parameterDef.minvalue
			);
		}
		if (parameterDef.maxvalue !== undefined && parameterValue > parameterDef.maxvalue) {
			err.raise(
				"validateParameter",
				arguments,
				"Value " + parameterValue + " of parameter " + parameterName + 
				" is larger than the maximum value " + parameterDef.maxvalue
			);
		}
		if (parameterDef.values !== undefined && parameterValue !== undefined) {
			var i, values = parameterDef.values, n = values.length, value;
			for (i = 0; i < n; i++) {
				value = values[i];
				if (value === parameterValue) {
					break;
				}
			}
			if (i >= n) {
				err.raise(
					"validateParameter",
					arguments,
					"Value for parameter " + parameterName + " must be one of: " + values.join(",") + "; Found: " + parameterValue
				);
			}
		}
		return parameterValue;
	}
	
	/**
	*	Function to validate url query string parameters. 
	*	If validation succeeds, this returns an object representing the canonical parameters.
	*	Any service functionality that needs to access a paramter, should use that object
	*	rather than accessing $.request.parameters directly.
	* 
	*	@method validate
	*	@param method {string} The HTTP method (optional)
	*	@return {object} An object that maps canonical (upper case) parameternames to their validated typed value
	*/
	function validateParameters(method){
		if (method === undefined) {
			method = $.request.headers.get('~request_method').toUpperCase();
		}
		var parameterName, parameterValue, parameterValues = {};
		for (parameterName in parameterDefs) {
			if (parameterDefs.hasOwnProperty(parameterName)) {
				if (!isParameterApplicableForMethod(parameterName, method)) {
					continue;
				}
				parameterValue = validateParameter(parameterName);
				parameterValues[parameterName] = parameterValue;
			}
		}
		return parameterValues;
	}
	
	exports.define = defineParameter;
	exports.validate = validateParameters;
	
}(this));
