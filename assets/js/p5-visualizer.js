/* assets/js/p5-visualizer.js */

// ... Rectangle 和 Spectrogram 类保持不变 ...
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
    if (!spectrum || spectrum[0] === undefined) return;
    let totalSamples = this.lenSec * this.samplingRate;
    let xBufVal = map(this.bufferIndex, 0, totalSamples, 0, this.w);
    let xVal = xBufVal % this.w;
    let select = Math.floor(xBufVal / this.w) % 2;
    let active = (select === 0) ? this.gfx1 : this.gfx2;

    if (select === 0) { this.gfx1.x = -xVal; this.gfx2.x = this.w - xVal; }
    else { this.gfx1.x = this.w - xVal; this.gfx2.x = -xVal; }

    active.noStroke();
    // 调高亮度，确保能看到
    for (let i = 0; i < spectrum.length; i += 6) {
      let amp = spectrum[i];
      if (amp > 5) { 
        let y = map(i, 0, spectrum.length, this.h, 0);
        let hue = map(i, 0, spectrum.length, 180, 260);
        active.fill(hue, 90, 100, map(amp, 0, 255, 50, 100));
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
  
  // 初始化 FFT 但先不连输入
  fft = new p5.FFT(0.8, 512);
}

function draw() {
  if (!isReady) {
    background(10);
    fill(255); textAlign(CENTER);
    text("PLEASE CLICK TO ACTIVATE AUDIO", width/2, height/2);
    return;
  }
  
  clear(); // 恢复透明背景
  
  // 必须每帧调用 analyze() 才能更新内部数据
  let spectrum = fft.analyze();
  let amp = fft.getEnergy(20, 200); // 监听低频能量

  // 测试红圆：如果麦克风有声音，它一定会动
  push();
  fill(0, 100, 100); 
  noStroke();
  let r = 50 + map(amp, 0, 255, 0, 200);
  ellipse(width/2, height/2, r);
  pop();

  if (visualizer && spectrum) { 
    visualizer.update(spectrum); 
    visualizer.draw(); 
  }
}

function mousePressed() {
  if (!isReady) {
    // 强制恢复 AudioContext
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }

    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        console.log("Mic successfully started");
        // 重要：显式连接 mic 到 fft
        fft.setInput(mic); 
        visualizer = new Spectrogram(0, 0, width, height, 20);
        isReady = true;
      }, (err) => {
        console.error("Mic access denied", err);
        alert("请确保浏览器允许使用麦克风！");
      });
    });
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
