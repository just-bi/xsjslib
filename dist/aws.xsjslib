(function(exports){
	
	var Error 	= $.import("error.xsjslib");
	var Time 	= $.import('time.xsjslib');
	
	var AWS = {
		config: {
		  	accessKeyId: undefined,
		  	secretAccessKey: undefined,
		  	region: undefined,
		  	domain: 'amazonaws.com',
		  	update: function(obj){
		  		for(var i in obj)
		  			if(this.hasOwnProperty(i))
		  				this[i] = obj[i];
		  	}
		},
		httpRequest: function(conf){
			var client = new $.net.http.Client();
			//client.setTrustStore('myThrustStore');
			var request = new $.web.WebRequest($.net.http[conf.method], "/"); 
			request.setBody(conf.payload);
			
			for(var header in conf.headers)
				request.headers.set(header, conf.headers[header]);
				
			client.request(request, conf.url);
			var response = client.getResponse();
			client.close();
			return response;
		},
		SNS: function(){
			this.publish = function(targetArn, message){
				var config = this.buildConfig(targetArn, message);
				var request = this.buildRequest(config);
				return AWS.httpRequest(request);
			};
		}
	};

	AWS.SNS.prototype = {
		buildConfig: function (targetArn, message){
			return {
				url: {
					protocol: 'http',
					service: 'sns',
					region: AWS.config.region,
					domain: AWS.config.domain
				},
				method: 'POST',
				params: {
					Action: 'Publish',
					Message: message,
					TargetArn: targetArn,
					Version: '2010-03-31'
				},
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				credential: AWS.config.accessKeyId
			};
		},
		buildRequest: function(config){
			var payload = this.buildPayload(config.params);
			var payloadArrayBuffer = $.security.crypto.sha256(payload);
			var hashedPayload = $.util.codec.encodeHex(payloadArrayBuffer);
		    var request = {
		    	url: this.buildRequestUrl(config.url),
		    	method: config.method,
		    	payload: payload,
		    	headers: this.buildHeaders(config, hashedPayload)
		    };
		    return request;
		},
		buildPayload: function(conf){
	      	var body = [];
	    	for(var key in conf)
	    		body.push(key + '=' + encodeURIComponent(conf[key]))

	    	return body.join('&');
		},
		buildRequestUrl: function(conf){
			return [
	            conf.protocol || 'https',
	            '://',
	            this.buildHost(conf),
	           	conf.path || '/'
	        ].join('');
		},
		buildHost: function(conf){
			if(conf.region == undefined)
				Error.raise("Please provide a region.");
			
			return [
	        	conf.service,
	        	conf.region,
	        	conf.domain
	       	].join('.');
		},
		buildHeaders: function(conf, hashedPayload){
			var now = new Date();
		    var isoDateStr = now.toISOString().replace(/[-:]/g,'').substr(0, 15) + 'Z';
		    var dateStr = isoDateStr.split('T')[0];

			var headers = conf.headers;
			headers['X-Amz-Content-Sha256'] = hashedPayload;
			headers['X-Amz-Date'] = isoDateStr;
			headers['X-Amz-User-Agent'] = 'aws-sdk-js/2.4.9',
			headers['Authorization'] = this.buildAuthHeader(conf, headers, hashedPayload, isoDateStr, dateStr);
			return headers;
		},
		buildAuthHeader: function(conf, generatedHeaders, hashedPayload, isoDateStr, dateStr){
			if(conf.credential == undefined)
				Error.raise('Please provide an Access Key ID.');
			
			return 'AWS4-HMAC-SHA256 '
	    		+ 'Credential=' + conf.credential + '/'
	    		+ dateStr + '/'
	    		+ conf.url.region + '/'
	    		+ conf.url.service + '/'
	    		+ 'aws4_request, '
	    		+ 'SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-user-agent, '
				+ 'Signature=' + this.buildSignature(conf, generatedHeaders, hashedPayload, isoDateStr, dateStr);
		},
		buildSignature: function(conf, generatedHeaders, hashedPayload, isoDateStr, dateStr){
			var cononicalRequest = this.buildCanonicalRequest(conf, generatedHeaders, hashedPayload);
			var crArrayBuffer = $.security.crypto.sha256(cononicalRequest);
	    	var stringToSign = [
	    		'AWS4-HMAC-SHA256',
	    		isoDateStr,
	    		dateStr + '/' + conf.url.region
	    			+ '/' + conf.url.service + '/aws4_request',
	    			$.util.codec.encodeHex(crArrayBuffer)
	    	].join("\n");
	  
	    	var kSecret = AWS.config.secretAccessKey;
	    	if(kSecret == undefined)
	    		Error.raise('Please provide a Secret Access Key.');
	    	
			var kDate = $.security.crypto.sha256(dateStr, 'AWS4' + kSecret);
			var kRegion = $.security.crypto.sha256(conf.url.region, kDate);
			var kService = $.security.crypto.sha256(conf.url.service, kRegion);
			var kSigning = $.security.crypto.sha256('aws4_request', kService);

			var signature = $.security.crypto.sha256(stringToSign, kSigning);

			return $.util.codec.encodeHex(signature);
		},
		buildCanonicalRequest: function(conf, generatedHeaders, hashedPayload){
			var reqStr = [
	    		conf.method,
	    		conf.path || '/',
	    		'',
	    		'host:' + this.buildHost(conf.url)
	    	];

	    	var headerKeys = ['host'];
	    	for(var header in generatedHeaders)
	    		if(header.startsWith('X-Amz-')){
	    			var h = header.toLowerCase();
	    			reqStr.push(h + ':' + generatedHeaders[header]);
	    			headerKeys.push(h);
	    		}

	    	reqStr.push('');
	        reqStr.push(headerKeys.join(';'));
	        reqStr.push(hashedPayload);
	        reqStr = reqStr.join("\n");

	        return reqStr;
		}
	};
	
	exports.AWS = AWS;
	
})(this);



