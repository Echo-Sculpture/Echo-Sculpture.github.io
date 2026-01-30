/* assets/js/p5-visualizer.js */

let mic, fft;
let isAudioStarted = false;
let visualizers = []; 

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.id('p5-background');
  cnv.parent(document.body);
  fft = new p5.FFT(0.8, 1024);
}

function draw() {
  if (!isAudioStarted) {
    background(20);
    fill(150); textAlign(CENTER); textSize(16);
    text("AUDIO ENGINE READY. CLICK TO INITIALIZE LAYOUT.", width/2, height/2);
    return;
  }

  background(30); // 纯净深灰背景

  let spectrum = fft.analyze();
  let waveform = fft.waveform();
  
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
        initLayout(); 
        isAudioStarted = true;
      });
    });
  }
}

function initLayout() {
  visualizers = [];
  let padding = 20;
  // 核心比例：三层等分
  let sectionH = (height - padding * 4) / 3;
  let bg = color(40); 

  // 1. 顶部：滚动波形 (Waveform)
  visualizers.push(new WaveformVisualizer(padding, padding, width - padding * 2, sectionH, bg, 10));

  // 2. 中间：滚动频谱 (Spectrogram)
  visualizers.push(new Spectrogram(padding, sectionH + padding * 2, width - padding * 2, sectionH, bg, 10));

  // 3. 底部左侧：实时频谱统计 (Spectrum)
  visualizers.push(new SpectrumVisualizer(padding, sectionH * 2 + padding * 3, (width - padding * 3) / 2, sectionH, bg));

  // 4. 底部右侧：即时波形 (Instant)
  visualizers.push(new InstantWaveformVis((width + padding) / 2, sectionH * 2 + padding * 3, (width - padding * 3) / 2, sectionH, bg));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if(isAudioStarted) initLayout();
}

// ==========================================
// 核心类定义 (已修复作用域 Bug)
// ==========================================

class Rectangle {
  constructor(x, y, width, height, backgroundColor) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.backgroundColor = backgroundColor;
  }
  getLeft() { return this.x; }
  getRight() { return this.x + this.width; }
  getBottom() { return this.y + this.height; }
}

class SoundVisualizer extends Rectangle {
  constructor(x, y, width, height, backgroundColor, lengthInSeconds) {
    super(x, y, width, height, backgroundColor);
    this.samplingRate = sampleRate();
    this.lengthInSeconds = lengthInSeconds;
    this.bufferIndex = 0;
    this.xTicks = [];
    let interval = lengthInSeconds / 4;
    for (let s = 0; s < lengthInSeconds; s += interval) this.xTicks.push(s);
  }
  update(buffer) { this.bufferIndex += buffer.length; }
  getXAxisLengthInSamples() { return this.lengthInSeconds * this.samplingRate; }
  getMinXAsTime() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? 0 : (this.bufferIndex - this.getXAxisLengthInSamples()) / this.samplingRate; }
  getMaxXAsTime() { return (this.bufferIndex < this.getXAxisLengthInSamples()) ? this.lengthInSeconds : this.bufferIndex / this.samplingRate; }
  
  drawXAxis() {
    push(); textSize(9); stroke(100); fill(150);
    for (let t of this.xTicks) {
      let px = map(t, this.getMinXAsTime(), this.getMaxXAsTime(), this.x, this.x + this.width);
      if (px >= this.x && px <= this.x + this.width) {
        line(px, this.getBottom()-3, px, this.getBottom());
        text(nfc(t,1)+"s", px - 5, this.getBottom()-5);
      }
    }
    pop();
  }
}

// 1. 顶部波形
class WaveformVisualizer extends SoundVisualizer {
  constructor(x,y,w,h,bg,len) { super(x,y,w,h,bg,len); this.waveformDraw = []; this.waveformBuffer = []; }
  update(waveform) {
    this.waveformBuffer = this.waveformBuffer.concat(waveform);
    let spp = int(this.getXAxisLengthInSamples() / this.width);
    while (this.waveformBuffer.length >= spp) {
      let chunk = this.waveformBuffer.splice(0, spp);
      this.waveformDraw.push({min: map(min(chunk), -1, 1, this.getBottom(), this.y), max: map(max(chunk), -1, 1, this.getBottom(), this.y)});
      if (this.waveformDraw.length > this.width) this.waveformDraw.shift();
    }
    super.update(waveform);
  }
  draw() {
    push(); fill(this.backgroundColor); noStroke(); rect(this.x, this.y, this.width, this.height);
    stroke(255); noFill(); 
    for(let i=0; i<this.waveformDraw.length; i++) line(this.x+i, this.waveformDraw[i].min, this.x+i, this.waveformDraw[i].max);
    pop(); this.drawXAxis();
  }
}

// 2. 中间频谱 (修复了 sectionH 报错)
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
      active.stroke(map(spec[i],0,255,40,255)); // 灰度映射
      active.point(x, map(i,0,spec.length,this.height,0));
    }
    super.update(spec);
  }
  draw() { 
    image(this.off1, this.x + this.off1.x, this.y); 
    image(this.off2, this.x + this.off2.x, this.y); 
    this.drawYAxis(); this.drawXAxis(); 
  }
  drawYAxis() {
    push(); stroke(150); fill(150); textSize(9);
    for(let i=0; i<=4; i++) {
      let y = (this.height/4) * i;
      let freq = map(4-i, 0, 4, 0, sampleRate()/2);
      text(nfc(freq,0)+"Hz", this.x+5, this.y+y+10);
    }
    pop();
  }
}

// 3. 底部左侧实时频谱
class SpectrumVisualizer extends Rectangle {
  constructor(x,y,w,h,bg) { super(x,y,w,h,bg); this.spectrum = []; }
  update(s) { this.spectrum = s; }
  draw() {
    push(); fill(this.backgroundColor); rect(this.x,this.y,this.width,this.height);
    fill(200, 100); stroke(255); beginShape();
    for(let i=0; i<this.spectrum.length; i++){
      vertex(map(i,0,this.spectrum.length,this.x,this.getLeft()+this.width), map(this.spectrum[i],0,255,this.getBottom(),this.y));
    }
    vertex(this.getLeft()+this.width,this.getBottom()); vertex(this.x,this.getBottom()); endShape(CLOSE); pop();
  }
}

// 4. 底部右侧即时波形
class InstantWaveformVis extends Rectangle {
  constructor(x,y,w,h,bg) { super(x,y,w,h,bg); this.w = []; }
  update(w) { this.w = w; }
  draw() {
    push(); fill(this.backgroundColor); rect(this.x,this.y,this.width,this.height);
    noFill(); stroke(255); strokeWeight(1.5); beginShape();
    for(let i=0; i<this.w.length; i++) vertex(map(i,0,this.w.length,this.x,this.getLeft()+this.width), map(this.w[i],-1,1,this.getBottom(),this.y));
    endShape(); pop();
  }
}
