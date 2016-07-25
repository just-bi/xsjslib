(function(exports){
/**
 * Provides utilities for generating and executing SQL queries against HANA.
 * @class Sql
 *  
*/
	var error = $.import("error.xsjslib");
	/**
	* 
	* Name of the database schema
	* 
	* @var SCHEMA_NAME {string} database schema name (part of table identifier)
	* @private
	*/
	var SCHEMA_NAME = "SCORECARD";

	/**
	* 
	* Name of the "context" in the .hdbdd file. In our setup, all tables are in the same context
	* 
	* @var CONTEXT_NAME {string} sap/hana hdbdd context (part of table identifier)
	* @private
	*/
	var CONTEXT_NAME = "SCORECARD";

    /**
     * This is the name for our development package
     */
     var packageIdentifier = "scorecard";
     /**
     *     Get the package name. 
     *     Note that this method presumes the xsjs script runs from the services directory beneath the project directory. 
     *  @method getPackageName
     * @private
     */
     function getPackageName(){
       //url will be like this: 
       //https://scorecard.d.evo.vodafone.com/just/apps/scorecard/services/document.xsjs
       //somtimes, it will be like this:
       //https://scorecard.d.evo.vodafone.com/just/apps/scorecard/services/document.xsjs/
       var path = $.request.path;
       
       //path has a leading slash, get rid of that.
       //so path is now: just/apps/scorecard/services/document.xsjs/
       path = path.substr(1);

       //if path was just/apps/scorecard/services/document.xsjs/ then indexOfPackageIdentifier
       //indexOfPackageIdentifier will now be "just/apps".length
       var indexOfPackageIdentifier = path.indexOf("/" + packageIdentifier + "/");

       if (indexOfPackageIdentifier === -1) {
         error.raise(
           "getPackageName", 
           arguments,
           "Package identifier " + pacakgeIdentifier + " not found in $.request.path " + $.request.path + "." 
         );
       }
       //if all goes well, path is now something like just/apps
       path = path.substr(0, indexOfPackageIdentifier);
       
       //replace slash 
       var parentPackageName = path.replace(/\//g, ".");
       var packageName = parentPackageName + "." + packageIdentifier;
       return packageName;
     }
	/**
	* 
	* Name of the package in the .hdbdd file. In our setup, all tables are in the same package
	* 
	* @var CONTEXT_NAME {string} sap/hana package (part of table identifier)
	* @private
	*/
	var PACKAGE_NAME = getPackageName() || "just.apps.scorecard";
	
	var DATA_PACKAGE = "data";
	var PROC_PACKAGE = "procedures";
	var MODELS_PACKAGE = "models";
	
	var connection;
	/**
	*	Opens the connection and makes sure autocommit is disabled.
	*	We require this becuase typically our interaction with the 
	*	db spans multiple statements
	*	
	* @method openConnection
	* @private
	*/
	function openConnection(){
		connection = $.hdb.getConnection();  
		connection.setAutoCommit(false);
	}
	
	function rollbackTransaction(){
		if (connection) {
			connection.rollback();
			connection.setAutoCommit(false);
		}
	}

	function commitTransaction(){
		if (connection) {
			connection.commit();
			connection.setAutoCommit(false);
		}
	}

	function getConnection(){
		if (connection === undefined) {
			openConnection();
		}
		return connection;
	}
	/**
	*	Closes the connection
	*	
	*	@function closeConnection
	* @private
	*/
	function closeConnection(){
		if (!connection) {
			return false;
		}
		connection.close();
		connection = undefined;
		return true;
	}
	
	function makeObjectName(namesObject){
		var fullName, contextName, packageName;
		switch (typeof namesObject) {
			case "string":
				namesObject = {
					objectName: namesObject
				};
				break;
			case "object":
				break;
			default: 
				error.raise(
					"makeObjectName", 
					arguments,
					"Invalid name object."
				);
		}
		fullName = namesObject.objectName;
		
		contextName = namesObject.contextName;
		if (contextName) {
			fullName = contextName + "." + fullName;
		}

		packageName = namesObject.packageName || PACKAGE_NAME;
		
		if (namesObject.subPackageName) {
			packageName += "." + namesObject.subPackageName;
		}
		fullName = packageName + "::" + fullName;

		fullName = "\"" + fullName + "\"";
		return fullName;
	}
	
	/**
	*	Create a fully qualified table name from the names in the nameObject parameter.
	*	The namesObject parameter has the following keys:
	*
	*	- packageName: the name of the package in the .hdbdd file
	*	- contextName: the context in the .hdbdd file
	*	- schemaName: the database schema name
	*	- tableName: the actual unqualified table name.
	*
	*	All these items, except the tableName, will be defaulted with defaults if not specified.
	*
	*	Alternatively, you can also pass a single string representing the unqalified tablename. 
	*	In that case, defaults will be used for all other name parts.
	* 
	*	@function makeTableName
	*	@private
	*	@param {object|string} namesObject Either a bag of different types of names that together make up a fully qualified table name, or a string representing a plain unqualified table name.
	*	@return {string} A single string that represents a fully qualified table name
	*/
	function makeTableName(namesObject){
		var fullName, schemaName;

		if (typeof namesObject === "string"){
			namesObject = {
				objectName: namesObject	
			};
		}
		namesObject.subPackageName = DATA_PACKAGE;
		
		if (!namesObject.contextName) {
			namesObject.contextName = CONTEXT_NAME;
		}
		
		fullName = makeObjectName(namesObject);

		schemaName = namesObject.schemaName || SCHEMA_NAME;
		schemaName = "\"" + schemaName + "\"";
			
		fullName = schemaName + "." + fullName;
		return fullName;
	}

	function makeProcedureName(namesObject){
		var fullName;

		if (typeof namesObject === "string"){
			namesObject = {
				objectName: namesObject	
			};
		}
		namesObject.subPackageName = PROC_PACKAGE;
		
		fullName = makeObjectName(namesObject);
		return fullName;
	}
	
	function createCalcViewPlaceholder(name, value) {
		name = name.replace(/'/g, "''");
		value = String(value).replace(/'/g, "''");
		return "'PLACEHOLDER' = ('$$" + name + "$$', '" + value + "')";
	}
	
	function createCalcViewPlaceholders(parameters) {
		var placeHolders = [];
		var name, calcViewPlaceHolder, value; 
		for (name in parameters) {
			value = parameters[name];
			calcViewPlaceHolder = createCalcViewPlaceholder(name, value);
			placeHolders.push(calcViewPlaceHolder);
		}
		return "(" + placeHolders.join(", ") + ")"; 
	}

	//https://help.sap.com/saphelp_hanaplatform/helpdata/en/20/9f5020751910148fd8fe88aa4d79d9/content.htm
	function checkIdentifier(identifier){
		if (!/^\"[^\"]+\"|[_A-Z][A-Z0-9_#$]*$/.test(identifier)){
			error.raise("checkIdentifier", identifier, "Identifier " + identifier + " is not valid.");
		}
	}

	function buildParameterizedCalculationViewQuery(nameObject, parameters, columns){
		try {
			if (typeof(nameObject) === "string") {
				nameObject = {
					tableName: nameObject
				};
			}
			if (!nameObject.packageName) { 
				nameObject.packageName = PACKAGE_NAME;
			};
			if (!nameObject.subPackageName) {
				nameObject.subPackageName = MODELS_PACKAGE;
			}
			
			var tableName = "\"_SYS_BIC\"." + 
			                "\"" + 
							nameObject.packageName + "."  + 
							nameObject.subPackageName + "/" + 
							nameObject.tableName + 
			                "\""
			;
			var sql = "SELECT ";
			if (columns === undefined) {
				sql += "*";
			}
			else 
			if (columns.constructor === Array){
				var i, column, n = columns.length;
				for (i = 0; i < n; i++) {
					column = columns[i];
					checkIdentifier(column);
				}
				sql += columns.join(",");
			}
			else 
			if (typeof columns === "object") {
				var alias, expression, columnsList = [];
				for (alias in columns){
					expression = columns[alias];
					columnsList.push(
						checkIdentifier(expression) + 
						" AS " + checkIdentifier(alias)
					);
				}
				sql += columnList.join(",");
			}
		    sql += "\nFROM " + tableName;
			if (parameters) {
				sql += "\n" + createCalcViewPlaceholders(parameters);
			}
			return sql;
		}
		catch (e) {
			error.raise("buildParameterizedCalculationViewQuery", arguments, sql, e);
		}
	}
	
	function queryParameterizedCalculationView(nameObject, parameters, columns){
		try {
			var rs = null;
			var sql = buildParameterizedCalculationViewQuery(nameObject, parameters, columns);
			rs = getConnection().executeQuery(sql);
			return rs;
		}
		catch (e) {
			error.raise("queryParameterizedCalculationView", arguments, sql, e);
		}
	}
	/**
	*	Utility to get all values from a particular column from table into an object.
	*
	*	@method getRowList
	*	@private
	*	@param namesObject {object} Information to create table and column name. See makeTableName()
	*	@return an object with column values as both keys and values.
	*/
	function getRowList(namesObject){
		var list = {}; 
		var fullTableName = makeTableName(namesObject);
		var columnName = namesObject.columnName;
		var query = " SELECT DISTINCT " + columnName +
					" FROM   " + fullTableName
		;  
		var rs = getConnection().executeQuery(query);
		var n = rs.length, i, row, value;
		for (i = 0; i < n; i++) {
			row = rs[i]; 
			value = row[columnName];
			list[value] = value; 
		}
		return list;
	}
	
	function getColumnAssignment(columnAssignments, columnName){
		var columnAssignment = columnAssignments[columnName];
		switch (typeof columnAssignment) {
			case "undefined":
				columnAssignment = {expression: "NULL"};
/*
				error.raise(
					"getColumnAssignment", 
					arguments,
					"No assignment for column: " + columnName
				);
*/
			case "object":
				if (columnAssignment === null) {
					columnAssignment = {expression: "NULL"};
				}
				break;
			default:
				columnAssignment = {value: columnAssignment};
		}
		return columnAssignment;
	}
	/**
	*	Create the SQL for a INSERT INTO <table>(<columns...>) VALUES (<expressions and parameters>) statement  
	* 
	*	@function createInsertValuesStatement
	*   @param {object|string} namesObject
	*   @param {object|string} columnAssignments
	*   @return {string} the SQL statement text
	*/
	function createInsertValuesStatement(namesObject, columnAssignments){
		try {
			var tableName = makeTableName(namesObject);

			var columns = [], parameters = [];
			var columnName, columnAssignment;
			for (columnName in columnAssignments) {
				columns.push(columnName);
				columnAssignment = getColumnAssignment(columnAssignments, columnName);
				if (columnAssignment.expression !== undefined) {
					parameters.push(columnAssignment.expression);
				}
				else 
				if (columnAssignment.value !== undefined) {
					parameters.push("?");
				}
			}

			columns 	= "(" + columns.join(",") + ")";
			parameters	= "(" + parameters.join(",") + ")";
			
			var sql = 	"insert "			+ 
						"into " + tableName	+
			 			columns				+
			 			"values" 			+
			 			parameters
			;
			return sql;
		}
		catch (e) {
			error.raise("createInsertValuesStatement", null, "");
		}
	}
	
	/*
	*	A place to cache procedures. This is used by callProcedure() 
	*	and should not be accessed directly.	
	* 
	*	@var procedureCache
	*/
	var procedureCache = {};
	
	/**
	*	A function to call a database stored procedure.
	*	
	*	@function callProcedure
	*	@private
	*	@param namesObject {object |string} name of the procedure.
	*	@param parametersObject {object} Name/value pairs to use as procedure parameters.
	*	@return {$.hdb.ProcedureResult} A procedure result. Resultsets and output parameters can be retrieved from here.
	*/
	function callProcedure(namesObject, parametersObject){
		var schemaName = namesObject.schemaName || SCHEMA_NAME;

		var schema = procedureCache[schemaName];
		if (!schema) {
			schema = {};
			procedureCache[schemaName] = schema;
		}
		var procName = makeProcedureName(namesObject);
		
		var proc = schema[procName];
		var connection = getConnection();
		if (!proc) {
			proc = connection.loadProcedure(schemaName, procName);
			schema[procName] = proc;
		}
		
		var result;
		result = proc.call(connection, parametersObject);
		
		return result;
	}
	
	/**
	*	Insert one row of values and/or expressions into a table.
	*
	*	@function executeInsertValues 
	*	@private
	*	@param namesObject {object | string} Table name or name object.
	*	@param columnAssignments {object} Object mapping column names to values or SQL expressions
	*	@return {int} the number of rows inserted. Should be 1.
	*/
	function executeInsertValues(namesObject, columnAssignments) {
		try {
			var values = [];
			var columnAssignment, columnName;
			for (columnName in columnAssignments) {
				columnAssignment = getColumnAssignment(columnAssignments, columnName);
				
				if (columnAssignment.value !== undefined) {
					values.push(columnAssignment.value);
				}
			}
			var sql = createInsertValuesStatement(namesObject, columnAssignments);
			values.unshift(sql);
			var numRows = getConnection().executeUpdate.apply(connection, values);
			return numRows;
		}
		catch (e){
			error.raise(executeInsertValues, arguments, "", e);
		}
	}

	/**
	 * 	Opens a connection. Connection will have autocommit disabled so you can do multi-statement transactions.
	 *  The connection will be maintained internally and reused when calling other methods that actually do something with it (like, execute queries)
	 *  
	*	@method openConnection 
	*/
	exports.openConnection = openConnection;

	/**
	 * 	Get the connection. Connection should be previously opened by openConnection
	 *  
	*	@method openConnection 
	*	@return {$.hdb.connection} A HDB connection object. See http://help.sap.com/hana/SAP_HANA_XS_JavaScript_API_Reference_en/$.hdb.Connection.html
	*/
	exports.getConnection = getConnection;	
	
	/**
	 * 	Rollback the current transaction.
	 *  
	*	@method rollbackTransaction
	*/
	exports.rollbackTransaction = rollbackTransaction;

	/**
	 * 	Commit the current transaction.
	 *  
	*	@method commitTransaction
	*/
	exports.commitTransaction = commitTransaction;

	/**
	 * 	Close the current connection. Note that you'll need to explicitly call commitTransaction in order to save and changes you made before calling closeConnection.
	 *  
	*	@method closeConnection
	*/
	exports.closeConnection = closeConnection;
	
	/**
	 * 	Utility to get data from a single column from a single table. Returns an object having the column values as keys,
	 *  
	*	@method getRowList
	*	@param namesObject {NamesObject} Identifies the table and column name that is the source of this data.
	*	@return {object} Table data.
	*/
	exports.getRowList = getRowList;

	/**
	 * This helper is used internally and should normally not be called by the user.
	 * Utility to get a column assignment object from a collection of column assignment objects.
	 * If the collection does not contain an assignemnt for the specified column, a NULL assignent is returned.
	 * 
	 * @method getColumnAssignment 
	 * @param columnAssignments {object} a collection of assignments, where the key is the column name and the value is an assignment object.
	 * @param columnName {string} the name of the column for which to retrieve the assignment.
	 */
	exports.getColumnAssignment = getColumnAssignment;
	
	
	/**
	*	A function to call a database stored procedure.
	*	
	*	@function callProcedure
	*	@param namesObject {object |string} name of the procedure.
	*	@param parametersObject {object} Name/value pairs to use as procedure parameters.
	*	@return {$.hdb.ProcedureResult} A procedure result. Resultsets and output parameters can be retrieved from here.
	*/
	exports.callProcedure = callProcedure;

	/**
	*	Insert one row of values and/or expressions into a table.
	*
	*	@method executeInsertValues 
	*	@param namesObject {object | string} Table name or name object.
	*	@param columnAssignments {object} Object mapping column names to values or SQL expressions
	*	@return {int} the number of rows inserted. Should be 1.
	*/
	exports.executeInsertValues = executeInsertValues;

	/**
	 * Run a query on a Calculation view, and return the resultset.
	 * 
	 * @method queryParameterizedCalculationView
	 * @param {object} names object
	 * @param {object} parameters object.
	 * @return {$.hdb.ResultSet}
	 */
	exports.queryParameterizedCalculationView = queryParameterizedCalculationView;
	exports.buildParameterizedCalculationViewQuery = buildParameterizedCalculationViewQuery;
	
	
	/**
	*	Create a fully qualified table name from the names in the nameObject parameter.
	*	The namesObject parameter has the following keys:
	*
	*	- packageName: the name of the package in the .hdbdd file
	*	- contextName: the context in the .hdbdd file
	*	- schemaName: the database schema name
	*	- tableName: the actual unqualified table name.
	*
	*	All these items, except the tableName, will be defaulted with defaults if not specified.
	*
	*	Alternatively, you can also pass a single string representing the unqalified tablename. 
	*	In that case, defaults will be used for all other name parts.
	* 
	*	@method makeTableName
	*	@param {object|string} namesObject Either a bag of different types of names that together make up a fully qualified table name, or a string representing a plain unqualified table name.
	*	@return {string} A single string that represents a fully qualified table name
	*/
	exports.makeTableName = makeTableName;
	
}(this));