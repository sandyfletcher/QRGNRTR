var QRCode; // Declare the QRCode variable in the global scope.  This will hold the main QRCode object.

(function () { // Wrap the entire code in an immediately invoked function expression (IIFE). This creates a private scope, preventing variable name collisions with other code.

	/**
	 * @class QR8bitByte
	 * @constructor
	 * @param {String} data  The data string to be encoded.
	 * Represents data encoded in 8-bit byte mode.  This supports UTF-8 characters.
	 */
	function QR8bitByte(data) {
		this.mode = QRMode.MODE_8BIT_BYTE; // Set the mode to 8-bit byte.  Indicates how the data is interpreted.
		this.data = data; // Store the original data string.
		this.parsedData = []; // Initialize an array to hold the parsed data (byte array).

		// Added to support UTF-8 Characters
		// Iterate through the data string to convert each character into a byte array that represents the UTF-8 encoding of the character.
		for (var i = 0, l = this.data.length; i < l; i++) {
			var byteArray = []; // Array to hold the byte representation of a single character.
			var code = this.data.charCodeAt(i); // Get the Unicode code point of the character at the current index.

			// Handle different Unicode code point ranges to create the appropriate UTF-8 byte sequence.
			if (code > 0x10000) { // Characters outside the Basic Multilingual Plane (BMP)
				byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18); // First byte
				byteArray[1] = 0x80 | ((code & 0x3F000) >>> 12); // Second byte
				byteArray[2] = 0x80 | ((code & 0xFC0) >>> 6); // Third byte
				byteArray[3] = 0x80 | (code & 0x3F); // Fourth byte
			} else if (code > 0x800) { // Characters in the range U+0800 to U+FFFF
				byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12); // First byte
				byteArray[1] = 0x80 | ((code & 0xFC0) >>> 6); // Second byte
				byteArray[2] = 0x80 | (code & 0x3F); // Third byte
			} else if (code > 0x80) { // Characters in the range U+0080 to U+07FF
				byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6); // First byte
				byteArray[1] = 0x80 | (code & 0x3F); // Second byte
			} else { // Characters in the range U+0000 to U+007F (ASCII)
				byteArray[0] = code; // The code point is the byte itself.
			}

			this.parsedData.push(byteArray); // Push the byte array to the parsed data.
		}

		this.parsedData = Array.prototype.concat.apply([], this.parsedData); // Flatten the array of byte arrays into a single byte array.

		// Handle potential UTF-8 encoding issues.  Prepends a UTF-8 Byte Order Mark (BOM) if the parsed data length doesn't match the original data length. This is a workaround for some character encoding edge cases.
		if (this.parsedData.length != this.data.length) {
			this.parsedData.unshift(191); // Prepend 0xEF
			this.parsedData.unshift(187); // Prepend 0xBB
			this.parsedData.unshift(239); // Prepend 0xBF
		}
	}

	// Define the prototype of QR8bitByte to add the getLength and write functions to it.
	QR8bitByte.prototype = {
		/**
		 * Get the length of the data.
		 * @param {QRBitBuffer} buffer  The bit buffer.
		 * @return {Number} The length of the data.
		 */
		getLength: function (buffer) {
			return this.parsedData.length; // Return the length of the parsed data.
		},

		/**
		 * Write the data to the buffer.
		 * @param {QRBitBuffer} buffer  The bit buffer.
		 */
		write: function (buffer) {
			// Write each byte of the parsed data into the provided bit buffer.
			for (var i = 0, l = this.parsedData.length; i < l; i++) {
				buffer.put(this.parsedData[i], 8); // Write the current byte (8 bits) to the buffer.
			}
		}
	};

	/**
	 * @class QRCodeModel
	 * @constructor
	 * @param {Number} typeNumber  The type number of the QR code (1-40).  Determines the size and data capacity.
	 * @param {QRErrorCorrectLevel} errorCorrectLevel  The error correction level.
	 * This class represents the core QR code data model.  It manages the modules (pixels), data storage, and encoding process.
	 */
	function QRCodeModel(typeNumber, errorCorrectLevel) {
		this.typeNumber = typeNumber; // Store the QR code type number.
		this.errorCorrectLevel = errorCorrectLevel; // Store the error correction level.
		this.modules = null; // Initialize the modules (2D array representing the QR code) to null.
		this.moduleCount = 0; // Initialize the module count (size of the QR code) to 0.
		this.dataCache = null; // Initialize the data cache to null.  Used to store pre-processed data.
		this.dataList = []; // Initialize the data list to an empty array.  This holds the data blocks to be encoded.
	}

	// Define the prototype of QRCodeModel to add functions.
	QRCodeModel.prototype={
		/**
		 * Add data to the QR code.
		 * @param {String} data  The data to be added.
		 */
		addData:function(data){
			var newData=new QR8bitByte(data); // Create a new QR8bitByte object from the input data.
			this.dataList.push(newData); // Add the new data object to the data list.
			this.dataCache=null; // Reset the data cache because new data has been added.
		},

		/**
		 * Check if a module (pixel) is dark.
		 * @param {Number} row  The row index.
		 * @param {Number} col  The column index.
		 * @return {Boolean} True if the module is dark, false otherwise.
		 */
		isDark:function(row,col){
			if(row<0||this.moduleCount<=row||col<0||this.moduleCount<=col){ // Check if the row and column are within the bounds of the QR code.
				throw new Error(row+","+col); // Throw an error if the row or column is out of bounds.
			}
			return this.modules[row][col]; // Return the value of the module at the specified row and column (true for dark, false for light).
		},

		/**
		 * Get the module count (size) of the QR code.
		 * @return {Number} The module count.
		 */
		getModuleCount:function(){
			return this.moduleCount; // Return the module count.
		},

		/**
		 * Make the QR code.
		 */
		make:function(){
			this.makeImpl(false,this.getBestMaskPattern()); // Call the makeImpl function with test set to false (actual QR code generation) and the best mask pattern.
		},

		/**
		 * Make the QR code implementation.
		 * @param {Boolean} test  Whether to test the mask pattern.
		 * @param {Number} maskPattern  The mask pattern to use.
		 */
		makeImpl:function(test,maskPattern){
			this.moduleCount=this.typeNumber*4+17; // Calculate the module count based on the type number.
			this.modules=new Array(this.moduleCount); // Create a new 2D array to represent the QR code modules.
			for(var row=0;row<this.moduleCount;row++){
				this.modules[row]=new Array(this.moduleCount);
				for(var col=0;col<this.moduleCount;col++){
					this.modules[row][col]=null; // Initialize all modules to null.
				}
			}

			this.setupPositionProbePattern(0,0); // Set up the position probe patterns (the three squares in the corners).
			this.setupPositionProbePattern(this.moduleCount-7,0);
			this.setupPositionProbePattern(0,this.moduleCount-7);
			this.setupPositionAdjustPattern(); // Set up the position adjustment patterns (smaller squares for larger QR codes).
			this.setupTimingPattern(); // Set up the timing pattern (alternating black and white modules).
			this.setupTypeInfo(test,maskPattern); // Set up the type information (error correction level and mask pattern).
			if(this.typeNumber>=7){
				this.setupTypeNumber(test); // Set up the type number information (for QR codes of type 7 and higher).
			}

			if(this.dataCache==null){
				this.dataCache=QRCodeModel.createData(this.typeNumber,this.errorCorrectLevel,this.dataList); // Create the data bytes and error correction bytes.
			}
			this.mapData(this.dataCache,maskPattern); // Map the data bytes and error correction bytes to the QR code modules, applying the mask pattern.
		},

		/**
		 * Set up the position probe pattern.
		 * @private
		 * @param {Number} row  The row index.
		 * @param {Number} col  The column index.
		 */
		setupPositionProbePattern:function(row,col){
			// Iterate over the 7x7 area of the position probe pattern.
			for(var r=-1;r<=7;r++){
				if(row+r<=-1||this.moduleCount<=row+r)continue; // Skip if the current row is out of bounds.
				for(var c=-1;c<=7;c++){
					if(col+c<=-1||this.moduleCount<=col+c)continue; // Skip if the current column is out of bounds.
					// Define the pattern of black and white modules within the position probe pattern.
					if((0<=r&&r<=6&&(c==0||c==6))||(0<=c&&c<=6&&(r==0||r==6))||(2<=r&&r<=4&&2<=c&&c<=4)){
						this.modules[row+r][col+c]=true; // Set the module to true (dark).
					}else{
						this.modules[row+r][col+c]=false; // Set the module to false (light).
					}
				}
			}
		},

		/**
		 * Get the best mask pattern.
		 * @return {Number} The best mask pattern.
		 */
		getBestMaskPattern:function(){
			var minLostPoint=0; // Initialize the minimum lost point to 0.  Lost points are a measure of how well the mask pattern distributes dark and light modules.
			var pattern=0; // Initialize the best pattern to 0.
			// Iterate over all 8 mask patterns.
			for(var i=0;i<8;i++){
				this.makeImpl(true,i); // Call the makeImpl function with test set to true (to test the mask pattern) and the current mask pattern.
				var lostPoint=QRUtil.getLostPoint(this); // Calculate the lost point for the current mask pattern.
				if(i==0||minLostPoint>lostPoint){ // If this is the first pattern or the lost point is lower than the current minimum.
					minLostPoint=lostPoint; // Update the minimum lost point.
					pattern=i; // Update the best pattern.
				}
			}
			return pattern; // Return the best mask pattern.
		},

		/**
		 * Set up the timing pattern.
		 * @private
		 */
		setupTimingPattern:function(){
			// Iterate over the horizontal timing pattern.
			for(var r=8;r<this.moduleCount-8;r++){
				if(this.modules[r][6]!=null){ // Skip if the module is already set.
					continue;
				}
				this.modules[r][6]=(r%2==0); // Set the module to true (dark) if the row is even, false (light) otherwise.
			}
			// Iterate over the vertical timing pattern.
			for(var c=8;c<this.moduleCount-8;c++){
				if(this.modules[6][c]!=null){ // Skip if the module is already set.
					continue;
				}
				this.modules[6][c]=(c%2==0); // Set the module to true (dark) if the column is even, false (light) otherwise.
			}
		},

		/**
		 * Set up the position adjustment pattern.
		 * @private
		 */
		setupPositionAdjustPattern:function(){
			var pos=QRUtil.getPatternPosition(this.typeNumber); // Get the positions of the position adjustment patterns.
			// Iterate over the positions.
			for(var i=0;i<pos.length;i++){
				for(var j=0;j<pos.length;j++){
					var row=pos[i]; // Get the row.
					var col=pos[j]; // Get the column.
					if(this.modules[row][col]!=null){ // Skip if the module is already set.
						continue;
					}
					// Iterate over the 5x5 area of the position adjustment pattern.
					for(var r=-2;r<=2;r++){
						for(var c=-2;c<=2;c++){
							// Define the pattern of black and white modules within the position adjustment pattern.
							if(r==-2||r==2||c==-2||c==2||(r==0&&c==0)){
								this.modules[row+r][col+c]=true; // Set the module to true (dark).
							}else{
								this.modules[row+r][col+c]=false; // Set the module to false (light).
							}
						}
					}
				}
			}
		},

		/**
		 * Set up the type number information.
		 * @private
		 * @param {Boolean} test  Whether to test the mask pattern.
		 */
		setupTypeNumber:function(test){
			var bits=QRUtil.getBCHTypeNumber(this.typeNumber); // Get the BCH-encoded type number bits.
			// Iterate over the 18 bits.
			for(var i=0;i<18;i++){
				var mod=(!test&&((bits>>i)&1)==1); // Get the bit value.
				this.modules[Math.floor(i/3)][i%3+this.moduleCount-8-3]=mod; // Set the module value.
			}
			// Iterate over the 18 bits again (mirror).
			for(var i=0;i<18;i++){
				var mod=(!test&&((bits>>i)&1)==1); // Get the bit value.
				this.modules[i%3+this.moduleCount-8-3][Math.floor(i/3)]=mod; // Set the module value.
			}
		},

		/**
		 * Set up the type information.
		 * @private
		 * @param {Boolean} test  Whether to test the mask pattern.
		 * @param {Number} maskPattern  The mask pattern.
		 */
		setupTypeInfo:function(test,maskPattern){
			var data=(this.errorCorrectLevel<<3)|maskPattern; // Combine the error correction level and mask pattern into a single data value.
			var bits=QRUtil.getBCHTypeInfo(data); // Get the BCH-encoded type information bits.
			// Iterate over the 15 bits.
			for(var i=0;i<15;i++){
				var mod=(!test&&((bits>>i)&1)==1); // Get the bit value.
				if(i<6){
					this.modules[i][8]=mod; // Set the module value.
				}else if(i<8){
					this.modules[i+1][8]=mod; // Set the module value.
				}else{
					this.modules[this.moduleCount-15+i][8]=mod; // Set the module value.
				}
			}
			// Iterate over the 15 bits again (mirror).
			for(var i=0;i<15;i++){
				var mod=(!test&&((bits>>i)&1)==1); // Get the bit value.
				if(i<8){
					this.modules[8][this.moduleCount-i-1]=mod; // Set the module value.
				}else if(i<9){
					this.modules[8][15-i-1+1]=mod; // Set the module value.
				}else{
					this.modules[8][15-i-1]=mod; // Set the module value.
				}
			}
			this.modules[this.moduleCount-8][8]=(!test); // Set the always-dark module.
		},

		/**
		 * Map the data to the QR code modules.
		 * @private
		 * @param {Array<Number>} data  The data bytes.
		 * @param {Number} maskPattern  The mask pattern.
		 */
		mapData:function(data,maskPattern){
			var inc=-1; // Initialize the increment to -1 (moves up the columns).
			var row=this.moduleCount-1; // Initialize the row to the bottom row.
			var bitIndex=7; // Initialize the bit index to 7 (most significant bit).
			var byteIndex=0; // Initialize the byte index to 0.
			// Iterate over the columns from right to left, skipping the timing pattern column.
			for(var col=this.moduleCount-1;col>0;col-=2){
				if(col==6)col--; // Skip the timing pattern column.
				// Iterate over the columns (up and down).
				while(true){
					for(var c=0;c<2;c++){
						if(this.modules[row][col-c]==null){ // If the module is not set yet.
							var dark=false; // Initialize the dark value to false (light).
							if(byteIndex<data.length){ // If there are more data bytes.
								dark=(((data[byteIndex]>>>bitIndex)&1)==1); // Get the bit value from the current byte.
							}
							var mask=QRUtil.getMask(maskPattern,row,col-c); // Get the mask value for the current module.
							if(mask){ // If the mask is applied.
								dark=!dark; // Invert the dark value.
							}
							this.modules[row][col-c]=dark; // Set the module value.
							bitIndex--; // Decrement the bit index.
							if(bitIndex==-1){ // If the bit index is -1 (all bits in the current byte have been used).
								byteIndex++; // Increment the byte index.
								bitIndex=7; // Reset the bit index to 7.
							}
						}
					}
					row+=inc; // Increment the row by the increment value.
					if(row<0||this.moduleCount<=row){ // If the row is out of bounds.
						row-=inc; // Reset the row to the previous value.
						inc=-inc; // Invert the increment value (change direction).
						break; // Exit the inner loop.
					}
				}
			}
		}
	};

	QRCodeModel.PAD0=0xEC; // Define the padding byte 0.
	QRCodeModel.PAD1=0x11; // Define the padding byte 1.

	/**
	 * Create the data bytes and error correction bytes.
	 * @param {Number} typeNumber  The type number of the QR code.
	 * @param {QRErrorCorrectLevel} errorCorrectLevel  The error correction level.
	 * @param {Array<QR8bitByte>} dataList  The list of data objects.
	 * @return {Array<Number>} The data bytes and error correction bytes.
	 */
	QRCodeModel.createData=function(typeNumber,errorCorrectLevel,dataList){
		var rsBlocks=QRRSBlock.getRSBlocks(typeNumber,errorCorrectLevel); // Get the Reed-Solomon blocks.
		var buffer=new QRBitBuffer(); // Create a new bit buffer.
		// Iterate over the data objects.
		for(var i=0;i<dataList.length;i++){
			var data=dataList[i]; // Get the current data object.
			buffer.put(data.mode,4); // Write the mode indicator to the buffer.
			buffer.put(data.getLength(),QRUtil.getLengthInBits(data.mode,typeNumber)); // Write the data length to the buffer.
			data.write(buffer); // Write the data to the buffer.
		}

		var totalDataCount=0; // Initialize the total data count to 0.
		// Iterate over the Reed-Solomon blocks.
		for(var i=0;i<rsBlocks.length;i++){
			totalDataCount+=rsBlocks[i].dataCount; // Add the data count of the current block to the total data count.
		}
		// Check if the code length is overflowing.
		if(buffer.getLengthInBits()>totalDataCount*8){
			throw new Error("code length overflow. ("
			+buffer.getLengthInBits()
			+">"
			+totalDataCount*8
			+")");
		}
		// Add terminator if possible
		if(buffer.getLengthInBits()+4<=totalDataCount*8){
			buffer.put(0,4);
		}

		// Padding
		while(buffer.getLengthInBits()%8!=0){
			buffer.putBit(false);
		}

		// Padding
		while(true){
			if(buffer.getLengthInBits()>=totalDataCount*8){
				break;
			}
			buffer.put(QRCodeModel.PAD0,8);
			if(buffer.getLengthInBits()>=totalDataCount*8){
				break;
			}
			buffer.put(QRCodeModel.PAD1,8);
		}
		return QRCodeModel.createBytes(buffer,rsBlocks); // Create the bytes from the buffer and Reed-Solomon blocks.
	};

	/**
	 * Create the bytes from the bit buffer and Reed-Solomon blocks.
	 * @param {QRBitBuffer} buffer  The bit buffer.
	 * @param {Array<QRRSBlock>} rsBlocks  The Reed-Solomon blocks.
	 * @return {Array<Number>} The data bytes and error correction bytes.
	 */
	QRCodeModel.createBytes=function(buffer,rsBlocks){
		var offset=0; // Initialize the offset to 0.
		var maxDcCount=0; // Initialize the maximum data count to 0.
		var maxEcCount=0; // Initialize the maximum error correction count to 0.
		var dcdata=new Array(rsBlocks.length); // Create a new array to hold the data code words.
		var ecdata=new Array(rsBlocks.length); // Create a new array to hold the error correction code words.
		// Iterate over the Reed-Solomon blocks.
		for(var r=0;r<rsBlocks.length;r++){
			var dcCount=rsBlocks[r].dataCount; // Get the data count.
			var ecCount=rsBlocks[r].totalCount-dcCount; // Get the error correction count.
			maxDcCount=Math.max(maxDcCount,dcCount); // Update the maximum data count.
			maxEcCount=Math.max(maxEcCount,ecCount); // Update the maximum error correction count.
			dcdata[r]=new Array(dcCount); // Create a new array to hold the data code words for the current block.
			// Copy the data from the buffer to the data code words array.
			for(var i=0;i<dcdata[r].length;i++){
				dcdata[r][i]=0xff&buffer.buffer[i+offset]; // Get the byte from the buffer and store it in the array.
			}
			offset+=dcCount; // Increment the offset by the data count.
			var rsPoly=QRUtil.getErrorCorrectPolynomial(ecCount); // Get the error correction polynomial.
			var rawPoly=new QRPolynomial(dcdata[r],rsPoly.getLength()-1); // Create a new polynomial from the data code words.
			var modPoly=rawPoly.mod(rsPoly); // Calculate the remainder polynomial.
			ecdata[r]=new Array(rsPoly.getLength()-1); // Create a new array to hold the error correction code words for the current block.
			// Copy the error correction code words from the remainder polynomial to the error correction code words array.
			for(var i=0;i<ecdata[r].length;i++){
				var modIndex=i+modPoly.getLength()-ecdata[r].length; // Calculate the index into the remainder polynomial.
				ecdata[r][i]=(modIndex>=0)?modPoly.get(modIndex):0; // Get the byte from the remainder polynomial and store it in the array.
			}
		}

		var totalCodeCount=0; // Initialize the total code count to 0.
		// Iterate over the Reed-Solomon blocks.
		for(var i=0;i<rsBlocks.length;i++){
			totalCodeCount+=rsBlocks[i].totalCount; // Add the total count of the current block to the total code count.
		}
		var data=new Array(totalCodeCount); // Create a new array to hold the data bytes and error correction bytes.
		var index=0; // Initialize the index to 0.
		// Interleave the data code words.
		for(var i=0;i<maxDcCount;i++){
			for(var r=0;r<rsBlocks.length;r++){
				if(i<dcdata[r].length){
					data[index++]=dcdata[r][i]; // Copy the data code word from the data code words array to the data array.
				}
			}
		}
		// Interleave the error correction code words.
		for(var i=0;i<maxEcCount;i++){
			for(var r=0;r<rsBlocks.length;r++){
				if(i<ecdata[r].length){
					data[index++]=ecdata[r][i]; // Copy the error correction code word from the error correction code words array to the data array.
				}
			}
		}
		return data; // Return the data bytes and error correction bytes.
	};

	// Define the QR code modes.  These represent the types of data that can be encoded.
	var QRMode={
		MODE_NUMBER:1<<0, // Numeric mode
		MODE_ALPHA_NUM:1<<1, // Alphanumeric mode
		MODE_8BIT_BYTE:1<<2, // 8-bit byte mode (used for UTF-8)
		MODE_KANJI:1<<3 // Kanji mode (for Japanese characters)
	};

	// Define the error correction levels.  These determine the amount of redundancy added to the QR code, allowing it to be read even if damaged.
	var QRErrorCorrectLevel={
		L:1, // Low
		M:0, // Medium
		Q:3, // Quartile
		H:2 // High
	};

	// Define the mask patterns.  These are used to distribute the dark and light modules in the QR code, improving readability.
	var QRMaskPattern={
		PATTERN000:0, // (i + j) % 2 == 0
		PATTERN001:1, // i % 2 == 0
		PATTERN010:2, // j % 3 == 0
		PATTERN011:3, // (i + j) % 3 == 0
		PATTERN100:4, // (floor(i / 2) + floor(j / 3)) % 2 == 0
		PATTERN101:5, // (i * j) % 2 + (i * j) % 3 == 0
		PATTERN110:6, // ((i * j) % 2 + (i * j) % 3) % 2 == 0
		PATTERN111:7 // ((i * j) % 3 + (i + j) % 2) % 2 == 0
	};

	// Define the utility functions for QR code generation.
	var QRUtil={
		PATTERN_POSITION_TABLE:[
			[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]
		],

		G15:(1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|(1<<0), // Generator polynomial for BCH error correction (15, 5)
		G18:(1<<12)|(1<<11)|(1<<10)|(1<<9)|(1<<8)|(1<<5)|(1<<2)|(1<<0), // Generator polynomial for BCH error correction (18, 8)
		G15_MASK:(1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1), // Mask for BCH error correction (15, 5)

		/**
		 * Calculate the BCH code for the type information.
		 * @param {Number} data  The type information data.
		 * @return {Number} The BCH code.
		 */
		getBCHTypeInfo:function(data){
			var d=data<<10; // Shift the data left by 10 bits.
			while(QRUtil.getBCHDigit(d)-QRUtil.getBCHDigit(QRUtil.G15)>=0){ // While the degree of d is greater than or equal to the degree of G15.
				d^=(QRUtil.G15<<(QRUtil.getBCHDigit(d)-QRUtil.getBCHDigit(QRUtil.G15))); // XOR d with G15 shifted left by the difference in degrees.
			}
			return((data<<10)|d)^QRUtil.G15_MASK; // Return the BCH code.
		},

		/**
		 * Calculate the BCH
         * code for the type number.
		 * @param {Number} data  The type number data.
		 * @return {Number} The BCH code.
		 */
		getBCHTypeNumber:function(data){
			var d=data<<12; // Shift the data left by 12 bits.
			while(QRUtil.getBCHDigit(d)-QRUtil.getBCHDigit(QRUtil.G18)>=0){ // While the degree of d is greater than or equal to the degree of G18.
				d^=(QRUtil.G18<<(QRUtil.getBCHDigit(d)-QRUtil.getBCHDigit(QRUtil.G18))); // XOR d with G18 shifted left by the difference in degrees.
			}
			return(data<<12)|d; // Return the BCH code.
		},

		/**
		 * Get the digit of the BCH code.
		 * @param {Number} data  The BCH code.
		 * @return {Number} The digit of the BCH code.
		 */
		getBCHDigit:function(data){
			var digit=0; // Initialize the digit to 0.
			while(data!=0){ // While the data is not 0.
				digit++; // Increment the digit.
				data>>>=1; // Shift the data right by 1 bit.
			}
			return digit; // Return the digit.
		},

		/**
		 * Get the pattern position.
		 * @param {Number} typeNumber  The type number of the QR code.
		 * @return {Array<Number>} The pattern position.
		 */
		getPatternPosition:function(typeNumber){
			return QRUtil.PATTERN_POSITION_TABLE[typeNumber-1]; // Return the pattern position from the table.
		},

		/**
		 * Get the mask.
		 * @param {Number} maskPattern  The mask pattern.
		 * @param {Number} i  The row index.
		 * @param {Number} j  The column index.
		 * @return {Boolean} The mask value.
		 */
		getMask:function(maskPattern,i,j){
			switch(maskPattern){
				case QRMaskPattern.PATTERN000:return(i+j)%2==0; // (i + j) % 2 == 0
				case QRMaskPattern.PATTERN001:return i%2==0; // i % 2 == 0
				case QRMaskPattern.PATTERN010:return j%3==0; // j % 3 == 0
				case QRMaskPattern.PATTERN011:return(i+j)%3==0; // (i + j) % 3 == 0
				case QRMaskPattern.PATTERN100:return(Math.floor(i/2)+Math.floor(j/3))%2==0; // (floor(i / 2) + floor(j / 3)) % 2 == 0
				case QRMaskPattern.PATTERN101:return(i*j)%2+(i*j)%3==0; // (i * j) % 2 + (i * j) % 3 == 0
				case QRMaskPattern.PATTERN110:return((i*j)%2+(i*j)%3)%2==0; // ((i * j) % 2 + (i * j) % 3) % 2 == 0
				case QRMaskPattern.PATTERN111:return((i*j)%3+(i+j)%2)%2==0; // ((i * j) % 3 + (i + j) % 2) % 2 == 0
				default:throw new Error("bad maskPattern:"+maskPattern); // Throw an error if the mask pattern is invalid.
			}
		},

		/**
		 * Get the error correction polynomial.
		 * @param {Number} errorCorrectLength  The error correction length.
		 * @return {QRPolynomial} The error correction polynomial.
		 */
		getErrorCorrectPolynomial:function(errorCorrectLength){
			var a=new QRPolynomial([1],0); // Create a new polynomial with a single term of 1.
			// Iterate over the error correction length.
			for(var i=0;i<errorCorrectLength;i++){
				a=a.multiply(new QRPolynomial([1,QRMath.gexp(i)],0)); // Multiply the polynomial by (x + gexp(i)).
			}
			return a; // Return the error correction polynomial.
		},

		/**
		 * Get the length in bits for the given mode and type.
		 * @param {QRMode} mode The QR code mode.
		 * @param {Number} type The QR code type number.
		 * @return {Number} The length in bits.
		 */
		getLengthInBits:function(mode,type){
			if(1<=type&&type<10){ // Type 1-9
				switch(mode){
					case QRMode.MODE_NUMBER:return 10; // Numeric mode
					case QRMode.MODE_ALPHA_NUM:return 9; // Alphanumeric mode
					case QRMode.MODE_8BIT_BYTE:return 8; // 8-bit byte mode
					case QRMode.MODE_KANJI:return 8; // Kanji mode
					default:throw new Error("mode:"+mode); // Throw an error if the mode is invalid.
				}
			}else if(type<27){ // Type 10-26
				switch(mode){
					case QRMode.MODE_NUMBER:return 12; // Numeric mode
					case QRMode.MODE_ALPHA_NUM:return 11; // Alphanumeric mode
					case QRMode.MODE_8BIT_BYTE:return 16; // 8-bit byte mode
					case QRMode.MODE_KANJI:return 10; // Kanji mode
					default:throw new Error("mode:"+mode); // Throw an error if the mode is invalid.
				}
			}else if(type<41){ // Type 27-40
				switch(mode){
					case QRMode.MODE_NUMBER:return 14; // Numeric mode
					case QRMode.MODE_ALPHA_NUM:return 13; // Alphanumeric mode
					case QRMode.MODE_8BIT_BYTE:return 16; // 8-bit byte mode
					case QRMode.MODE_KANJI:return 12; // Kanji mode
					default:throw new Error("mode:"+mode); // Throw an error if the mode is invalid.
				}
			}else{
				throw new Error("type:"+type); // Throw an error if the type is invalid.
			}
		},

		/**
		 * Get the lost point.
		 * @param {QRCodeModel} qrCode The QR code model.
		 * @return {Number} The lost point.
		 */
		getLostPoint:function(qrCode){
			var moduleCount=qrCode.getModuleCount(); // Get the module count.
			var lostPoint=0; // Initialize the lost point to 0.
			// Iterate over all modules.
			for(var row=0;row<moduleCount;row++){
				for(var col=0;col<moduleCount;col++){
					var sameCount=0; // Initialize the same count to 0.
					var dark=qrCode.isDark(row,col); // Get the value of the module.
					// Iterate over the surrounding modules.
					for(var r=-1;r<=1;r++){
						if(row+r<0||moduleCount<=row+r){ // If the row is out of bounds.
							continue; // Skip.
						}
						for(var c=-1;c<=1;c++){
							if(col+c<0||moduleCount<=col+c){ // If the column is out of bounds.
								continue; // Skip.
							}
							if(r==0&&c==0){ // If it's the current module.
								continue; // Skip.
							}
							if(dark==qrCode.isDark(row+r,col+c)){ // If the surrounding module has the same value as the current module.
								sameCount++; // Increment the same count.
							}
						}
					}
					if(sameCount>5){ // If there are more than 5 surrounding modules with the same value.
						lostPoint+=(3+sameCount-5); // Add the lost point.
					}
				}
			}

			// Black and white blocks detection.
			for(var row=0;row<moduleCount-1;row++){
				for(var col=0;col<moduleCount-1;col++){
					var count=0; // Initialize the count to 0.
					if(qrCode.isDark(row,col))count++; // If the module is dark, increment the count.
					if(qrCode.isDark(row+1,col))count++; // If the module below is dark, increment the count.
					if(qrCode.isDark(row,col+1))count++; // If the module to the right is dark, increment the count.
					if(qrCode.isDark(row+1,col+1))count++; // If the module to the bottom-right is dark, increment the count.
					if(count==0||count==4){ // If all modules are the same color.
						lostPoint+=3; // Add the lost point.
					}
				}
			}

			// Vertical/horizontal line detection.
			for(var row=0;row<moduleCount;row++){
				for(var col=0;col<moduleCount-6;col++){
					if(qrCode.isDark(row,col)&&!qrCode.isDark(row,col+1)&&qrCode.isDark(row,col+2)&&qrCode.isDark(row,col+3)&&qrCode.isDark(row,col+4)&&!qrCode.isDark(row,col+5)&&qrCode.isDark(row,col+6)){ // If there is a pattern of dark-light-dark-dark-dark-light-dark.
						lostPoint+=40; // Add the lost point.
					}
				}
			}

			for(var col=0;col<moduleCount;col++){
				for(var row=0;row<moduleCount-6;row++){
					if(qrCode.isDark(row,col)&&!qrCode.isDark(row+1,col)&&qrCode.isDark(row+2,col)&&qrCode.isDark(row+3,col)&&qrCode.isDark(row+4,col)&&!qrCode.isDark(row+5,col)&&qrCode.isDark(row+6,col)){ // If there is a pattern of dark-light-dark-dark-dark-light-dark.
						lostPoint+=40; // Add the lost point.
					}
				}
			}

			// Ratio of dark modules.
			var darkCount=0; // Initialize the dark count to 0.
			for(var col=0;col<moduleCount;col++){
				for(var row=0;row<moduleCount;row++){
					if(qrCode.isDark(row,col)){ // If the module is dark.
						darkCount++; // Increment the dark count.
					}
				}
			}
			var ratio=Math.abs(100*darkCount/moduleCount/moduleCount-50)/5; // Calculate the ratio of dark modules to the total number of modules.
			lostPoint+=ratio*10; // Add the lost point.
			return lostPoint; // Return the lost point.
		}
	};

	// Define mathematical functions for QR code generation.
	var QRMath={
		glog:function(n){
			if(n<1){ // If n is less than 1.
				throw new Error("glog("+n+")"); // Throw an error.
			}
			return QRMath.LOG_TABLE[n]; // Return the logarithm of n from the table.
		},

		gexp:function(n){
			while(n<0){ // While n is negative.
				n+=255; // Add 255 to n.
			}
			while(n>=256){ // While n is greater than or equal to 256.
				n-=255; // Subtract 255 from n.
			}
			return QRMath.EXP_TABLE[n]; // Return the exponential of n from the table.
		},

		EXP_TABLE:new Array(256), // Exponential table
		LOG_TABLE:new Array(256) // Logarithm table
	};

	// Initialize the exponential and logarithm tables.
	for(var i=0;i<8;i++){
		QRMath.EXP_TABLE[i]=1<<i; // Calculate the exponential of i.
	}
	for(var i=8;i<256;i++){
		QRMath.EXP_TABLE[i]=QRMath.EXP_TABLE[i-4]^QRMath.EXP_TABLE[i-5]^QRMath.EXP_TABLE[i-6]^QRMath.EXP_TABLE[i-8]; // Calculate the exponential of i using the recurrence relation.
	}
	for(var i=0;i<255;i++){
		QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]]=i; // Calculate the logarithm of EXP_TABLE[i].
	}

	/**
	 * @class QRPolynomial
	 * @constructor
	 * @param {Array<Number>} num  The coefficients of the polynomial.
	 * @param {Number} shift  The shift value.
	 */
	function QRPolynomial(num,shift){
		if(num.length==undefined){ // If the length of num is undefined.
			throw new Error(num.length+"/"+shift); // Throw an error.
		}
		var offset=0; // Initialize the offset to 0.
		while(offset<num.length&&num[offset]==0){ // While the offset is less than the length of num and the coefficient at the offset is 0.
			offset++; // Increment the offset.
		}
		this.num=new Array(num.length-offset+shift); // Create a new array with the coefficients.
		for(var i=0;i<num.length-offset;i++){
			this.num[i]=num[i+offset]; // Copy the coefficients from num to the new array.
		}
	}

	QRPolynomial.prototype={
		/**
		 * Get the coefficient at the given index.
		 * @param {Number} index The index.
		 * @return {Number} The coefficient at the given index.
		 */
		get:function(index){
			return this.num[index]; // Return the coefficient at the given index.
		},

		/**
		 * Get the length of the polynomial.
		 * @return {Number} The length of the polynomial.
		 */
		getLength:function(){
			return this.num.length; // Return the length of the polynomial.
		},

		/**
		 * Multiply the polynomial by another polynomial.
		 * @param {QRPolynomial} e The other polynomial.
		 * @return {QRPolynomial} The result of the multiplication.
		 */
		multiply:function(e){
			var num=new Array(this.getLength()+e.getLength()-1); // Create a new array with the coefficients of the product.
			// Iterate over the coefficients of the first polynomial.
			for(var i=0;i<this.getLength();i++){
				// Iterate over the coefficients of the second polynomial.
				for(var j=0;j<e.getLength();j++){
					num[i+j]^=QRMath.gexp(QRMath.glog(this.get(i))+QRMath.glog(e.get(j))); // Calculate the coefficient of the product using the formula.
				}
			}
			return new QRPolynomial(num,0); // Return the product.
		},

		/**
		 * Calculate the remainder of the polynomial divided by another polynomial.
		 * @param {QRPolynomial} e The other polynomial.
		 * @return {QRPolynomial} The remainder of the division.
		 */
		mod:function(e){
			if(this.getLength()-e.getLength()<0){ // If the length of the first polynomial is less than the length of the second polynomial.
				return this; // Return the first polynomial.
			}
			var ratio=QRMath.glog(this.get(0))-QRMath.glog(e.get(0)); // Calculate the ratio of the leading coefficients.
			var num=new Array(this.getLength()); // Create a new array with the coefficients of the remainder.
			for(var i=0;i<this.getLength();i++){
				num[i]=this.get(i); // Copy the coefficients from the first polynomial to the new array.
			}
			// Iterate over the coefficients of the second polynomial.
			for(var i=0;i<e.getLength();i++){
				num[i]^=QRMath.gexp(QRMath.glog(e.get(i))+ratio); // Calculate the coefficient of the remainder.
			}
			return new QRPolynomial(num,0).mod(e); // Calculate the remainder recursively.
		}
	};

	/**
	 * @class QRRSBlock
	 * @constructor
	 * @param {Number} totalCount The total count.
	 * @param {Number} dataCount The data count.
	 */
	function QRRSBlock(totalCount,dataCount){
		this.totalCount=totalCount; // Total number of code words in this RS block.
		this.dataCount=dataCount; // Number of data code words in this RS block.
	}

	// Table defining the structure of Reed-Solomon (RS) error correction blocks for different QR code versions and error correction levels.
	QRRSBlock.RS_BLOCK_TABLE=[
		[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
	];

	/**
	 * Get the Reed-Solomon blocks.
	 * @param {Number} typeNumber The type number.
	 * @param {QRErrorCorrectLevel} errorCorrectLevel The error correct level.
	 * @return {Array<QRRSBlock>} The Reed-Solomon blocks.
	 */
	QRRSBlock.getRSBlocks=function(typeNumber,errorCorrectLevel){
		var rsBlock=QRRSBlock.getRsBlockTable(typeNumber,errorCorrectLevel); // Get the Reed-Solomon block table.
		if(rsBlock==undefined){ // If the Reed-Solomon block is undefined.
			throw new Error("bad rs block @ typeNumber:"+typeNumber+"/errorCorrectLevel:"+errorCorrectLevel); // Throw an error.
		}
		var length=rsBlock.length/3; // Calculate the length.
		var list=[]; // Create a new list.
		// Iterate over the length.
		for(var i=0;i<length;i++){
			var count=rsBlock[i*3+0]; // Get the count.
			var totalCount=rsBlock[i*3+1]; // Get the total count.
			var dataCount=rsBlock[i*3+2]; // Get the data count.
			// Iterate over the count.
			for(var j=0;j<count;j++){
				list.push(new QRRSBlock(totalCount,dataCount)); // Push a new Reed-Solomon block to the list.
			}
		}
		return list; // Return the list.
	};

	/**
	 * Get the Reed-Solomon block table.
	 * @param {Number} typeNumber The type number.
	 * @param {QRErrorCorrectLevel} errorCorrectLevel The error correct level.
	 * @return {Array<Number>} The Reed-Solomon block table.
	 */
	QRRSBlock.getRsBlockTable=function(typeNumber,errorCorrectLevel){
		switch(errorCorrectLevel){ // Switch on the error correction level.
			case QRErrorCorrectLevel.L:return QRRSBlock.RS_BLOCK_TABLE[(typeNumber-1)*4+0]; // Return the Reed-Solomon block table for low error correction.
			case QRErrorCorrectLevel.M:return QRRSBlock.RS_BLOCK_TABLE[(typeNumber-1)*4+1]; // Return the Reed-Solomon block table for medium error correction.
			case QRErrorCorrectLevel.Q:return QRRSBlock.RS_BLOCK_TABLE[(typeNumber-1)*4+2]; // Return the Reed-Solomon block table for quartile error correction.
			case QRErrorCorrectLevel.H:return QRRSBlock.RS_BLOCK_TABLE[(typeNumber-1)*4+3]; // Return the Reed-Solomon block table for high error correction.
			default:return undefined; // Return undefined if the error correction level is invalid.
		}
	};

	/**
	 * @class QRBitBuffer
	 * @constructor
	 */
	function QRBitBuffer(){
		this.buffer=[]; // The bit buffer.
		this.length=0; // The length of the bit buffer.
	}

	QRBitBuffer.prototype={
		/**
		 * Get the bit at the given index.
		 * @param {Number} index The index.
		 * @return {Boolean} The bit at the given index.
		 */
		get:function(index){
			var bufIndex=Math.floor(index/8); // Calculate the buffer index.
			return((this.buffer[bufIndex]>>>(7-index%8))&1)==1; // Return the bit at the given index.
		},

		/**
		 * Put the number into the buffer with the given length.
		 * @param {Number} num The number.
		 * @param {Number} length The length.
		 */
		put:function(num,length){
			for(var i=0;i<length;i++){
				this.putBit(((num>>>(length-i-1))&1)==1); // Put the bit into the buffer.
			}
		},

		/**
		 * Get the length in bits.
		 * @return {Number} The length in bits.
		 */
		getLengthInBits:function(){
			return this.length; // Return the length in bits.
		},

		/**
		 * Put the bit into the buffer.
		 * @param {Boolean} bit The bit.
		 */
		putBit:function(bit){
			var bufIndex=Math.floor(this.length/8); // Calculate the buffer index.
			if(this.buffer.length<=bufIndex){ // If the buffer is not large enough.
				this.buffer.push(0); // Push a new byte to the buffer.
			}
			if(bit){ // If the bit is true.
				this.buffer[bufIndex]|=(0x80>>>(this.length%8)); // Set the bit in the buffer.
			}
			this.length++; // Increment the length.
		}
	};

	// Table containing the maximum number of characters that can be encoded in a QR code of a given version and error correction level.
	var QRCodeLimitLength=[
		[17,14,11,7],[32,26,20,14],[53,42,32,24],[78,62,46,34],[106,84,60,44],[134,106,74,58],[154,122,86,64],[192,152,108,84],[230,180,130,98],[271,213,151,119],[321,251,177,137],[367,287,203,155],[425,331,241,177],[458,362,258,194],[520,412,292,220],[586,450,322,250],[644,504,364,280],[718,560,394,310],[792,624,442,338],[858,666,482,382],[929,711,509,403],[1003,779,565,439],[1091,857,611,461],[1171,911,661,511],[1273,997,715,535],[1367,1059,751,593],[1465,1125,805,625],[1528,1190,868,658],[1628,1264,908,698],[1732,1370,982,742],[1840,1452,1030,790],[1952,1538,1112,842],[2068,1628,1168,898],[2188,1722,1228,958],[2303,1809,1283,983],[2431,1911,1351,1051],[2563,1989,1423,1093],[2699,2099,1499,1139],[2809,2213,1579,1219],[2953,2331,1663,1273]
	];
	
	/**
	 * Check if the browser supports canvas.
	 * @private
	 * @return {Boolean} True if the browser supports canvas, false otherwise.
	 */
	function _isSupportCanvas() {
		return typeof CanvasRenderingContext2D != "undefined"; // Check if the CanvasRenderingContext2D object is defined.
	}
	
	/**
	 * Get the Android version.
	 * @private
	 * @return {Number|Boolean} The Android version if the browser is running on Android, false otherwise.
	 */
	// android 2.x doesn't support Data-URI spec
	function _getAndroid() {
		var android = false; // Initialize the android variable to false.
		var sAgent = navigator.userAgent; // Get the user agent string.
		
		if (/android/i.test(sAgent)) { // android // Check if the user agent string contains the word "android".
			android = true; // Set the android variable to true.
			var aMat = sAgent.toString().match(/android ([0-9]\.[0-9])/i); // Match the Android version number.
			
			if (aMat && aMat[1]) { // If the version number was found.
				android = parseFloat(aMat[1]); // Parse the version number.
			}
		}
		
		return android; // Return the android version or false.
	}
	
	// SVG Rendering
	var svgDrawer = (function() {

		var Drawing = function (el, htOption) {
			this._el = el;
			this._htOption = htOption;
		};

		Drawing.prototype.draw = function (oQRCode) {
			var _htOption = this._htOption;
			var _el = this._el;
			var nCount = oQRCode.getModuleCount();
			var nWidth = Math.floor(_htOption.width / nCount);
			var nHeight = Math.floor(_htOption.height / nCount);

			this.clear();

			function makeSVG(tag, attrs) {
				var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
				for (var k in attrs)
					if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
				return el;
			}

			var svg = makeSVG("svg" , {'viewBox': '0 0 ' + String(nCount) + " " + String(nCount), 'width': '100%', 'height': '100%', 'fill': _htOption.colorLight});
			svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
			_el.appendChild(svg);

			svg.appendChild(makeSVG("rect", {"fill": _htOption.colorLight, "width": "100%", "height": "100%"}));
			svg.appendChild(makeSVG("rect", {"fill": _htOption.colorDark, "width": "1", "height": "1", "id": "template"}));

			for (var row = 0; row < nCount; row++) {
				for (var col = 0; col < nCount; col++) {
					if (oQRCode.isDark(row, col)) {
						var child = makeSVG("use", {"x": String(col), "y": String(row)});
						child.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#template")
						svg.appendChild(child);
					}
				}
			}
		};
		Drawing.prototype.clear = function () {
			while (this._el.hasChildNodes())
				this._el.removeChild(this._el.lastChild);
		};
		return Drawing;
	})();

	var useSVG = document.documentElement.tagName.toLowerCase() === "svg";

	// Drawing in DOM by using Table tag or fallback to Canvas if canvas isn't available
	var Drawing = useSVG ? svgDrawer : !_isSupportCanvas() ? (function () { //if SVG isn't supported and Canvas isn't supported, fallback to using an HTML table to create the image.
		var Drawing = function (el, htOption) {
			this._el = el;
			this._htOption = htOption;
		};
			
		/**
		 * Draw the QRCode
		 * 
		 * @param {QRCode} oQRCode
		 */
		Drawing.prototype.draw = function (oQRCode) {
            var _htOption = this._htOption;
            var _el = this._el;
			var nCount = oQRCode.getModuleCount();
			var nWidth = Math.floor(_htOption.width / nCount);
			var nHeight = Math.floor(_htOption.height / nCount);
			var aHTML = ['<table style="border:0;border-collapse:collapse;">']; //creates the skeleton of the table.
			
			for (var row = 0; row < nCount; row++) { //iterates through the rows
				aHTML.push('<tr>'); //pushes an open row tag
				
				for (var col = 0; col < nCount; col++) { //iterates through the columns in the row
					aHTML.push('<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' + nWidth + 'px;height:' + nHeight + 'px;background-color:' + (oQRCode.isDark(row, col) ? _htOption.colorDark : _htOption.colorLight) + ';"></td>'); //appends a table data cell with a specified height, width, and color according to the qrcode data.
				}
				
				aHTML.push('</tr>'); //pushes a closing table row tag
			}
			
			aHTML.push('</table>'); //pushes a closing table tag
			_el.innerHTML = aHTML.join(''); //sets the inner HTML of the container to the new table that was just generated.
			
			// Fix the margin values as real size.
			var elTable = _el.childNodes[0]; //the first child of the container, which should be the table.
			var nLeftMarginTable = (_htOption.width - elTable.offsetWidth) / 2; //finds the amount of horizontal margin around the outside.
			var nTopMarginTable = (_htOption.height - elTable.offsetHeight) / 2; //finds the amount of vertical margin around the outside.
			
			if (nLeftMarginTable > 0 && nTopMarginTable > 0) { //if there's both horizontal and vertical margins.
				elTable.style.margin = nTopMarginTable + "px " + nLeftMarginTable + "px";	 //set the margin using CSS
			}
		};
		
		/**
		 * Clear the QRCode
		 */
		Drawing.prototype.clear = function () {
			this._el.innerHTML = ''; //clears the HTML in the container.
		};
		
		return Drawing;
	})() : (function () { //Drawing in Canvas. this code will execute if canvas is supported and SVG is not.
		function _onMakeImage() {
			this._elImage.src = this._elCanvas.toDataURL("image/png"); //converts the current state of the canvas into a PNG and sets it as the source of an image.
			this._elImage.style.display = "block"; //sets the image to display
			this._elCanvas.style.display = "none";			//hides the canvas element.
		}
	;
		
		/**
		 * Drawing QRCode by using canvas
		 * 
		 * @constructor
		 * @param {HTMLElement} el
		 * @param {Object} htOption QRCode Options 
		 */
		var Drawing = function (el, htOption) {
    		this._bIsPainted = false; //boolean for if the image has been painted.
			this._htOption = htOption; //stores the HTML options
			this._elCanvas = document.createElement("canvas"); //creates a canvas element
			this._elCanvas.width = htOption.width; //sets the canvas width
			this._elCanvas.height = htOption.height; //sets the canvas height
			el.appendChild(this._elCanvas); //adds the canvas to the HTML element
			this._el = el; //sets the element to the local variable.
			this._oContext = this._elCanvas.getContext("2d"); //gets the canvas context
			this._bIsPainted = false; //sets is painted to false
			this._elImage = document.createElement("img"); //creates a new image element.
			this._elImage.alt = "Scan me!"; //sets the alt text
			this._elImage.style.display = "none"; //sets the image to not display
			this._el.appendChild(this._elImage); //appends the image to the HTML element.
		};
			
		/**
		 * Draw the QRCode
		 * 
		 * @param {QRCode} oQRCode 
		 */
		Drawing.prototype.draw = function (oQRCode) {
            var _elImage = this._elImage;
            var _oContext = this._oContext;
            var _htOption = this._htOption;
            
			var nCount = oQRCode.getModuleCount(); //gets the number of modules from the QR code.
			var nWidth = _htOption.width / nCount; //calculates the width of a single module in pixels.
			var nHeight = _htOption.height / nCount; //calculates the height of a single module in pixels
			var nRoundedWidth = Math.round(nWidth); //rounds the width to the nearest pixel.
			var nRoundedHeight = Math.round(nHeight); //rounds the height to the nearest pixel.

			_elImage.style.display = "none"; //sets the display style to none.
			this.clear(); //clears the previous image

			//loop through all of the modules
			for (var row = 0; row < nCount; row++) {
				for (var col = 0; col < nCount; col++) {
					var bIsDark = oQRCode.isDark(row, col); //checks if the current module is dark
					var nLeft = col * nWidth; //calculate the x position of the current module
					var nTop = row * nHeight; //calculate the y position of the current module
					_oContext.strokeStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight; //sets the stroke color to black if it's dark and white if it's light
					_oContext.lineWidth = 1; //sets the line width to 1
					_oContext.fillStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight;	//sets the fill color to black if it's dark and white if it's light
					_oContext.fillRect(nLeft, nTop, nWidth, nHeight); //fills the rectangle.
					
					// Anti-aliasing workaround
					_oContext.strokeRect(
						Math.floor(nLeft) + 0.5,
						Math.floor(nTop) + 0.5,
						nRoundedWidth,
						nRoundedHeight
					);
					
					_oContext.strokeRect(
						Math.ceil(nLeft) - 0.5,
						Math.ceil(nTop) - 0.5,
						nRoundedWidth,
						nRoundedHeight
					);
				}
			}
			
			this._bIsPainted = true; //set is painted to true;
		};
			
		/**
		 * Make the image from Canvas if the browser supports Data URI.
		 */
        Drawing.prototype.makeImage = function () {
            if (this._bIsPainted) {
                _onMakeImage.call(this); // Directly make the image
            }
		};
			
		/**
		 * Return whether the QRCode is painted or not
		 * 
		 * @return {Boolean}
		 */
		Drawing.prototype.isPainted = function () {
			return this._bIsPainted; //returns if it's been painted.
		};
		
		/**
		 * Clear the QRCode
		 */
		Drawing.prototype.clear = function () {
			this._oContext.clearRect(0, 0, this._elCanvas.width, this._elCanvas.height); //clears the context of the canvas.
			this._bIsPainted = false; //sets is painted to false.
		};
		
		/**
		 * @private
		 * @param {Number} nNumber
		 */
		Drawing.prototype.round = function (nNumber) {
			if (!nNumber) {
				return nNumber;
			}
			
			return Math.floor(nNumber * 1000) / 1000; //round to 3 decimal places
		};
		
		return Drawing;
	})();
	
	/**
	 * Get the type by string length
	 * 
	 * @private
	 * @param {String} sText
	 * @param {Number} nCorrectLevel
	 * @return {Number} type
	 */
	function _getTypeNumber(sText, nCorrectLevel) {			
		var nType = 1; // Set the initial type to 1.
		var length = _getUTF8Length(sText); // Calculate the UTF-8 length of the input string.
		
		for (var i = 0, len = QRCodeLimitLength.length; i <= len; i++) { // Iterate through the QRCodeLimitLength table.
			var nLimit = 0; // Set initial limit to 0
			
			switch (nCorrectLevel) { // Check error correction level
				case QRErrorCorrectLevel.L :
					nLimit = QRCodeLimitLength[i][0]; // Get the maximum data length for the current type and error correction level.
					break;
				case QRErrorCorrectLevel.M :
					nLimit = QRCodeLimitLength[i][1]; // Get the maximum data length for the current type and error correction level.
					break;
				case QRErrorCorrectLevel.Q :
					nLimit = QRCodeLimitLength[i][2]; // Get the maximum data length for the current type and error correction level.
					break;
				case QRErrorCorrectLevel.H :
					nLimit = QRCodeLimitLength[i][3]; // Get the maximum data length for the current type and error correction level.
					break;
			}
			
			if (length <= nLimit) { //checks if the current data length fits in this QR code version.
				break; // If the length is within the limit, exit the loop.
			} else {
				nType++; // If the length exceeds the limit, increase the type number to use a bigger QR code version.
			}
		}
		
		if (nType > QRCodeLimitLength.length) { // If the required type is beyond the maximum defined type,
			throw new Error("Too long data"); // throw error.
		}
		
		return nType; // Return the QR code type number.
	}

	/**
	 * Calculate the UTF-8 length of a string.
	 * @private
	 * @param {String} sText The string to calculate the length of.
	 * @return {Number} The UTF-8 length of the string.
	 */
	function _getUTF8Length(sText) {
		var replacedText = encodeURI(sText).toString().replace(/\%[0-9a-fA-F]{2}/g, 'a'); // Encode the string as a URI, then replace all escaped characters (%XX) with 'a'.  This effectively counts each UTF-8 character as 1.
		return replacedText.length + (replacedText.length != sText ? 3 : 0); //Return the replaced length plus 3 if it had to replace anything.
	}
	
	/**
	 * @class QRCode
	 * @constructor
	 * @example 
	 * new QRCode(document.getElementById("test"), "http://jindo.dev.naver.com/collie");
	 *
	 * @example
	 * var oQRCode = new QRCode("test", {
	 *    text : "http://naver.com",
	 *    width : 128,
	 *    height : 128
	 * });
	 * 
	 * oQRCode.clear(); // Clear the QRCode.
	 * oQRCode.makeCode("http://map.naver.com"); // Re-create the QRCode.
	 *
	 * @param {HTMLElement|String} el target element or 'id' attribute of element.
	 * @param {Object|String} vOption
	 * @param {String} vOption.text QRCode link data
	 * @param {Number} [vOption.width=256]
	 * @param {Number} [vOption.height=256]
	 * @param {String} [vOption.colorDark="#000000"]
	 * @param {String} [vOption.colorLight="#ffffff"]
	 * @param {QRCode.CorrectLevel} [vOption.correctLevel=QRCode.CorrectLevel.H] [L|M|Q|H] 
	 */
	QRCode = function (el, vOption) {
		this._htOption = { // Define the default options.
			width : 256, 
			height : 256,
			typeNumber : 4, // Version of QR code
			colorDark : "#000000", // Dark color
			colorLight : "#ffffff", // Light color
			correctLevel : QRErrorCorrectLevel.H // Error Correction Level
		};
		
		if (typeof vOption === 'string') { //checks if the options are simply a string
			vOption	= { //if so, make it an object with the text value set to the string.
				text : vOption
			};
		}
		
		// Overwrites options
		if (vOption) { // If options are passed,
			for (var i in vOption) { // Iterate through each option passed in the argument.
				this._htOption[i] = vOption[i]; // Set the value of the existing option equal to the new value.
			}
		}
		
		if (typeof el == "string") { //checks if the element is a string
			el = document.getElementById(el); //if so, sets it to the HTML element with that ID.
		}

		if (this._htOption.useSVG) {
			Drawing = svgDrawer;
		}
		
		this._el = el; //sets the element to the local variable
		this._oQRCode = null; //sets the qrcode object to null
		this._oDrawing = new Drawing(this._el, this._htOption); //creates a new drawing object.
		
		if (this._htOption.text) { // If text is passed,
			this.makeCode(this._htOption.text);	// make the code.
		}
	};
	
	/**
	 * Make the QRCode
	 * 
	 * @param {String} sText link data
	 */
	QRCode.prototype.makeCode = function (sText) {
		this._oQRCode = new QRCodeModel(_getTypeNumber(sText, this._htOption.correctLevel), this._htOption.correctLevel); // Create a new QR code model with the specified type number and error correction level.
		this._oQRCode.addData(sText); // Add the data to the QR code model.
		this._oQRCode.make(); // Make the QR code.
		this._el.title = sText; // Set the title attribute of the element to the data.
		this._oDrawing.draw(this._oQRCode);	// Draw the QR code.		
		this.makeImage(); // Call the makeImage function.
	};
	
	/**
	 * Make the Image from Canvas element - It occurs automatically
	 * 
	 * @private
	 */
	QRCode.prototype.makeImage = function () {
		if (typeof this._oDrawing.makeImage == "function") { // Checks if it's a function
			this._oDrawing.makeImage(); // Call the makeImage function to create the image from the Canvas.
		}
	};
	
	/**
	 * Clear the QRCode
	 */
	QRCode.prototype.clear = function () {
		this._oDrawing.clear(); // Call the clear function of the drawing object.
	};
	
	/**
	 * @name QRCode.CorrectLevel
	 */
	QRCode.CorrectLevel = QRErrorCorrectLevel; //set the CorrectLevel to the error correction level to export it.
})(); // Execute the IIFE