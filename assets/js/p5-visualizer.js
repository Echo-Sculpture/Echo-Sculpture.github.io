/* assets/js/p5-visualizer.js */

/**
 * 原作者：Jon Froehlich (http://makeabilitylab.io/)
 * 适配 Jekyll 背景逻辑：Gemini
 */

// --- 全局变量 ---
let mic, fft, spectrogram;
let isAudioStarted = false;

// --- 适配函数 ---
function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  
  // 初始化 FFT
  fft = new p5.FFT(0.8, 1024);
}

function draw() {
  if (!isAudioStarted) {
    background(15);
    fill(200);
    textAlign(CENTER);
    textSize(20);
    text("INTERACTIVE BACKGROUND: CLICK TO ACTIVATE", width / 2, height / 2);
    return;
  }

  clear(); // 保持背景透明

  let spectrum = fft.analyze();
  if (spectrogram && spectrum) {
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
        // 初始化原版 Spectrogram 类
        // 参数：x, y, width, height, backgroundColor, lengthInSeconds
        spectrogram = new Spectrogram(0, 0, width, height, color(0, 0), 15);
        spectrogram.colorScheme = COLORSCHEME.PURPLEICE; // 使用你喜欢的紫色调
        isAudioStarted = true;
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 窗口缩放时重置，防止原版双缓冲错位
  if(isAudioStarted) spectrogram = new Spectrogram(0, 0, width, height, color(0, 0), 15);
}

// ==========================================
// 以下为你提供的原版类定义（保持不变）
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
    this.bDrawAxes = false; // 关闭坐标轴，作为背景更干净
    this.bufferIndex = 0;
    this.xTicks = [];
    this.xTickEveryNSec = lengthInSeconds / 4;
    for (let s = 0; s < lengthInSeconds; s += this.xTickEveryNSec) { this.xTicks.push(s); }
  }

  update(buffer) { this.bufferIndex += buffer.length; }
  getXAxisLengthInSamples() { return this.lengthInSeconds * this.samplingRate; }
  getMinXAsSampleIndex() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? 0 : this.bufferIndex - this.getXAxisLengthInSamples(); }
  getMaxXAsSampleIndex() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? this.getXAxisLengthInSamples() : this.bufferIndex; }
  convertBufferLengthToXPixels(bufferLength) { return (bufferLength / this.getXAxisLengthInSamples()) * this.width; }
  
  // 核心坐标转换
  getXPixelFromTimeInSecs(timeInSecs) {
    let minT = this.getMinXAsSampleIndex() / this.samplingRate;
    let maxT = this.getMaxXAsSampleIndex() / this.samplingRate;
    return map(timeInSecs, minT, maxT, this.x, this.width);
  }
}

const COLORSCHEME = { GRAYSCALE: 'grayscale', RAINBOW: 'rainbow', PURPLEICE: 'purpleice', CUSTOM: 'custom' }

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
    let selectIdx = int(xBufferVal / this.width) % 2;
    
    let offScreenBuffer = (selectIdx == 0) ? this.offscreenGfxBuffer1 : this.offscreenGfxBuffer2;

    if (xBufferVal > this.width) {
      if (selectIdx == 0) {
        this.offscreenGfxBuffer1.x = this.width - xVal;
        this.offscreenGfxBuffer2.x = this.width - (xVal + this.width);
      } else {
        this.offscreenGfxBuffer1.x = this.width - (xVal + this.width);
        this.offscreenGfxBuffer2.x = this.width - xVal;
      }
    }

    offScreenBuffer.push();
    offScreenBuffer.strokeWeight(1);
    if(this.colorScheme == COLORSCHEME.PURPLEICE) offScreenBuffer.colorMode(HSB);

    let bufferLenX = this.convertBufferLengthToXPixels(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      let y = map(i, 0, spectrum.length, this.height, 0);
      let hue = map(spectrum[i], 0, 255, 240, 310); // 紫冰色
      offScreenBuffer.stroke(hue, 80, map(spectrum[i], 0, 255, 0, 90));
      
      if (bufferLenX <= 1) {
        offScreenBuffer.point(xVal, y);
      } else {
        offScreenBuffer.line(xVal, y, xVal + bufferLenX, y);
      }
    }
    offScreenBuffer.pop();
    super.update(spectrum);
  }

  draw() {
    image(this.offscreenGfxBuffer1, this.offscreenGfxBuffer1.x, this.y);
    image(this.offscreenGfxBuffer2, this.offscreenGfxBuffer2.x, this.y);
  }
}
