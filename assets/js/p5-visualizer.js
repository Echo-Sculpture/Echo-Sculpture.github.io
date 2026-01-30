/* assets/js/p5-visualizer.js */

let mic, fft;
let isAudioStarted = false;
let visualizers = []; // 存储所有的可视化模块

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  
  // 采样率越高越细腻
  fft = new p5.FFT(0.8, 1024);
}

function draw() {
  if (!isAudioStarted) {
    background(20);
    fill(150); textAlign(CENTER); textSize(16);
    text("AUDIO ENGINE READY. CLICK TO INITIALIZE LAYOUT.", width/2, height/2);
    return;
  }

  // 背景保持纯深灰/黑，黑白灰简洁风格
  background(30); 

  let spectrum = fft.analyze();
  let waveform = fft.waveform();
  
  // 驱动所有模块更新和绘制
  for (let vis of visualizers) {
    if (vis instanceof WaveformVisualizer || vis instanceof InstantWaveformVis) {
      vis.update(waveform);
    } else {
      vis.update(spectrum);
    }
    vis.draw();
  }
}

function mousePressed() {
  if (!isAudioStarted) {
    userStartAudio().then(() => {
      mic = new p5.AudioIn();
      mic.start(() => {
        fft.setInput(mic);
        initLayout(); // 按照截图初始化布局
        isAudioStarted = true;
      });
    });
  }
}

/**
 * 按照截图进行分区布局
 * 顶部：滚动波形 (Waveform)
 * 中间：滚动频谱 (Spectrogram)
 * 底部左侧：实时频谱 (Spectrum)
 * 底部右侧：实时波形 (Instant Waveform)
 */
function initLayout() {
  visualizers = [];
  let padding = 20;
  let sectionH = (height - padding * 4) / 3;
  let bg = color(40); // 模块背景色

  // 1. 顶部滚动波形
  let waveVis = new WaveformVisualizer(padding, padding, width - padding * 2, sectionH, bg, 10);
  waveVis.colorScheme = COLORSCHEME.GRAYSCALE;
  visualizers.push(waveVis);

  // 2. 中间滚动频谱
  let specGram = new Spectrogram(padding, sectionH + padding * 2, width - padding * 2, sectionH, bg, 10);
  specGram.colorScheme = COLORSCHEME.GRAYSCALE;
  visualizers.push(specGram);

  // 3. 底部实时频谱 (左半部分)
  let specVis = new SpectrumVisualizer(padding, sectionH * 2 + padding * 3, (width - padding * 3) / 2, sectionH, bg);
  specVis.colorScheme = COLORSCHEME.GRAYSCALE;
  visualizers.push(specVis);

  // 4. 底部即时波形 (右半部分)
  let instWave = new InstantWaveformVis((width + padding) / 2, sectionH * 2 + padding * 3, (width - padding * 3) / 2, sectionH, bg);
  visualizers.push(instWave);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if(isAudioStarted) initLayout();
}

// ==========================================================
// 以下为 Jon Froehlich 的核心类定义，保持黑白灰逻辑
// ==========================================================

class Rectangle {
  constructor(x, y, width, height, backgroundColor) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.backgroundColor = backgroundColor;
  }
  getLeft() { return this.x; }
  getRight() { return this.x + this.width; }
  getTop() { return this.y; }
  getBottom() { return this.y + this.height; }
}

class SoundVisualizer extends Rectangle {
  constructor(x, y, width, height, backgroundColor, lengthInSeconds) {
    super(x, y, width, height, backgroundColor);
    this.samplingRate = sampleRate();
    this.lengthInSeconds = lengthInSeconds;
    this.bDrawAxes = true;
    this.bufferIndex = 0;
    this.xTicks = [];
    this.xTickEveryNSec = lengthInSeconds / 4;
    for (let s = 0; s < lengthInSeconds; s += this.xTickEveryNSec) this.xTicks.push(s);
  }
  update(buffer) { this.bufferIndex += buffer.length; }
  getXAxisLengthInSamples() { return this.lengthInSeconds * this.samplingRate; }
  getMinXAsTimeInSecs() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? 0 : (this.bufferIndex - this.getXAxisLengthInSamples()) / this.samplingRate; }
  getMaxXAsTimeInSecs() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? this.lengthInSeconds : this.bufferIndex / this.samplingRate; }
  getXPixelFromTimeInSecs(t) { return map(t, this.getMinXAsTimeInSecs(), this.getMaxXAsTimeInSecs(), this.x, this.x + this.width); }
  
  drawXAxisTicksAndLabels() {
    push(); textSize(9); stroke(100); fill(150);
    for (let t of this.xTicks) {
      let px = this.getXPixelFromTimeInSecs(t);
      if (px >= this.x && px <= this.x + this.width) {
        line(px, this.getBottom()-3, px, this.getBottom());
        text(nfc(t,1)+"s", px - 5, this.getBottom()-5);
      }
    }
    pop();
  }
}

