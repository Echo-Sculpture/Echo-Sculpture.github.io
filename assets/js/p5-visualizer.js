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
    this.gfx1.colorMode(HSB, 360, 100, 100, 100);
    this.gfx2.colorMode(HSB, 360, 100, 100, 100);
  }

  update(spectrum) {
    if (!spectrum) return;
    let totalSamples = this.lenSec * this.samplingRate;
    let xBufVal = map(this.bufferIndex, 0, totalSamples, 0, this.w);
    let xVal = xBufVal % this.w;
    let select = Math.floor(xBufVal / this.w) % 2;
    let active = (select === 0) ? this.gfx1 : this.gfx2;

    if (select === 0) { this.gfx1.x = -xVal; this.gfx2.x = this.w - xVal; }
    else { this.gfx1.x = this.w - xVal; this.gfx2.x = -xVal; }

    active.noStroke();
    for (let i = 0; i < spectrum.length; i += 6) {
      let amp = spectrum[i];
      if (amp > 10) { // 调低阈值，更容易看到
        let y = map(i, 0, spectrum.length, this.h, 0);
        let hue = map(i, 0, spectrum.length, 180, 260);
        active.fill(hue, 80, 100, map(amp, 0, 255, 20, 100));
        active.rect(xVal, y, 3, 5); 
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
    background(20); // 未启动时显灰色
    fill(255); textAlign(CENTER);
    text("TAP SCREEN TO START", width/2, height/2);
    return;
  }
  
  // --- 暴力测试模式 ---
  background(0); // 强制黑色背景，不再透明，确保你能看到画布
  
  let spectrum = fft.analyze();
  let energy = fft.getEnergy("bass"); // 获取低音能量

  // 画一个随声音跳动的圆（放在最前面，确保必现）
  fill(0, 100, 100); // 纯红色
  noStroke();
  ellipse(width/2, height/2, 50 + energy * 2);

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
        visualizer = new Spectrogram(0, 0, width, height, 15);
        isReady = true;
      });
    });
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
