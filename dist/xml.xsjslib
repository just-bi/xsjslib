(function(exports){
/**
 * class xml
 * @static
 */
	var err = $.import("error.xsjslib");
	var entities = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"'": "&apos;",
		"\"": "&quot;"
	};
	
	/**
	 * Takes a string and escapes characters &, < and > to their respective XML entities.
	 * @method escapeXmlText
	 * 
	 */
	function escapeXmlText(value) {
		return value.replace(/[&<>]/g, function(match){
			return entities[match];
		});
	}

	/**
	 * Takes a string and escapes characters &, <, >, ' and " to their respective XML entities.
	 * @method escapeXmlAtt
	 * 
	 */
	function escapeXmlAtt(value) {
		return value.replace(/[&<>'"]/g, function(match){
			return entities[match];
		});
	}

	var SaxParserWrapper;
	(SaxParserWrapper = function(conf){
		this.init(conf);
	}).prototype = {
		xmlnsxml: "http://www.w3.org/XML/1998/namespace",
		setHandler: function(name, handler){
			this.parser[name] = handler;
		},
		initHandlers: function(){
			var handler, handlers = this.handlers, parser = this.parser;
			for (handler in handlers) {
				parser[handler] = handlers[handler];
			}
		},
		initNamespaces: function(conf){
			//see https://www.w3.org/XML/1998/namespace. 
			//this namespace is reserved and bound by definition to prefix xml.
			this.namespaces = {};
			this.namespaces[this.xmlnsxml] = "xml";
			this.namespaceCount = 0;
			var namespace, prefix, namespaces = conf.namespaces || {};
			for (namespace in namespaces){
				prefix = namespaces[namespace];
				this.addNamespace(namespace, prefix);
			}
		},
		init: function(conf){
			this.initNamespaces(conf);
			this.attsToIgnore = conf.attsToIgnore || {};
			this.elsToIgnore = conf.elsToIgnore || {};
			this.encoding = conf.encoding || "UTF-8";
			this.handlers = conf.handlers || {};
			this.parser = new $.util.SAXParser();
			this.initHandlers();
		},
		addNamespace: function(ns, prefix){
			if (prefix === undefined) {
				prefix = "ns" + (++this.namespaceCount);
			}
			this.namespaces[ns] = prefix;
			return prefix;
		},
		eachNamespace: function(callback){
			var ns, prefix, namespaces = this.namespaces;
			for (ns in namespaces) {
				if (ns === this.xmlnsxml) {
					continue;
				}
				prefix = namespaces[ns];
				callback.call(null, ns, prefix);
			}
		},
		getNsPrefix: function(ns){
			var prefix = this.namespaces[ns];
			if (prefix === undefined) {
				prefix = this.addNamespace(ns);
			}
			return prefix;
		},
		rewriteName: function(name){
			//get the index of the delimiter between namespace and name
			var index;
			index = name.lastIndexOf(":");
			if (index === -1){
				//no namespace: nothing to rewrite.
				return name;
			}
			
			//get the namespace.
			var ns, n, prefix;
			ns = name.substr(0, index);
			//find the namespace prefix
			prefix = this.getNsPrefix(ns);
			//get the name (after the prefix
			name = name.substr(index+1);
			
			//replace namespace with prefix.
			if (prefix !== "") {
				name = prefix + ":" + name;
			}
			return name;
		},
		writeAtts: function (atts){
			var name, value;
			for (name in atts){
				value = atts[name];
				this.writeAtt(name, value);
			}
		},
		writeAtt: function(name, value){
			if (this.attsToIgnore[name] === true){
				return;
			}
			name = this.rewriteName(name);
			this.appendCurrent(" " + name + "=\"" + escapeXmlAtt(value) + "\"")
		},
		writeElement: function (name, atts){
			if (this.elsToIgnore[name] === true){
				return;
			}
			var el = this.rewriteName(name);
			if (atts === false) {
				this.write("</" + el + ">");
			}
			else {
				el = "<" + el;
				this.write(el);
				this.writeAtts(atts);
				this.write(">");
			}
		},
		appendCurrent: function(s){
			var buff = this.buffer;
			var pos = buff.length - 1;
			buff[pos] = buff[pos] + s; 
		},
		write: function(s){
			this.buffer.push(s);
		},
		clearBuffer: function(){
			this.buffer.length = 0;
		},
		getBuffer: function(){
			return this.buffer;
		},
		getBufferAsString: function(){
			return this.buffer.join("");
		},
		parse: function(document){
			this.buffer = [];
			this.parser.parse(document, this.encoding);
			return this.getBufferAsString();
		}
	};
	
	function mapXml(document, searchPath, nameAttribute, valueAttribute){
		switch (typeof searchPath) {
			case "string":
				break;
			case "object":
				if (searchPath.constructor === Array) {
					searchPath = searchPath.join("/");
					break;
				}
			default:
				err.raise(mapXml, arguments, "Argument searchPath must be either an array of strings or a string.");
		}
		
		var map = {}, n, v;
		var elementStack = [];
		var parser = new $.util.SAXParser();
		parser.startElementHandler = function(name, atts){
			elementStack.push(name);
			var currentPath = elementStack.join("/");
			if (currentPath.lastIndexOf(searchPath) + searchPath.length !== currentPath.length) {
				return false;
			}
			n = atts[nameAttribute];
			if (!n) {
				return false;
			}
			map[n] = atts[valueAttribute];
		};
		parser.endElementHandler = function(name){
			var startElement = elementStack[elementStack.length - 1];
			if (startElement !== name) {
				err.raise(
					"getSheetsFromWorkbook", 
					arguments,
					"End element " + name + " does not match start element " + startElement
				);
			}
			elementStack.pop();
		};
		
		//parse /xl/workbook.xml. This gives us a name/id map.
		parser.parse(document);
		return map;
	}
	
	exports.escapeXmlText = escapeXmlText;
	exports.escapeXmlAtt = escapeXmlAtt;
	exports.mapXml = mapXml;
	
	/**
	 * Creates a wrapper around the $.util.SAXParser
	 * see: http://help.sap.com/hana/SAP_HANA_XS_JavaScript_API_Reference_en/$.util.SAXParser.html
	 * 
	 * @class SaxParserWrapper
	 * @constructor
	 */
	exports.SaxParserWrapper = SaxParserWrapper;

}(this));