const COLORSCHEME = { GRAYSCALE: 'grayscale' };

// --- 1. 滚动波形类 ---
class WaveformVisualizer extends SoundVisualizer {
  constructor(x,y,w,h,bg,len) { super(x,y,w,h,bg,len); this.waveformDraw = []; this.waveformBuffer = []; }
  update(waveform) {
    this.waveformBuffer = this.waveformBuffer.concat(waveform);
    let samplesPerPixel = int(this.getXAxisLengthInSamples() / this.width);
    while (this.waveformBuffer.length >= samplesPerPixel) {
      let chunk = this.waveformBuffer.splice(0, samplesPerPixel);
      this.waveformDraw.push({min: map(min(chunk), -1, 1, this.getBottom(), this.y), max: map(max(chunk), -1, 1, this.getBottom(), this.y)});
      if (this.waveformDraw.length > this.width) this.waveformDraw.shift();
    }
    super.update(waveform);
  }
  draw() {
    push(); fill(this.backgroundColor); noStroke(); rect(this.x, this.y, this.width, this.height);
    stroke(255); noFill(); beginShape();
    for(let i=0; i<this.waveformDraw.length; i++){ vertex(this.x+i, this.waveformDraw[i].min); vertex(this.x+i, this.waveformDraw[i].max); }
    endShape(); pop(); this.drawXAxisTicksAndLabels();
  }
}

// --- 2. 滚动频谱类 ---
class Spectrogram extends SoundVisualizer {
  constructor(x,y,w,h,bg,len) {
    super(x,y,w,h,bg,len);
    this.off1 = createGraphics(w,h); this.off2 = createGraphics(w,h);
    this.off1.x = 0; this.off2.x = w;
  }
  update(spec) {
    let xBuf = map(this.bufferIndex, 0, this.getXAxisLengthInSamples(), 0, this.width);
    let x = xBuf % this.width;
    let active = (int(xBuf/this.width)%2==0) ? this.off1 : this.off2;
    if(xBuf > this.width){
      if(int(xBuf/this.width)%2==0){ this.off1.x = this.width-x; this.off2.x = -x; }
      else { this.off1.x = -x; this.off2.x = this.width-x; }
    }
    active.strokeWeight(1);
    for(let i=0; i<spec.length; i+=2){
      active.stroke(map(spec[i],0,255,40,255));
      active.point(x, map(i,0,spec.length,this.height,0));
    }
    super.update(spec);
  }
  draw() { image(this.off1, this.x + this.off1.x, this.y); image(this.off2, this.x + this.off2.x, this.y); this.drawAxes(); }
  drawAxes() {
    push(); stroke(150); fill(150); textSize(9);
    for(let y=0; y<=this.height; y+=sectionH/4) text(nfc(map(this.height-y,0,this.height,0,sampleRate()/2),0)+"Hz", this.x+5, this.y+y);
    pop();
  }
}

// --- 3. 实时频谱统计 ---
class SpectrumVisualizer extends Rectangle {
  constructor(x,y,w,h,bg) { super(x,y,w,h,bg); this.spectrum = []; }
  update(s) { this.spectrum = s; }
  draw() {
    push(); fill(this.backgroundColor); rect(this.x,this.y,this.width,this.height);
    fill(180, 100); stroke(255); beginShape();
    for(let i=0; i<this.spectrum.length; i++){
      vertex(map(i,0,this.spectrum.length,this.x,this.getRight()), map(this.spectrum[i],0,255,this.getBottom(),this.y));
    }
    vertex(this.getRight(),this.getBottom()); vertex(this.getLeft(),this.getBottom()); endShape(CLOSE); pop();
  }
}

// --- 4. 即时波形 ---
class InstantWaveformVis extends Rectangle {
  constructor(x,y,w,h,bg) { super(x,y,w,h,bg); this.w = []; }
  update(w) { this.w = w; }
  draw() {
    push(); fill(this.backgroundColor); rect(this.x,this.y,this.width,this.height);
    noFill(); stroke(255); strokeWeight(2); beginShape();
    for(let i=0; i<this.w.length; i++) vertex(map(i,0,this.w.length,this.x,this.getRight()), map(this.w[i],-1,1,this.getBottom(),this.y));
    endShape(); pop();
  }
}
