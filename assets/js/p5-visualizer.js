/* assets/js/p5-visualizer.js */

// ==========================================
// 1. 驱动逻辑：负责初始化和调用原版类
// ==========================================
let mic, fft, spectrogram;
let isAudioStarted = false;

function setup() {
  // 铺满全屏
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  
  // 原版默认配色和采样初始化
  fft = new p5.FFT(0.8, 1024);
}

function draw() {
  if (!isAudioStarted) {
    background(10);
    fill(255);
    textAlign(CENTER);
    textSize(18);
    text("JON FROEHLICH SPECTROGRAM\n\nCLICK TO ACTIVATE MIC", width/2, height/2);
    return;
  }

  // 科学背景色：原版通常使用深色背景
  background(0); 

  let spectrum = fft.analyze();
  
  if (spectrogram && spectrum) {
    // 调用原版类的 update 和 draw
    spectrogram.update(spectrum);
    spectrogram.draw();
  }
}

function mousePressed() {
  if (!isAudioStarted) {
    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        fft.setInput(mic);
        
        /** * 初始化原版 Spectrogram 类
         * 参数：x, y, width, height, backgroundColor, lengthInSeconds
         */
        spectrogram = new Spectrogram(0, 0, width, height, color(10), 15);
        
        // 设置原版定义的配色方案
        spectrogram.colorScheme = COLORSCHEME.PURPLEICE; 
        spectrogram.bDrawAxes = true; // 开启原版坐标轴
        
        isAudioStarted = true;
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if(isAudioStarted) {
    spectrogram = new Spectrogram(0, 0, width, height, color(10), 15);
    spectrogram.colorScheme = COLORSCHEME.PURPLEICE;
    spectrogram.bDrawAxes = true;
  }
}

// ==========================================
// 2. 以下是 Jon Froehlich 的完整原始类定义
// (不做任何删减，确保原汁原味)
// ==========================================

class Rectangle {
  constructor(x, y, width, height, backgroundColor) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.backgroundColor = backgroundColor;
  }
  getLeft() { return this.x; }
  getRight() { return this.x + this.width; }
  getTop() { return this.y; }
  getBottom() { return this.y + this.height; }
  contains(x, y) { return x >= this.x && x <= (this.x + this.width) && y >= this.y && y <= (this.y + this.height); }
}

class SoundVisualizer extends Rectangle {
  constructor(x, y, width, height, backgroundColor, lengthInSeconds) {
    super(x, y, width, height, backgroundColor);
    this.samplingRate = sampleRate();
    this.lengthInSeconds = lengthInSeconds;
    this.bDrawAxes = true;
    this.xTicks = [];
    this.tickLength = 3;
    this.axisLabelsTextSize = 10;
    let numXAxisTicks = 4;
    this.xTickEveryNSec = lengthInSeconds / numXAxisTicks;
    for (let xTickInSecs = 0; xTickInSecs < lengthInSeconds; xTickInSecs += this.xTickEveryNSec) {
      this.xTicks.push(xTickInSecs);
    }
    this.hasUpdateEverBeenCalled = false;
    this.bufferIndex = 0;
  }

  update(buffer) {
    if (this.hasUpdateEverBeenCalled == false) {
      this.hasUpdateEverBeenCalled = true;
    }
    this.bufferIndex += buffer.length;
  }

  getXAxisLengthInSeconds() { return this.lengthInSeconds; }
  getXAxisLengthInSamples() { return this.lengthInSeconds * this.samplingRate; }
  convertBufferLengthToXPixels(bufferLength) { return (bufferLength / this.getXAxisLengthInSamples()) * this.width; }
  getMinXAsTimeInSecs() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? 0 : (this.bufferIndex - this.getXAxisLengthInSamples()) / this.samplingRate; }
  getMaxXAsTimeInSecs() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? this.lengthInSeconds : this.bufferIndex / this.samplingRate; }

  getXPixelFromTimeInSecs(timeInSecs) {
    return map(timeInSecs, this.getMinXAsTimeInSecs(), this.getMaxXAsTimeInSecs(), this.x, this.width);
  }

  drawXAxisTicksAndLabels() {
    push();
    textSize(this.axisLabelsTextSize);
    for (let i = this.xTicks.length - 1; i >= 0; i--) {
      let xTickInSecs = this.xTicks[i];
      let xTick = this.getXPixelFromTimeInSecs(xTickInSecs);
      stroke(220); line(xTick, this.getBottom() - this.tickLength, xTick, this.getBottom());
      noStroke(); fill(220);
      let xTickStr = nfc(xTickInSecs, 1) + "s";
      text(xTickStr, xTick - textWidth(xTickStr)/2, this.getBottom() - (this.tickLength + 2));
      if (xTick < this.x) {
        this.xTicks.splice(i, 1);
        this.xTicks.push(this.xTicks[this.xTicks.length - 1] + this.xTickEveryNSec);
      }
    }
    pop();
  }
}

