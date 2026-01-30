/* assets/js/p5-visualizer.js */
class Rectangle {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
  getBottom() { return this.y + this.h; }
}

class Spectrogram extends Rectangle {
  constructor(x, y, w, h, lenSec) {
    super(x, y, w, h);
    this.samplingRate = sampleRate() || 44100;
    this.lenSec = lenSec;
    this.bufferIndex = 0;
    this.gfx1 = createGraphics(w, h);
    this.gfx2 = createGraphics(w, h);
    this.gfx1.x = 0;
    this.gfx2.x = w;
  }

  update(spectrum) {
    // 【关键修正】增加数据检查
    if (!spectrum || spectrum.length === 0) return;

    let totalSamples = this.lenSec * this.samplingRate;
    let xBufVal = map(this.bufferIndex, 0, totalSamples, 0, this.w);
    let xVal = xBufVal % this.w;
    let select = Math.floor(xBufVal / this.w) % 2;
    let active = (select === 0) ? this.gfx1 : this.gfx2;

    // 清除即将写入的新区域，防止重影
    active.noStroke();
    active.fill(0, 5); // 稍微带点透明度的黑
    active.rect(xVal, 0, 5, this.h);

    if (select === 0) { this.gfx1.x = -xVal; this.gfx2.x = this.w - xVal; }
    else { this.gfx1.x = this.w - xVal; this.gfx2.x = -xVal; }

    active.noStroke();
    // 渲染频谱：为了性能，每隔几个频点抽样一次
    for (let i = 0; i < spectrum.length; i += 6) {
      let amp = spectrum[i];
      if (amp > 20) {
        let y = map(i, 0, spectrum.length, this.h, 0);
        let hue = map(i, 0, spectrum.length, 190, 280);
        active.fill(hue, 80, 100, map(amp, 0, 255, 0, 100));
        active.rect(xVal, y, 2, 4);
      }
    }
    this.bufferIndex += spectrum.length;
  }

  draw() {
    image(this.gfx1, this.gfx1.x, this.y);
    image(this.gfx2, this.gfx2.x, this.y);
  }
}

let mic, fft, visualizer, isReady = false;

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  colorMode(HSB, 360, 100, 100, 100);
  fft = new p5.FFT(0.8, 512);
}

function draw() {
  if (!isReady) {
    background(10); // 深灰色背景
    fill(255);
    textAlign(CENTER);
    text("MIC INITIALIZING / CLICK TO START", width/2, height/2);
    return;
  }
  
  // 核心：保持背景完全透明，让 CSS 的底层颜色（或黑色）透出来
  clear(); 
  
  let spectrum = fft.analyze();
  if (visualizer && spectrum) { 
    visualizer.update(spectrum); 
    visualizer.draw(); 
  }
}

function mousePressed() {
  if (!isReady) {
    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        console.log("Mic Active");
        // 延迟一秒初始化 visualizer，确保音频上下文完全稳定
        setTimeout(() => {
          visualizer = new Spectrogram(0, 0, width, height, 15);
          isReady = true;
        }, 500);
      }, (err) => {
        alert("Mic Error: " + err);
      });
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (visualizer) {
    visualizer = new Spectrogram(0, 0, width, height, 15);
  }
}
