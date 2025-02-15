class QR8bitByte {
    /**
     * Represents data encoded in 8-bit byte mode (UTF-8 support).
     * @param {string} data The data string to be encoded.
     */
    constructor(data) {
      this.mode = QRMode.MODE_8BIT_BYTE;
      this.data = data;
      this.parsedData = [];
      this._parseUTF8();
      this._handleUTF8BOM();
    }
  
    /**
     * Parses the data string into a UTF-8 byte array.
     * @private
     */
    _parseUTF8() {
      for (let i = 0; i < this.data.length; i++) {
        const code = this.data.charCodeAt(i);
        let byteArray = [];
  
        if (code > 0x10000) {
          byteArray = [
            0xF0 | ((code & 0x1C0000) >>> 18),
            0x80 | ((code & 0x3F000) >>> 12),
            0x80 | ((code & 0xFC0) >>> 6),
            0x80 | (code & 0x3F),
          ];
        } else if (code > 0x800) {
          byteArray = [
            0xE0 | ((code & 0xF000) >>> 12),
            0x80 | ((code & 0xFC0) >>> 6),
            0x80 | (code & 0x3F),
          ];
        } else if (code > 0x80) {
          byteArray = [0xC0 | ((code & 0x7C0) >>> 6), 0x80 | (code & 0x3F)];
        } else {
          byteArray = [code];
        }
  
        this.parsedData.push(byteArray);
      }
  
      this.parsedData = this.parsedData.flat(); // Flatten the array
    }
  
    /**
     * Handles potential UTF-8 encoding issues by prepending a BOM.
     * @private
     */
    _handleUTF8BOM() {
      if (this.parsedData.length !== this.data.length) {
        this.parsedData.unshift(239, 187, 191); // UTF-8 BOM
      }
    }
  
    /**
     * Gets the length of the data.
     * @return {number} The length of the data.
     */
    getLength() {
      return this.parsedData.length;
    }
  
    /**
     * Writes the data to the buffer.
     * @param {QRBitBuffer} buffer The bit buffer.
     */
    write(buffer) {
      for (let i = 0; i < this.parsedData.length; i++) {
        buffer.put(this.parsedData[i], 8);
      }
    }
  }
  
  class QRCodeModel {
    /**
     * Represents the core QR code data model.
     * @param {number} typeNumber The type number of the QR code (1-40).
     * @param {QRErrorCorrectLevel} errorCorrectLevel The error correction level.
     */
    constructor(typeNumber, errorCorrectLevel) {
      this.typeNumber = typeNumber;
      this.errorCorrectLevel = errorCorrectLevel;
      this.modules = null;
      this.moduleCount = 0;
      this.dataCache = null;
      this.dataList = [];
    }
  
    /**
     * Adds data to the QR code.
     * @param {string} data The data to be added.
     */
    addData(data) {
      const newData = new QR8bitByte(data);
      this.dataList.push(newData);
      this.dataCache = null;
    }
  
    /**
     * Checks if a module (pixel) is dark.
     * @param {number} row The row index.
     * @param {number} col The column index.
     * @return {boolean} True if the module is dark, false otherwise.
     * @throws {Error} If the row or column is out of bounds.
     */
    isDark(row, col) {
      if (row < 0 || row >= this.moduleCount || col < 0 || col >= this.moduleCount) {
        throw new Error(`Row or column out of bounds: ${row}, ${col}`);
      }
      return this.modules[row][col];
    }
  
    /**
     * Gets the module count (size) of the QR code.
     * @return {number} The module count.
     */
    getModuleCount() {
      return this.moduleCount;
    }
  
    /**
     * Makes the QR code.
     */
    make() {
      this.makeImpl(false, this.getBestMaskPattern());
    }
  
    /**
     * Makes the QR code implementation.
     * @param {boolean} test Whether to test the mask pattern.
     * @param {number} maskPattern The mask pattern to use.
     */
    makeImpl(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = Array(this.moduleCount)
        .fill(null)
        .map(() => Array(this.moduleCount).fill(null));
  
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
  
      if (this.typeNumber >= 7) {
        this.setupTypeNumber(test);
      }
  
      if (this.dataCache === null) {
        this.dataCache = QRCodeModel.createData(
          this.typeNumber,
          this.errorCorrectLevel,
          this.dataList
        );
      }
  
      this.mapData(this.dataCache, maskPattern);
    }
  
    /**
     * Sets up the position probe pattern.
     * @private
     * @param {number} row The row index.
     * @param {number} col The column index.
     */
    setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
  
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
  
          if (
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)
          ) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }
  
    /**
     * Gets the best mask pattern.
     * @return {number} The best mask pattern.
     */
    getBestMaskPattern() {
      let minLostPoint = 0;
      let pattern = 0;
  
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(this);
  
        if (i === 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
  
      return pattern;
    }
  
    /**
     * Sets up the timing pattern.
     * @private
     */
    setupTimingPattern() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) {
          continue;
        }
        this.modules[r][6] = r % 2 === 0;
      }
  
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) {
          continue;
        }
        this.modules[6][c] = c % 2 === 0;
      }
    }
  
    /**
     * Sets up the position adjustment pattern.
     * @private
     */
    setupPositionAdjustPattern() {
      const pos = QRUtil.getPatternPosition(this.typeNumber);
  
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
  
          if (this.modules[row][col] !== null) {
            continue;
          }
  
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }
  
    /**
     * Sets up the type number information.
     * @private
     * @param {boolean} test Whether to test the mask pattern.
     */
    setupTypeNumber(test) {
      const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
  
      for (let i = 0; i < 18; i++) {
        const mod = !test && ((bits >> i) & 1) === 1;
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
      }
  
      for (let i = 0; i < 18; i++) {
        const mod = !test && ((bits >> i) & 1) === 1;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    }
  
    /**
     * Sets up the type information.
     * @private
     * @param {boolean} test Whether to test the mask pattern.
     * @param {number} maskPattern The mask pattern.
     */
    setupTypeInfo(test, maskPattern) {
      const data = (this.errorCorrectLevel << 3) | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
  
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits >> i) & 1) === 1;
        if (i < 6) {
          this.modules[i][8] = mod;
        } else if (i < 8) {
          this.modules[i + 1][8] = mod;
        } else {
          this.modules[this.moduleCount - 15 + i][8] = mod;
        }
      }
  
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits >> i) & 1) === 1;
        if (i < 8) {
          this.modules[8][this.moduleCount - i - 1] = mod;
        } else if (i < 9) {
          this.modules[8][15 - i - 1 + 1] = mod;
        } else {
          this.modules[8][15 - i - 1] = mod;
        }
      }
  
      this.modules[this.moduleCount - 8][8] = !test;
    }
  
    /**
     * Maps the data to the QR code modules.
     * @private
     * @param {number[]} data The data bytes.
     * @param {number} maskPattern The mask pattern.
     */
    mapData(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
  
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
  
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              }
  
              const mask = QRUtil.getMask(maskPattern, row, col - c);
              if (mask) {
                dark = !dark;
              }
  
              this.modules[row][col - c] = dark;
              bitIndex--;
  
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
  
          row += inc;
  
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
  
    /**
     * Creates the data bytes and error correction bytes.
     * @param {number} typeNumber The type number of the QR code.
     * @param {QRErrorCorrectLevel} errorCorrectLevel The error correction level.
     * @param {QR8bitByte[]} dataList The list of data objects.
     * @return {number[]} The data bytes and error correction bytes.
     */
    static createData(typeNumber, errorCorrectLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      const buffer = new QRBitBuffer();
  
      for (const data of dataList) {
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
        data.write(buffer);
      }
  
      let totalDataCount = 0;
      for (const rsBlock of rsBlocks) {
        totalDataCount += rsBlock.dataCount;
      }
  
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw new Error(
          `Code length overflow. (${buffer.getLengthInBits()} > ${totalDataCount * 8})`
        );
      }
  
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
  
      while (buffer.getLengthInBits() % 8 !== 0) {
        buffer.putBit(false);
      }
  
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(QRCodeModel.PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(QRCodeModel.PAD1, 8);
      }
  
      return QRCodeModel.createBytes(buffer, rsBlocks);
    }
  
    /**
     * Creates the bytes from the bit buffer and Reed-Solomon blocks.
     * @param {QRBitBuffer} buffer The bit buffer.
     * @param {QRRSBlock[]} rsBlocks The Reed-Solomon blocks.
     * @return {number[]} The data bytes and error correction bytes.
     */
    static createBytes(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = Array(rsBlocks.length);
      const ecdata = Array(rsBlocks.length);
  
      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = Array(dcCount);
  
        for (let i = 0; i < dcdata[r].length; i++) {
          dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        }
        offset += dcCount;
  
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = Array(rsPoly.getLength() - 1);
  
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
        }
      }
  
      let totalCodeCount = 0;
      for (const rsBlock of rsBlocks) {
        totalCodeCount += rsBlock.totalCount;
      }
  
      const data = Array(totalCodeCount);
      let index = 0;
  
      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) {
            data[index++] = dcdata[r][i];
          }
        }
      }
  
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) {
            data[index++] = ecdata[r][i];
          }
        }
      }
  
      return data;
    }
  }
  
  QRCodeModel.PAD0 = 0xEC;
  QRCodeModel.PAD1 = 0x11;
  
  const QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3,
  };
  
  const QRErrorCorrectLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2,
  };
  
  const QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7,
  };
  
  const QRUtil = {
    PATTERN_POSITION_TABLE: [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170],
    ],
  
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
  
    /**
     * Calculates the BCH code for the type information.
     * @param {number} data The type information data.
     * @return {number} The BCH code.
     */
    getBCHTypeInfo(data) {
      let d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15));
      }
      return (data << 10 | d) ^ QRUtil.G15_MASK;
    },
  
    /**
     * Calculates the BCH code for the type number.
     * @param {number} data The type number data.
     * @return {number} The BCH code.
     */
    getBCHTypeNumber(data) {
      let d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18));
      }
      return data << 12 | d;
    },
  
    /**
     * Gets the digit of the BCH code.
     * @param {number} data The BCH code.
     * @return {number} The digit of the BCH code.
     */
    getBCHDigit(data) {
      let digit = 0;
      while (data !== 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    },
  
    /**
     * Gets the pattern position.
     * @param {number} typeNumber The type number of the QR code.
     * @return {number[]} The pattern position.
     */
    getPatternPosition(typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },
  
    /**
     * Gets the mask.
     * @param {number} maskPattern The mask pattern.
     * @param {number} i The row index.
     * @param {number} j The column index.
     * @return {boolean} The mask value.
     */
    getMask(maskPattern, i, j) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001:
          return i % 2 === 0;
        case QRMaskPattern.PATTERN010:
          return j % 3 === 0;
        case QRMaskPattern.PATTERN011:
          return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100:
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case QRMaskPattern.PATTERN101:
          return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110:
          return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111:
          return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
        default:
          throw new Error(`Bad maskPattern: ${maskPattern}`);
      }
    },
  
    /**
     * Gets the error correction polynomial.
     * @param {number} errorCorrectLength The error correction length.
     * @return {QRPolynomial} The error correction polynomial.
     */
    getErrorCorrectPolynomial(errorCorrectLength) {
      let a = new QRPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },
  
    /**
     * Gets the length in bits for the given mode and type.
     * @param {QRMode} mode The QR code mode.
     * @param {number} type The QR code type number.
     * @return {number} The length in bits.
     */
    getLengthInBits(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10;
          case QRMode.MODE_ALPHA_NUM:
            return 9;
          case QRMode.MODE_8BIT_BYTE:
            return 8;
          case QRMode.MODE_KANJI:
            return 8;
          default:
            throw new Error(`Mode: ${mode}`);
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12;
          case QRMode.MODE_ALPHA_NUM:
            return 11;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 10;
          default:
            throw new Error(`Mode: ${mode}`);
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 14;
          case QRMode.MODE_ALPHA_NUM:
            return 13;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 12;
          default:
            throw new Error(`Mode: ${mode}`);
        }
      } else {
        throw new Error(`Type: ${type}`);
      }
    },
  
    /**
     * Gets the lost point.
     * @param {QRCodeModel} qrCode The QR code model.
     * @return {number} The lost point.
     */
    getLostPoint(qrCode) {
      const moduleCount = qrCode.getModuleCount();
      let lostPoint = 0;
  
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
  
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qrCode.isDark(row + r, col + c)) {
                sameCount++;
              }
            }
          }
  
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }
  
      for (let row = 0; row < moduleCount - 1; row++) {
        for (let col = 0; col < moduleCount - 1; col++) {
          let count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count === 0 || count === 4) {
            lostPoint += 3;
          }
        }
      }
  
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount - 6; col++) {
          if (
            qrCode.isDark(row, col) &&
            !qrCode.isDark(row, col + 1) &&
            qrCode.isDark(row, col + 2) &&
            qrCode.isDark(row, col + 3) &&
            qrCode.isDark(row, col + 4) &&
            !qrCode.isDark(row, col + 5) &&
            qrCode.isDark(row, col + 6)
          ) {
            lostPoint += 40;
          }
        }
      }
  
      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount - 6; row++) {
          if (
            qrCode.isDark(row, col) &&
            !qrCode.isDark(row + 1, col) &&
            qrCode.isDark(row + 2, col) &&
            qrCode.isDark(row + 3, col) &&
            qrCode.isDark(row + 4, col) &&
            !qrCode.isDark(row + 5, col) &&
            qrCode.isDark(row + 6, col)
          ) {
            lostPoint += 40;
          }
        }
      }
  
      let darkCount = 0;
      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount; row++) {
          if (qrCode.isDark(row, col)) {
            darkCount++;
          }
        }
      }
  
      const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    },
  };
  
  const QRMath = {
    glog(n) {
      if (n < 1) {
        throw new Error(`glog(${n})`);
      }
      return QRMath.LOG_TABLE[n];
    },
  
    gexp(n) {
      while (n < 0) {
        n += 255;
      }
      while (n >= 256) {
        n -= 255;
      }
      return QRMath.EXP_TABLE[n];
    },
  
    EXP_TABLE: Array(256),
    LOG_TABLE: Array(256),
  };
  
  for (let i = 0; i < 8; i++) {
    QRMath.EXP_TABLE[i] = 1 << i;
  }
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] =
      QRMath.EXP_TABLE[i - 4] ^
      QRMath.EXP_TABLE[i - 5] ^
      QRMath.EXP_TABLE[i - 6] ^
      QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) {
    QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
  }
  
  class QRPolynomial {
    /**
     * Represents a polynomial for error correction.
     * @param {number[]} num The coefficients of the polynomial.
     * @param {number} shift The shift value.
     */
    constructor(num, shift) {
      if (!Array.isArray(num)) {
        throw new Error(`Invalid num: ${num} / ${shift}`);
      }
  
      let offset = 0;
      while (offset < num.length && num[offset] === 0) {
        offset++;
      }
  
      this.num = Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) {
        this.num[i] = num[i + offset];
      }
    }
  
    /**
     * Gets the coefficient at the given index.
     * @param {number} index The index.
     * @return {number} The coefficient at the given index.
     */
    get(index) {
      return this.num[index];
    }
  
    /**
     * Gets the length of the polynomial.
     * @return {number} The length of the polynomial.
     */
    getLength() {
      return this.num.length;
    }
  
    /**
     * Multiplies the polynomial by another polynomial.
     * @param {QRPolynomial} e The other polynomial.
     * @return {QRPolynomial} The result of the multiplication.
     */
    multiply(e) {
      const num = Array(this.getLength() + e.getLength() - 1).fill(0); // Initialize to 0
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    }
  
    /**
     * Calculates the remainder of the polynomial divided by another polynomial.
     * @param {QRPolynomial} e The other polynomial.
     * @return {QRPolynomial} The remainder of the division.
     */
    mod(e) {
      if (this.getLength() - e.getLength() < 0) {
        return this;
      }
  
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = [...this.num]; // Create a copy
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  }
  
  class QRRSBlock {
    /**
     * Represents a Reed-Solomon block.
     * @param {number} totalCount The total count.
     * @param {number} dataCount The data count.
     */
    constructor(totalCount, dataCount) {
      this.totalCount = totalCount;
      this.dataCount = dataCount;
    }
  
    /**
     * Gets the Reed-Solomon blocks.
     * @param {number} typeNumber The type number.
     * @param {QRErrorCorrectLevel} errorCorrectLevel The error correct level.
     * @return {QRRSBlock[]} The Reed-Solomon blocks.
     */
    static getRSBlocks(typeNumber, errorCorrectLevel) {
      const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
      if (!rsBlock) {
        throw new Error(
          `Bad rs block @ typeNumber:${typeNumber}/errorCorrectLevel:${errorCorrectLevel}`
        );
      }
  
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) {
          list.push(new QRRSBlock(totalCount, dataCount));
        }
      }
      return list;
    }
  
    /**
     * Gets the Reed-Solomon block table.
     * @param {number} typeNumber The type number.
     * @param {QRErrorCorrectLevel} errorCorrectLevel The error correct level.
     * @return {number[]} The Reed-Solomon block table.
     */
    static getRsBlockTable(typeNumber, errorCorrectLevel) {
      switch (errorCorrectLevel) {
        case QRErrorCorrectLevel.L:
          return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectLevel.M:
          return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectLevel.Q:
          return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectLevel.H:
          return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return undefined;
      }
    }
  }
  
  QRRSBlock.RS_BLOCK_TABLE = [
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12],
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16],
  ];
  
  class QRBitBuffer {
    /**
     * Represents a bit buffer for QR code data.
     */
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
  
    /**
     * Gets the bit at the given index.
     * @param {number} index The index.
     * @return {boolean} The bit at the given index.
     */
    get(index) {
      const bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
    }
  
    /**
     * Puts the number into the buffer with the given length.
     * @param {number} num The number.
     * @param {number} length The length.
     */
    put(num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    }
  
    /**
     * Gets the length in bits.
     * @return {number} The length in bits.
     */
    getLengthInBits() {
      return this.length;
    }
  
    /**
     * Puts the bit into the buffer.
     * @param {boolean} bit The bit.
     */
    putBit(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
      }
      this.length++;
    }
  }
  
  const QRCodeLimitLength = [
    [17, 14, 11, 7],
    [32, 26, 20, 14],
    [53, 42, 32, 24],
    [78, 62, 46, 34],
    [106, 84, 60, 44],
    [134, 106, 74, 58],
    [154, 122, 86, 64],
    [192, 152, 108, 84],
    [230, 180, 130, 98],
    [271, 213, 151, 119],
    [321, 251, 177, 137],
    [367, 287, 203, 155],
    [425, 331, 241, 177],
    [458, 362, 258, 194],
    [520, 412, 292, 220],
    [586, 450, 322, 250],
    [644, 504, 364, 280],
    [718, 560, 394, 310],
    [792, 624, 442, 338],
    [858, 666, 482, 382],
    [929, 711, 509, 403],
    [1003, 779, 565, 439],
    [1091, 857, 611, 461],
    [1171, 911, 661, 511],
    [1273, 997, 715, 535],
    [1367, 1059, 751, 593],
    [1465, 1125, 805, 625],
    [1528, 1190, 868, 658],
    [1628, 1264, 908, 698],
    [1732, 1370, 982, 742],
    [1840, 1452, 1030, 790],
    [1952, 1538, 1112, 842],
    [2068, 1628, 1168, 898],
    [2188, 1722, 1228, 958],
    [2303, 1809, 1283, 983],
    [2431, 1911, 1351, 1051],
    [2563, 1989, 1423, 1093],
    [2699, 2099, 1499, 1139],
    [2809, 2213, 1579, 1219],
    [2953, 2331, 1663, 1273],
  ];
  
  /**
   * Checks if the browser supports canvas.
   * @private
   * @return {boolean} True if the browser supports canvas, false otherwise.
   */
  function _isSupportCanvas() {
    return typeof CanvasRenderingContext2D !== "undefined";
  }
    
  // SVG Rendering
  const svgDrawer = (() => {
    class Drawing {
      constructor(el, htOption) {
        this._el = el;
        this._htOption = htOption;
      }
  
      draw(oQRCode) {
        const _htOption = this._htOption;
        const _el = this._el;
        const nCount = oQRCode.getModuleCount();
        const nWidth = Math.floor(_htOption.width / nCount);
        const nHeight = Math.floor(_htOption.height / nCount);
  
        this.clear();
  
        function makeSVG(tag, attrs) {
          const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
          for (const k in attrs) {
            if (attrs.hasOwnProperty(k)) {
              el.setAttribute(k, attrs[k]);
            }
          }
          return el;
        }
  
        const svg = makeSVG("svg", {
          viewBox: `0 0 ${String(nCount)} ${String(nCount)}`,
          width: "100%",
          height: "100%",
          fill: _htOption.colorLight,
        });
        svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
        _el.appendChild(svg);
  
        svg.appendChild(makeSVG("rect", { fill: _htOption.colorLight, width: "100%", height: "100%" }));
        svg.appendChild(makeSVG("rect", { fill: _htOption.colorDark, width: "1", height: "1", id: "template" }));
  
        for (let row = 0; row < nCount; row++) {
          for (let col = 0; col < nCount; col++) {
            if (oQRCode.isDark(row, col)) {
              const child = makeSVG("use", { x: String(col), y: String(row) });
              child.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#template");
              svg.appendChild(child);
            }
          }
        }
      }
  
      clear() {
        while (this._el.hasChildNodes()) {
          this._el.removeChild(this._el.lastChild);
        }
      }
    }
  
    return Drawing;
  })();
  
  const useSVG = document.documentElement.tagName.toLowerCase() === "svg";
  
  // Drawing in DOM by using Table tag or fallback to Canvas if canvas isn't available
  const Drawing = useSVG
    ? svgDrawer
    : !_isSupportCanvas()
    ? (() => {
        //if SVG isn't supported and Canvas isn't supported, fallback to using an HTML table to create the image.
        class Drawing {
          constructor(el, htOption) {
            this._el = el;
            this._htOption = htOption;
          }
  
          /**
           * Draw the QRCode
           *
           * @param {QRCode} oQRCode
           */
          draw(oQRCode) {
            const _htOption = this._htOption;
            const _el = this._el;
            const nCount = oQRCode.getModuleCount();
            const nWidth = Math.floor(_htOption.width / nCount);
            const nHeight = Math.floor(_htOption.height / nCount);
            const aHTML = ['<table style="border:0;border-collapse:collapse;">']; //creates the skeleton of the table.
        
            for (let row = 0; row < nCount; row++) {
              //iterates through the rows
              aHTML.push('<tr>'); //pushes an open row tag
        
              for (let col = 0; col < nCount; col++) {
                //iterates through the columns in the row
                aHTML.push(
                  '<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' +
                    nWidth +
                    'px;height:' +
                    nHeight +
                    'px;background-color:' +
                    (oQRCode.isDark(row, col) ? _htOption.colorDark : _htOption.colorLight) +
                    ';"></td>'
                ); //appends a table data cell with a specified height, width, and color according to the qrcode data.
              }
        
              aHTML.push('</tr>'); //pushes a closing table row tag
            }
        
            aHTML.push('</table>'); //pushes a closing table tag
            _el.innerHTML = aHTML.join(''); //sets the inner HTML of the container to the new table that was just generated.
        
            const quietZone = _htOption.quietZone || 0; // Default to 0 if not specified
            _el.style.padding = `${quietZone}px`; // Add padding to the container
        
            // Fix the margin values as real size.
            const elTable = _el.childNodes[0]; //the first child of the container, which should be the table.
            const nLeftMarginTable = (_htOption.width - elTable.offsetWidth) / 2; //finds the amount of horizontal margin around the outside.
            const nTopMarginTable = (_htOption.height - elTable.offsetHeight) / 2; //finds the amount of vertical margin around the outside.
        
            if (nLeftMarginTable > 0 && nTopMarginTable > 0) {
              //if there's both horizontal and vertical margins.
              elTable.style.margin = nTopMarginTable + "px " + nLeftMarginTable + "px"; //set the margin using CSS
            }
          }

          /**
           * Clear the QRCode
           */
          clear() {
            this._el.innerHTML = ''; //clears the HTML in the container.
          }
        }
        return Drawing;
      })()
    : (() => {
        //Drawing in Canvas. this code will execute if canvas is supported and SVG is not.
        function _onMakeImage() {
          this._elImage.src = this._elCanvas.toDataURL("image/png"); //converts the current state of the canvas into a PNG and sets it as the source of an image.
          this._elImage.style.display = "block"; //sets the image to display
          this._elCanvas.style.display = "none"; //hides the canvas element.
        }
  
        /**
         * Drawing QRCode by using canvas
         *
         * @constructor
         * @param {HTMLElement} el
         * @param {Object} htOption QRCode Options
         */
        class Drawing {
          constructor(el, htOption) {
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
          }
  
          /**
           * Draw the QRCode
           *
           * @param {QRCode} oQRCode
           */
          draw(oQRCode) {
            const _elImage = this._elImage;
            const _oContext = this._oContext;
            const _htOption = this._htOption;
  
            const nCount = oQRCode.getModuleCount(); //gets the number of modules from the QR code.
            const nWidth = _htOption.width / nCount; //calculates the width of a single module in pixels.
            const nHeight = _htOption.height / nCount; //calculates the height of a single module in pixels
            const nRoundedWidth = Math.round(nWidth); //rounds the width to the nearest pixel.
            const nRoundedHeight = Math.round(nHeight); //rounds the height to the nearest pixel.
  
            _elImage.style.display = "none"; //sets the display style to none.
            this.clear(); //clears the previous image
  
            //loop through all of the modules
            for (let row = 0; row < nCount; row++) {
              for (let col = 0; col < nCount; col++) {
                const bIsDark = oQRCode.isDark(row, col); //checks if the current module is dark
                const nLeft = col * nWidth; //calculate the x position of the current module
                const nTop = row * nHeight; //calculate the y position of the current module
                _oContext.strokeStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight; //sets the stroke color to black if it's dark and white if it's light
                _oContext.lineWidth = 1; //sets the line width to 1
                _oContext.fillStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight; //sets the fill color to black if it's dark and white if it's light
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
          }
  
          /**
           * Make the image from Canvas if the browser supports Data URI.
           */
          makeImage() {
            if (this._bIsPainted) {
              _onMakeImage.call(this); // Directly make the image
            }
          }
  
          /**
           * Return whether the QRCode is painted or not
           *
           * @return {Boolean}
           */
          isPainted() {
            return this._bIsPainted; //returns if it's been painted.
          }
  
          /**
           * Clear the QRCode
           */
          clear() {
            this._oContext.clearRect(0, 0, this._elCanvas.width, this._elCanvas.height); //clears the context of the canvas.
            this._bIsPainted = false; //sets is painted to false.
          }
  
          /**
           * @private
           * @param {Number} nNumber
           */
          round(nNumber) {
            if (!nNumber) {
              return nNumber;
            }
  
            return Math.floor(nNumber * 1000) / 1000; //round to 3 decimal places
          }
        }
        return Drawing;
      })();
  
  /**
   * Gets the type by string length
   *
   * @private
   * @param {String} sText
   * @param {Number} nCorrectLevel
   * @return {Number} type
   */
  function _getTypeNumber(sText, nCorrectLevel) {
    let nType = 1; // Set the initial type to 1.
    const length = _getUTF8Length(sText); // Calculate the UTF-8 length of the input string.
  
    for (let i = 0, len = QRCodeLimitLength.length; i <= len; i++) {
      // Iterate through the QRCodeLimitLength table.
      let nLimit = 0; // Set initial limit to 0
  
      switch (nCorrectLevel) {
        // Check error correction level
        case QRErrorCorrectLevel.L:
          nLimit = QRCodeLimitLength[i][0]; // Get the maximum data length for the current type and error correction level.
          break;
        case QRErrorCorrectLevel.M:
          nLimit = QRCodeLimitLength[i][1]; // Get the maximum data length for the current type and error correction level.
          break;
        case QRErrorCorrectLevel.Q:
          nLimit = QRCodeLimitLength[i][2]; // Get the maximum data length for the current type and error correction level.
          break;
        case QRErrorCorrectLevel.H:
          nLimit = QRCodeLimitLength[i][3]; // Get the maximum data length for the current type and error correction level.
          break;
      }
  
      if (length <= nLimit) {
        //checks if the current data length fits in this QR code version.
        break; // If the length is within the limit, exit the loop.
      } else {
        nType++; // If the length exceeds the limit, increase the type number to use a bigger QR code version.
      }
    }
  
    if (nType > QRCodeLimitLength.length) {
      // If the required type is beyond the maximum defined type,
      throw new Error("Too long data"); // throw error.
    }
  
    return nType; // Return the QR code type number.
  }
  
  /**
   * Calculates the UTF-8 length of a string.
   * @private
   * @param {string} sText The string to calculate the length of.
   * @return {number} The UTF-8 length of the string.
   */
  function _getUTF8Length(sText) {
    const replacedText = encodeURI(sText)
      .toString()
      .replace(/\%[0-9a-fA-F]{2}/g, "a"); // Encode the string as a URI, then replace all escaped characters (%XX) with 'a'.  This effectively counts each UTF-8 character as 1.
    return replacedText.length + (replacedText.length !== sText.length ? 3 : 0); //Return the replaced length plus 3 if it had to replace anything.
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
  QRCode = class QRCode {
    constructor(el, vOption) {
      this._htOption = {
        // Define the default options.
        width: 256,
        height: 256,
        typeNumber: 4, // Version of QR code
        colorDark: "#000000", // Dark color
        colorLight: "#ffffff", // Light color
        correctLevel: QRErrorCorrectLevel.H, // Error Correction Level
      };
  
      if (typeof vOption === "string") {
        //checks if the options are simply a string
        vOption = {
          //if so, make it an object with the text value set to the string.
          text: vOption,
        };
      }
  
      // Overwrites options
      if (vOption) {
        // If options are passed,
        for (const i in vOption) {
          // Iterate through each option passed in the argument.
          this._htOption[i] = vOption[i]; // Set the value of the existing option equal to the new value.
        }
      }
  
      if (typeof el === "string") {
        //checks if the element is a string
        el = document.getElementById(el); //if so, sets it to the HTML element with that ID.
      }
  
      if (this._htOption.useSVG) {
        Drawing = svgDrawer;
      }
  
      this._el = el; //sets the element to the local variable
      this._oQRCode = null; //sets the qrcode object to null
      this._oDrawing = new Drawing(this._el, this._htOption); //creates a new drawing object.
  
      if (this._htOption.text) {
        // If text is passed,
        this.makeCode(this._htOption.text); // make the code.
      }
    }
  
    /**
     * Make the QRCode
     *
     * @param {String} sText link data
     */
    makeCode(sText) {
      this._oQRCode = new QRCodeModel(
        _getTypeNumber(sText, this._htOption.correctLevel),
        this._htOption.correctLevel
      ); // Create a new QR code model with the specified type number and error correction level.
      this._oQRCode.addData(sText); // Add the data to the QR code model.
      this._oQRCode.make(); // Make the QR code.
      this._el.title = sText; // Set the title attribute of the element to the data.
      this._oDrawing.draw(this._oQRCode); // Draw the QR code.
      this.makeImage(); // Call the makeImage function.
    }
  
    /**
     * Make the Image from Canvas element - It occurs automatically
     *
     * @private
     */
    makeImage() {
      if (typeof this._oDrawing.makeImage === "function") {
        // Checks if it's a function
        this._oDrawing.makeImage(); // Call the makeImage function to create the image from the Canvas.
      }
    }
  
    /**
     * Clear the QRCode
     */
    clear() {
      this._oDrawing.clear(); // Call the clear function of the drawing object.
    }
  };
  
  /**
   * @name QRCode.CorrectLevel
   */
  QRCode.CorrectLevel = QRErrorCorrectLevel; //set the CorrectLevel to the error correction level to export it.