const COLORSCHEME = { GRAYSCALE: 'grayscale', RAINBOW: 'rainbow', PURPLEICE: 'purpleice', CUSTOM: 'custom' };

class Spectrogram extends SoundVisualizer {
  constructor(x, y, width, height, backgroundColor, lengthInSeconds) {
    super(x, y, width, height, backgroundColor, lengthInSeconds);
    this.offscreenGfxBuffer1 = createGraphics(this.width, this.height);
    this.offscreenGfxBuffer2 = createGraphics(this.width, this.height);
    this.offscreenGfxBuffer1.x = 0;
    this.offscreenGfxBuffer2.x = this.width;
    this.spectrum = null;
    this.colorScheme = COLORSCHEME.PURPLEICE;
  }

  update(spectrum) {
    this.spectrum = spectrum;
    let xBufferVal = map(this.bufferIndex, 0, this.getXAxisLengthInSamples(), 0, this.width);
    let xVal = xBufferVal - (int(xBufferVal / this.width)) * this.width;
    let selectOffscreenBuffer = int(xBufferVal / this.width) % 2;
    let offScreenBuffer = (selectOffscreenBuffer == 0) ? this.offscreenGfxBuffer1 : this.offscreenGfxBuffer2;

    if (xBufferVal > this.width) {
      if (selectOffscreenBuffer == 0) {
        this.offscreenGfxBuffer1.x = this.width - xVal;
        this.offscreenGfxBuffer2.x = this.width - (xVal + this.width);
      } else {
        this.offscreenGfxBuffer1.x = this.width - (xVal + this.width);
        this.offscreenGfxBuffer2.x = this.width - xVal;
      }
    }

    offScreenBuffer.push();
    if(this.colorScheme == COLORSCHEME.PURPLEICE) offScreenBuffer.colorMode(HSB);
    
    let bufferLengthInXPixels = this.convertBufferLengthToXPixels(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      let y = map(i, 0, spectrum.length, this.height, 0);
      let col;
      if(this.colorScheme == COLORSCHEME.PURPLEICE){
        col = offScreenBuffer.color(map(spectrum[i], 0, 255, 240, 360), 80, 90);
      } else {
        col = map(spectrum[i], 0, 255, 0, 255);
      }
      offScreenBuffer.stroke(col);
      if (bufferLengthInXPixels <= 1) {
        offScreenBuffer.point(xVal, y);
      } else {
        offScreenBuffer.line(xVal, y, xVal + bufferLengthInXPixels, y);
      }
    }
    offScreenBuffer.pop();
    super.update(spectrum);
  }

  draw() {
    image(this.offscreenGfxBuffer1, this.offscreenGfxBuffer1.x, this.y);
    image(this.offscreenGfxBuffer2, this.offscreenGfxBuffer2.x, this.y);
    if (this.bDrawAxes) this.drawAxes();
  }

  drawAxes() {
    if (!this.spectrum) return;
    push();
    let nyquistFreq = this.samplingRate / 2.0;
    let freqRangeOfEachYPixel = nyquistFreq / this.height;
    for (let yTick = 0; yTick <= this.height; yTick += 100) {
      stroke(220);
      line(this.x, yTick, this.x + 5, yTick);
      noStroke(); fill(220); textSize(10);
      let freq = (this.height - yTick) * freqRangeOfEachYPixel;
      text(nfc(freq, 0) + " Hz", this.x + 8, yTick + 4);
    }
    pop();
    this.drawXAxisTicksAndLabels();
  }
}
